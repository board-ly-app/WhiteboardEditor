mod wss;

// -- standard library imports

use std::{cmp::Ordering, collections::HashMap, env, net::SocketAddr, process, sync::Arc};

use futures::{SinkExt, StreamExt, lock::Mutex};

// -- third party imports

use tokio::sync::broadcast;
use warp::Filter;
use warp::ws::{Message, WebSocket};

use mongodb::{
    Collection,
    bson::{self, doc},
};

// -- local imports

#[tokio::main]
async fn main() -> process::ExitCode {
    use wss::{
        db::connect_mongodb,
        models::{WhiteboardIdType, WhiteboardMongoDBView},
        protocol::{ServerSocketMessage,ServerSocketBroadcastMessage},
        server::{ConnectionState, ProgramState},
    };

    let port = 3000u16;
    let jwt_secret = match env::var("JWT_SECRET") {
        Err(e) => {
            eprintln!("Could not find $JWT_SECRET: {}", e);
            return process::ExitCode::FAILURE;
        }
        Ok(secret) => secret,
    };
    let mongo_uri = match env::var("MONGO_URI") {
        Err(e) => {
            eprintln!("Could not find $MONGO_URI: {}", e);
            return process::ExitCode::FAILURE;
        }
        Ok(uri) => uri,
    };
    let mongo_client = match connect_mongodb(mongo_uri.as_str()).await {
        Err(e) => {
            eprintln!("Could not connect to mongodb at {}: {}", &mongo_uri, e);
            return process::ExitCode::FAILURE;
        }
        Ok(client) => client,
    };

    // broadcaster for initial whiteboard
    let connection_state_ref = Arc::new(ConnectionState {
        jwt_secret: jwt_secret.clone(),
        next_client_id_index: Mutex::new(0),
        mongo_client: mongo_client.clone(),
        program_state: ProgramState {
            whiteboards: Mutex::new(HashMap::new()),
        },
    });

    // -- spawn thread to watch for changes to whiteboards collection
    let whiteboard_deletion_checker_thread = {
        let connection_state_ref = Arc::clone(&connection_state_ref);
        let db = match mongo_client.default_database() {
            None => {
                // No database specified in mongo uri
                // Print error and disconnect early
                panic!(
                    "Database connection error; could not fetch whiteboard - no default database defined in mongo uri"
                );
            }
            Some(db) => db,
        };

        tokio::spawn(async move {
            let whiteboard_coll = db.collection::<WhiteboardMongoDBView>("whiteboards");
            let mut wb_change_stream = match whiteboard_coll.watch().await {
                Err(e) => panic!(
                    "Could not subscribe to change stream on whiteboards collection: {}",
                    e
                ),
                Ok(stream) => stream,
            };

            // TODO: replace while-let with loop that includes error logging
            while let Ok(Some(event)) = wb_change_stream.next().await.transpose() {
                match event.operation_type {
                    mongodb::change_stream::event::OperationType::Delete => {
                        if let Some(doc) = event.document_key
                            && let Some(bson::Bson::ObjectId(wb_id)) = doc.get("_id") {
                                // acquire lock on whiteboards store in connection state
                                {
                                    let mut whiteboards =
                                        connection_state_ref.program_state.whiteboards.lock().await;

                                    if whiteboards.contains_key(wb_id) {
                                        if let Some(whiteboard_entry) = whiteboards.get(wb_id) {
                                            // -- We have a whiteboard in the whiteboard store

                                            // Notify subscribed clients that the whiteboard has been
                                            // deleted
                                            let _ = whiteboard_entry
                                                .broadcaster
                                                .send(ServerSocketMessage::Broadcast {
                                                    msg: ServerSocketBroadcastMessage::DeleteWhiteboard,
                                                });

                                            // TODO: end connections
                                            // whiteboard_entry.broadcaster.closed
                                        }

                                        // delete entry
                                        whiteboards.remove(wb_id);
                                    }
                                }
                            };
                    }
                    // we don't care about any other operations
                    _ => {}
                };
            } // -- end while event
        })
    }; // -- end let whiteboard_deletion_checker_thread

    let connection_state_ref_filter = warp::any().map({
        let connection_state_ref = Arc::clone(&connection_state_ref);
        move || Arc::clone(&connection_state_ref)
    });

    let ws_route = warp::path!("ws" / WhiteboardIdType)
        .and(warp::ws())
        .and(connection_state_ref_filter)
        .map(
            |wid: WhiteboardIdType, ws: warp::ws::Ws, connection_state_ref| {
                ws.on_upgrade(move |socket| handle_connection(socket, wid, connection_state_ref))
            },
        );

    let addr: SocketAddr = ([0, 0, 0, 0], port).into();
    println!("Rust WebSocket server running at ws://{}", addr);
    warp::serve(ws_route).run(addr).await;

    // -- abort and reap whiteboard deletion checker thread
    whiteboard_deletion_checker_thread.abort();
    let _ = whiteboard_deletion_checker_thread.await;

    process::ExitCode::SUCCESS
} // end async fn main()

async fn handle_connection(
    ws: WebSocket,
    whiteboard_id: wss::models::WhiteboardIdType,
    connection_state_ref: Arc<wss::server::ConnectionState>,
) {
    use wss::{
        db::{MongoDBStore, WhiteboardDiff, get_whiteboard_by_id},
        models::{
            CanvasMongoDBView, CanvasObjectMongoDBView, ClientIdType, UserMongoDBView,
            WhiteboardMetadataMongoDBView,
        },
        protocol::{
            ClientError,
            ServerSocketMessage,
            ServerSocketBroadcastMessage,
            ServerSocketIndividualMessage,
        },
        server::{
            ClientStateBase, SharedWhiteboardEntry, handle_authenticated_client_message,
            handle_unauthenticated_client_message,
        },
        collections,
        utils::generate_unique_client_id,
    };

    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    let db = match connection_state_ref.mongo_client.default_database() {
        None => {
            // No database specified in mongo uri
            // Print error and disconnect early
            panic!(
                "Database connection error; could not fetch whiteboard - no default database defined in mongo uri"
            );
        }
        Some(db) => db,
    };

    let current_client_id = {
        let mut next_client_id_index = connection_state_ref.next_client_id_index.lock().await;
        let client_id = generate_unique_client_id(whiteboard_id, *next_client_id_index);

        *next_client_id_index += 1;
        client_id
    };

    println!("New client: {}", current_client_id);

    let shared_whiteboard_entry: SharedWhiteboardEntry = {
        // - Fetch whiteboard identified by id from program state
        // - If no such whiteboard, send an individual error message and disconnect
        let mut whiteboards_by_id = connection_state_ref.program_state.whiteboards.lock().await;
        let whiteboard_res = whiteboards_by_id.get(&whiteboard_id);

        match whiteboard_res {
            None => {
                // Try to fetch whiteboard from the database.
                // If present, load into cache.
                // Otherwise, return (disconnect) early.
                match get_whiteboard_by_id(&db, &whiteboard_id).await {
                    Err(e) => {
                        eprintln!("Could not fetch whiteboard from database: {}", e);

                        let err_msg = ServerSocketIndividualMessage::Error {
                            error: ClientError::Other {
                                message: format!(
                                    "Error occurred fetching whiteboard {}",
                                    whiteboard_id
                                ),
                            },
                        };

                        let _ = user_ws_tx
                            .send(Message::text(serde_json::to_string(&err_msg).unwrap()))
                            .await;

                        return;
                    }
                    Ok(None) => {
                        // connection error: print and disconnect
                        eprintln!(
                            "Connection error; could not fetch whiteboard: not found in database"
                        );

                        let err_msg = ServerSocketIndividualMessage::Error {
                            error: ClientError::WhiteboardNotFound {
                                whiteboard_id: whiteboard_id,
                            },
                        };

                        let _ = user_ws_tx
                            .send(Message::text(serde_json::to_string(&err_msg).unwrap()))
                            .await;

                        return;
                    }
                    Ok(Some(whiteboard)) => {
                        let whiteboard_id = *whiteboard.id();
                        let whiteboard_ref = Arc::new(Mutex::new(whiteboard));

                        // sender
                        // TODO: replace 100 with value from a config
                        let (tx, _rx) = broadcast::channel::<ServerSocketMessage>(100);
                        let shared_whiteboard_entry = SharedWhiteboardEntry {
                            whiteboard_ref: Arc::clone(&whiteboard_ref),
                            broadcaster: tx.clone(),
                            active_clients: Arc::new(Mutex::new(HashMap::new())),
                            diffs: Arc::new(Mutex::new(Vec::new())),
                            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
                        };

                        // insert whiteboard into cache
                        whiteboards_by_id.insert(whiteboard_id, shared_whiteboard_entry.clone());

                        println!(
                            "Successfully fetched whiteboard {} from database",
                            whiteboard_id
                        );

                        // return new shared whiteboard entry
                        shared_whiteboard_entry.clone()
                    }
                }
            }
            Some(shared_whiteboard_entry) => shared_whiteboard_entry.clone(),
        }
    };

    // -- subscribe to broadcaster
    let tx = shared_whiteboard_entry.broadcaster.clone();
    let mut rx = tx.subscribe();

    // -- create client state
    let client_state_base = ClientStateBase {
        client_id: current_client_id.clone(),
        jwt_secret: connection_state_ref.jwt_secret.clone(),
        whiteboard_id: whiteboard_id.clone(),
        whiteboard_ref: Arc::clone(&shared_whiteboard_entry.whiteboard_ref),
        active_clients: Arc::clone(&shared_whiteboard_entry.active_clients),
        diffs: Arc::clone(&shared_whiteboard_entry.diffs),
        selectors_to_canvas_objects: Arc::clone(
            &shared_whiteboard_entry.selectors_to_canvas_objects
        ),
    };

    let send_task = {
        let current_client_id = current_client_id.clone();

        tokio::spawn(async move {
            use ServerSocketMessage::*;

            while let Ok(msg) = rx.recv().await {
                match msg {
                    // -- These messages are only sent to individual clients
                    Individual { ref target_client_id, ref msg } => {
                        if let Ordering::Equal = target_client_id.cmp(&current_client_id) {
                            let json = serde_json::to_string(&msg).unwrap();
                            if user_ws_tx.send(Message::text(json)).await.is_err() {
                                break;
                            }
                        }
                    },
                    Broadcast { msg } => {
                        let json = serde_json::to_string(&msg).unwrap();
                        if user_ws_tx.send(Message::text(json)).await.is_err() {
                            break;
                        }
                    },
                    BroadcastRest { ref src_client_id, ref msg } => {
                        if ! matches!(src_client_id.cmp(&current_client_id), Ordering::Equal) {
                            let json = serde_json::to_string(&msg).unwrap();
                            if user_ws_tx.send(Message::text(json)).await.is_err() {
                                break;
                            }
                        }
                    },
                };// -- end match msg
            }
        })
    }; // -- end send_task

    let recv_task = {
        let current_client_id = current_client_id.clone();

        tokio::spawn({
            let tx = tx.clone();
            let db = match connection_state_ref.mongo_client.default_database() {
                None => {
                    // No database specified in mongo uri
                    // Print error and disconnect early
                    eprintln!(
                        "Database connection error; could not fetch whiteboard - no default database defined in mongo uri"
                    );
                    let err_msg = ServerSocketMessage::Individual {
                        target_client_id: current_client_id.clone(),
                        msg: ServerSocketIndividualMessage::Error {
                            error: ClientError::Other {
                                message: format!("Error fetching whiteboard {}", whiteboard_id),
                            },
                        },
                    };

                    let _ = tx.send(err_msg);

                    return;
                }
                Some(db) => db,
            };
            let whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView> =
                db.collection::<WhiteboardMetadataMongoDBView>("whiteboards");
            let canvas_coll: Collection<CanvasMongoDBView> =
                db.collection::<CanvasMongoDBView>("canvases");
            // -- TODO: rename collection to "canvas_objects" for consistency
            let canvas_object_coll: Collection<CanvasObjectMongoDBView> =
                db.collection::<CanvasObjectMongoDBView>("shapes");
            let user_coll: Collection<UserMongoDBView> = db.collection::<UserMongoDBView>("users");
            let store = MongoDBStore::new(&user_coll, &whiteboard_metadata_coll);

            async move {
                // Handle client messages in this loop until user authenticates
                let client_state_authenticated = 'auth: loop {
                    println!("Client {} sent message ...", current_client_id);

                    let msg = if let Some(Ok(msg)) = user_ws_rx.next().await {
                        msg
                    } else {
                        return;
                    };

                    // -- check for whiteboard deletion; if whiteboard deleted, break connection
                    {
                        let whiteboard = client_state_base.whiteboard_ref.lock().await;

                        if !whiteboard.is_active() {
                            return;
                        }
                    }

                    if let Ok(msg_s) = msg.to_str() {
                        println!("Raw message: {}", msg_s);

                        let resp =
                            handle_unauthenticated_client_message(&client_state_base, &store, msg_s)
                                .await;

                        for resp in resp.base.messages.iter() {
                            println!("Client response: {:?}", resp);
                        }

                        // -- update database, if there are diffs
                        {
                            let mut diffs = client_state_base.diffs.lock().await;

                            if !diffs.is_empty() {
                                for diff in diffs.iter() {
                                    match &diff {
                                        WhiteboardDiff::CreateCanvas { canvas } => {
                                            println!(
                                                "Creating canvas \"{}\" in database ...",
                                                canvas.name()
                                            );

                                            // TODO: make method of Canvas struct
                                            let canvas_doc =
                                                CanvasMongoDBView::from_canvas(canvas);
                                            let create_canvas_res =
                                                canvas_coll.insert_one(&canvas_doc).await;

                                            match create_canvas_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvas insert failed: {}", e);
                                                }
                                                Ok(insert) => {
                                                    eprintln!(
                                                        "CreateCanvas new document id: {}",
                                                        insert.inserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::DeleteCanvases { canvas_ids } => {
                                            println!(
                                                "Deleting canvases from database: {:?} ...",
                                                canvas_ids
                                            );

                                            // first delete contained canvas objects
                                            let delete_objects_res = canvas_object_coll
                                                .delete_many(doc! {
                                                    "canvas_id": {
                                                        "$in": canvas_ids.clone()
                                                    }
                                                })
                                                .await;

                                            match delete_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "DeleteCanvases object deletion failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(delete_result) => {
                                                    eprintln!(
                                                        "DeleteCanvases object deletion count {}",
                                                        delete_result.deleted_count
                                                    );
                                                }
                                            };

                                            // then, delete canvas itself
                                            let delete_canvas_res = canvas_coll
                                                .delete_many(doc! {
                                                    "_id": {
                                                        "$in": canvas_ids.clone()
                                                    }
                                                })
                                                .await;

                                            match delete_canvas_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "DeleteCanvases canvas deletion failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(delete_result) => {
                                                    eprintln!(
                                                        "DeleteCanvases canvas deletion count {}",
                                                        delete_result.deleted_count
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::CreateCanvasObjects { canvas_id, canvas_objects } => {
                                            println!(
                                                "Creating canvas_objects in database for canvas {} ...",
                                                canvas_id
                                            );

                                            let canvas_obj_docs: Vec<CanvasObjectMongoDBView> =
                                                canvas_objects
                                                    .iter()
                                                    .map(|(obj_id, canvas_object)| {
                                                        CanvasObjectMongoDBView {
                                                            id: *obj_id,
                                                            canvas_id: *canvas_id,
                                                            canvas_object: canvas_object.clone(),
                                                        }
                                                    })
                                                    .collect();

                                            let create_canvas_objects_res =
                                                canvas_object_coll.insert_many(&canvas_obj_docs).await;

                                            match create_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvasObjects insert failed: {}", e);
                                                }
                                                Ok(insert) => {
                                                    eprintln!(
                                                        "CreateCanvasObjects new document ids: {:?}",
                                                        insert.inserted_ids
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::UpdateCanvasObjects { canvas_id, canvas_objects } => {
                                            println!(
                                                "Updating canvas_objects in database for canvas {} ...",
                                                canvas_id
                                            );

                                            for (obj_id, canvas_object) in canvas_objects.iter() {
                                                let query_doc = doc! { "_id": *obj_id };
                                                let canvas_obj_doc = CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: *canvas_id,
                                                    canvas_object: canvas_object.clone(),
                                                };

                                                let replace_canvas_object_res = canvas_object_coll
                                                    .replace_one(query_doc, &canvas_obj_doc)
                                                    .await;

                                                match replace_canvas_object_res {
                                                    Err(e) => {
                                                        eprintln!(
                                                            "UpdateCanvasObjects replace failed: {}",
                                                            e
                                                        );
                                                    }
                                                    Ok(update) => {
                                                        eprintln!(
                                                            "UpdateCanvasObjects matched_count: {}",
                                                            update.matched_count
                                                        );
                                                        eprintln!(
                                                            "UpdateCanvasObjects modified_count: {}",
                                                            update.modified_count
                                                        );
                                                        eprintln!(
                                                            "UpdateCanvasObjects upserted_id: {:?}",
                                                            update.upserted_id
                                                        );
                                                    }
                                                };
                                            } // end for (obj_id, canvas_object) in canvas_objects.iter()
                                        }
                                        WhiteboardDiff::DeleteCanvasObjects {
                                            canvas_object_ids,
                                        } => {
                                            println!(
                                                "Deleting canvas objects in database: {:?}",
                                                canvas_object_ids
                                            );

                                            let filter = doc! {
                                                "_id": {
                                                    "$in": canvas_object_ids.clone()
                                                }
                                            };
                                            let delete_canvas_objects_res =
                                                canvas_object_coll.delete_many(filter).await;

                                            match delete_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers update failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers deleted: {}",
                                                        update.deleted_count
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::UpdateCanvasAllowedUsers {
                                            canvas_id,
                                            allowed_users,
                                        } => {
                                            println!(
                                                "Updating allowed users in database for canvas {} ...",
                                                canvas_id
                                            );

                                            let query = doc! {
                                                "_id": canvas_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "allowed_users": allowed_users.clone()
                                                }
                                            };

                                            let update_allowed_users_res =
                                                canvas_coll.update_one(query, operator).await;

                                            match update_allowed_users_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers update failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::TransferChildCanvases {
                                            old_parent_id,
                                            new_parent_id,
                                            translate_x,
                                            translate_y,
                                        } => {
                                            println!(
                                                "Transfering child canvases from canvas {} to canvas {} ...",
                                                old_parent_id, new_parent_id
                                            );

                                            let query = doc! {
                                                "parent_canvas.canvas_id": old_parent_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "parent_canvas.canvas_id": new_parent_id,
                                                },
                                                "$inc": {
                                                    "parent_canvas.origin_x": translate_x,
                                                    "parent_canvas.origin_y": translate_y,
                                                },
                                            };

                                            let update_canvases_res =
                                                canvas_coll.update_many(query, operator).await;

                                            match update_canvases_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvases failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvases matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvases modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvases upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::TransferCanvasObjects {
                                            old_canvas_id,
                                            new_canvas_id,
                                            translate_x,
                                            translate_y,
                                        } => {
                                            println!(
                                                "Transfering canvas_objects from canvas {} to canvas {} ...",
                                                old_canvas_id, new_canvas_id
                                            );

                                            // query for vectors
                                            let query_vec = doc! {
                                                "canvas_id": old_canvas_id,
                                                "type": "vector",
                                            };

                                            // operator for vectors
                                            let operator_vec = doc! {
                                                "$set": {
                                                    "canvas_id": new_canvas_id,
                                                },
                                                "$inc": {
                                                    "points.0": translate_x,
                                                    "points.1": translate_y,
                                                    "points.2": translate_x,
                                                    "points.3": translate_y,
                                                },
                                            };

                                            let update_vectors_res = canvas_object_coll
                                                .update_many(query_vec, operator_vec)
                                                .await;

                                            match update_vectors_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects failed on vectors: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };

                                            // query for other canvas objects
                                            let query = doc! {
                                                "canvas_id": old_canvas_id,
                                                "type": {
                                                    "$ne": "vector",
                                                },
                                            };

                                            // operator for other canvas objects
                                            let operator = doc! {
                                                "$set": {
                                                    "canvas_id": new_canvas_id,
                                                },
                                                "$inc": {
                                                    "x": translate_x,
                                                    "y": translate_y,
                                                },
                                            };

                                            let update_objects_res =
                                                canvas_object_coll.update_many(query, operator).await;

                                            match update_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects failed on non-vectors: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                    }
                                } // -- end for &diff in diffs

                                // -- clear diffs
                                diffs.clear();
                            }
                        }

                        // -- send response to clients, if requested
                        for r in resp.base.messages.iter() {
                            tx.send(r.clone()).ok();
                        }

                        if let Some(authenticated_state) = resp.authenticated_state {
                            break 'auth authenticated_state;
                        }
                    }
                };// -- end let client_state_authenticated = 'auth: loop

                // Once client authenticates, handle client messages in this loop
                while let Some(Ok(msg)) = user_ws_rx.next().await {
                    println!("Client {} sent message ...", current_client_id);

                    // -- check for whiteboard deletion; if whiteboard deleted, break connection
                    {
                        let whiteboard = client_state_base.whiteboard_ref.lock().await;

                        if !whiteboard.is_active() {
                            return;
                        }
                    }

                    if let Ok(msg_s) = msg.to_str() {
                        println!("Raw message: {}", msg_s);

                        let resp =
                            handle_authenticated_client_message(&client_state_authenticated, msg_s).await;

                        for r in resp.messages.iter() {
                            println!("Client response: {:?}", &r);
                        }// -- end for r

                        // -- update database, if there are diffs
                        {
                            let mut diffs = client_state_base.diffs.lock().await;

                            if !diffs.is_empty() {
                                for diff in diffs.iter() {
                                    match &diff {
                                        WhiteboardDiff::CreateCanvas { canvas } => {
                                            println!(
                                                "Creating canvas \"{}\" in database ...",
                                                canvas.name()
                                            );

                                            let canvas_doc =
                                                CanvasMongoDBView::from_canvas(canvas);
                                            let create_canvas_res =
                                                canvas_coll.insert_one(&canvas_doc).await;

                                            match create_canvas_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvas insert failed: {}", e);
                                                }
                                                Ok(insert) => {
                                                    eprintln!(
                                                        "CreateCanvas new document id: {}",
                                                        insert.inserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::DeleteCanvases { canvas_ids } => {
                                            println!(
                                                "Deleting canvases from database: {:?} ...",
                                                canvas_ids
                                            );

                                            // first delete contained canvas objects
                                            let delete_objects_res = canvas_object_coll
                                                .delete_many(doc! {
                                                    "canvas_id": {
                                                        "$in": canvas_ids.clone()
                                                    }
                                                })
                                                .await;

                                            match delete_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "DeleteCanvases object deletion failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(delete_result) => {
                                                    eprintln!(
                                                        "DeleteCanvases object deletion count {}",
                                                        delete_result.deleted_count
                                                    );
                                                }
                                            };

                                            // then, delete canvas itself
                                            let delete_canvas_res = canvas_coll
                                                .delete_many(doc! {
                                                    "_id": {
                                                        "$in": canvas_ids.clone()
                                                    }
                                                })
                                                .await;

                                            match delete_canvas_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "DeleteCanvases canvas deletion failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(delete_result) => {
                                                    eprintln!(
                                                        "DeleteCanvases canvas deletion count {}",
                                                        delete_result.deleted_count
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::CreateCanvasObjects { canvas_id, canvas_objects } => {
                                            println!(
                                                "Creating canvas_objects in database for canvas {} ...",
                                                canvas_id
                                            );

                                            let canvas_obj_docs: Vec<CanvasObjectMongoDBView> =
                                                canvas_objects
                                                    .iter()
                                                    .map(|(obj_id, canvas_object)| {
                                                        CanvasObjectMongoDBView {
                                                            id: *obj_id,
                                                            canvas_id: *canvas_id,
                                                            canvas_object: canvas_object.clone(),
                                                        }
                                                    })
                                                    .collect();

                                            let create_canvas_objects_res =
                                                canvas_object_coll.insert_many(&canvas_obj_docs).await;

                                            match create_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvasObjects insert failed: {}", e);
                                                }
                                                Ok(insert) => {
                                                    eprintln!(
                                                        "CreateCanvasObjects new document ids: {:?}",
                                                        insert.inserted_ids
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::UpdateCanvasObjects { canvas_id, canvas_objects } => {
                                            println!(
                                                "Updating canvas_objects in database for canvas {} ...",
                                                canvas_id
                                            );

                                            for (obj_id, canvas_object) in canvas_objects.iter() {
                                                let query_doc = doc! { "_id": *obj_id };
                                                let canvas_obj_doc = CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: *canvas_id,
                                                    canvas_object: canvas_object.clone(),
                                                };

                                                let replace_canvas_object_res = canvas_object_coll
                                                    .replace_one(query_doc, &canvas_obj_doc)
                                                    .await;

                                                match replace_canvas_object_res {
                                                    Err(e) => {
                                                        eprintln!(
                                                            "UpdateCanvasObjects replace failed: {}",
                                                            e
                                                        );
                                                    }
                                                    Ok(update) => {
                                                        eprintln!(
                                                            "UpdateCanvasObjects matched_count: {}",
                                                            update.matched_count
                                                        );
                                                        eprintln!(
                                                            "UpdateCanvasObjects modified_count: {}",
                                                            update.modified_count
                                                        );
                                                        eprintln!(
                                                            "UpdateCanvasObjects upserted_id: {:?}",
                                                            update.upserted_id
                                                        );
                                                    }
                                                };
                                            } // end for (obj_id, canvas_object) in canvas_objects.iter()
                                        }
                                        WhiteboardDiff::DeleteCanvasObjects {
                                            canvas_object_ids,
                                        } => {
                                            println!(
                                                "Deleting canvas objects in database: {:?}",
                                                canvas_object_ids
                                            );

                                            let filter = doc! {
                                                "_id": {
                                                    "$in": canvas_object_ids.clone()
                                                }
                                            };
                                            let delete_canvas_objects_res =
                                                canvas_object_coll.delete_many(filter).await;

                                            match delete_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers update failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers deleted: {}",
                                                        update.deleted_count
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::UpdateCanvasAllowedUsers {
                                            canvas_id,
                                            allowed_users,
                                        } => {
                                            println!(
                                                "Updating allowed users in database for canvas {} ...",
                                                canvas_id
                                            );

                                            let query = doc! {
                                                "_id": canvas_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "allowed_users": allowed_users.clone()
                                                }
                                            };

                                            let update_allowed_users_res =
                                                canvas_coll.update_one(query, operator).await;

                                            match update_allowed_users_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers update failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "UpdateCanvasAllowedUsers upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::TransferChildCanvases {
                                            old_parent_id,
                                            new_parent_id,
                                            translate_x,
                                            translate_y,
                                        } => {
                                            println!(
                                                "Transfering child canvases from canvas {} to canvas {} ...",
                                                old_parent_id, new_parent_id
                                            );

                                            let query = doc! {
                                                "parent_canvas.canvas_id": old_parent_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "parent_canvas.canvas_id": new_parent_id,
                                                },
                                                "$inc": {
                                                    "parent_canvas.origin_x": translate_x,
                                                    "parent_canvas.origin_y": translate_y,
                                                },
                                            };

                                            let update_canvases_res =
                                                canvas_coll.update_many(query, operator).await;

                                            match update_canvases_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvases failed: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvases matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvases modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvases upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                        WhiteboardDiff::TransferCanvasObjects {
                                            old_canvas_id,
                                            new_canvas_id,
                                            translate_x,
                                            translate_y,
                                        } => {
                                            println!(
                                                "Transfering canvas_objects from canvas {} to canvas {} ...",
                                                old_canvas_id, new_canvas_id
                                            );

                                            // query for vectors
                                            let query_vec = doc! {
                                                "canvas_id": old_canvas_id,
                                                "type": "vector",
                                            };

                                            // operator for vectors
                                            let operator_vec = doc! {
                                                "$set": {
                                                    "canvas_id": new_canvas_id,
                                                },
                                                "$inc": {
                                                    "points.0": translate_x,
                                                    "points.1": translate_y,
                                                    "points.2": translate_x,
                                                    "points.3": translate_y,
                                                },
                                            };

                                            let update_vectors_res = canvas_object_coll
                                                .update_many(query_vec, operator_vec)
                                                .await;

                                            match update_vectors_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvases failed on vectors: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on vectors upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };

                                            // query for other canvas objects
                                            let query = doc! {
                                                "canvas_id": old_canvas_id,
                                                "type": {
                                                    "$ne": "vector",
                                                },
                                            };

                                            // operator for other canvas objects
                                            let operator = doc! {
                                                "$set": {
                                                    "canvas_id": new_canvas_id,
                                                },
                                                "$inc": {
                                                    "x": translate_x,
                                                    "y": translate_y,
                                                },
                                            };

                                            let update_objects_res =
                                                canvas_object_coll.update_many(query, operator).await;

                                            match update_objects_res {
                                                Err(e) => {
                                                    eprintln!(
                                                        "TransferChildCanvases failed on non-vectors: {}",
                                                        e
                                                    );
                                                }
                                                Ok(update) => {
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors matched_count: {}",
                                                        update.matched_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors modified_count: {}",
                                                        update.modified_count
                                                    );
                                                    eprintln!(
                                                        "TransferChildCanvasObjects on non-vectors upserted_id: {:?}",
                                                        update.upserted_id
                                                    );
                                                }
                                            };
                                        }
                                    }
                                } // -- end for &diff in diffs

                                // -- clear diffs
                                diffs.clear();
                            }
                        }

                        // -- send response to clients, if requested
                        for r in resp.messages.iter() {
                            tx.send(r.clone()).ok();
                        }// -- end for r
                    }
                } // end while let Some(Ok(msg)) = user_ws_rx.next().await
            }
        })
    };

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    };

    // Clean up when client disconnects
    {
        let mut clients = shared_whiteboard_entry.active_clients.lock().await;
        let mut selectors_to_canvas_objects = shared_whiteboard_entry
            .selectors_to_canvas_objects.lock().await;

        clients.remove(&current_client_id);
        selectors_to_canvas_objects.remove_key(&current_client_id);

        // -- notify other clients of client disconnect
        let _ = tx.send(ServerSocketMessage::Broadcast {
            msg: ServerSocketBroadcastMessage::LogoutUsers {
                clients: Vec::<ClientIdType>::from_iter([current_client_id.clone()]),
            },
        });
    }

    println!("Client {} disconnected", current_client_id);
} // -- end handle_connection
