// -- standard library imports

use std::{
    env,
    process,
    sync::Arc,
    net::SocketAddr,
    collections::HashMap,
    cmp::Ordering,
};

use futures::{
    lock::Mutex,
    SinkExt,
    StreamExt,
};

// -- third party imports

use tokio::sync::broadcast;
use warp::ws::{Message, WebSocket};
use warp::Filter;

use mongodb::{
    Collection,
    bson::{
        self,
        doc,
        oid::ObjectId,
    }
};

// -- local imports

use web_socket_server::*;

#[tokio::main]
async fn main() -> process::ExitCode {
    let port = 3000u16;
    let jwt_secret = match env::var("JWT_SECRET") {
        Err(e) => {
            eprintln!("Could not find $JWT_SECRET: {}", e);
            return process::ExitCode::FAILURE;
        },
        Ok(secret) => secret
    };
    let mongo_uri = match env::var("MONGO_URI") {
        Err(e) => {
            eprintln!("Could not find $MONGO_URI: {}", e);
            return process::ExitCode::FAILURE;
        },
        Ok(uri) => uri
    };
    let mongo_client = match connect_mongodb(mongo_uri.as_str()).await {
        Err(e) => {
            eprintln!("Could not connect to mongodb at {}: {}", &mongo_uri, e);
            return process::ExitCode::FAILURE;
        },
        Ok(client) => client
    };
    // broadcaster for initial whiteboard

    let connection_state_ref = Arc::new(ConnectionState{
        jwt_secret: jwt_secret.clone(),
        next_client_id_index: Mutex::new(0),
        mongo_client,
        program_state: ProgramState{
            whiteboards: Mutex::new(HashMap::new()),
        }
    });

    let connection_state_ref_filter = warp::any().map({
        let connection_state_ref = Arc::clone(&connection_state_ref);
        move || Arc::clone(&connection_state_ref)
    });

    let ws_route = warp::path!("ws" / WhiteboardIdType)
        .and(warp::ws())
        .and(connection_state_ref_filter)
        .map(|wid: WhiteboardIdType, ws: warp::ws::Ws, connection_state_ref| {
            ws.on_upgrade(move |socket| handle_connection(socket, wid, connection_state_ref))
        });

    let addr: SocketAddr = ([0, 0, 0, 0], port).into();
    println!("Rust WebSocket server running at ws://{}", addr);
    warp::serve(ws_route).run(addr).await;

    process::ExitCode::SUCCESS
}// end async fn main()

async fn handle_connection(ws: WebSocket, whiteboard_id: WhiteboardIdType, connection_state_ref: Arc<ConnectionState>) {
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    let db = match connection_state_ref
        .mongo_client
        .default_database() {
            None => {
                // No database specified in mongo uri
                // Print error and disconnect early
                panic!("Database connection error; could not fetch whiteboard - no default database defined in mongo uri");
            },
            Some(db) => db
    };

    let current_client_id = {
        let mut next_client_id_index = connection_state_ref.next_client_id_index.lock().await;
        let client_id = generate_unique_client_id(whiteboard_id, *next_client_id_index);

        *next_client_id_index += 1;
        client_id
    };

    println!("New client: {}", current_client_id);

    let shared_whiteboard_entry : SharedWhiteboardEntry = {
        // - Fetch whiteboard identified by id from program state
        // - If no such whiteboard, send an individual error message and disconnect
        let mut whiteboards_by_id = connection_state_ref.program_state.whiteboards.lock().await;
        let whiteboard_res = whiteboards_by_id.get(&whiteboard_id);

        match &whiteboard_res {
            &None => {
                // Try to fetch whiteboard from the database.
                // If present, load into cache.
                // Otherwise, return (disconnect) early.
                match get_whiteboard_by_id(&db, &whiteboard_id).await {
                    Err(e) => {
                        eprintln!("Could not fetch whiteboard from database: {}", e);

                        let err_msg = ServerSocketMessage::IndividualError {
                            client_id: current_client_id.clone(),
                            error: ClientError::Other {
                                message: format!("Error occurred fetching whiteboard {}", whiteboard_id),
                            },
                        };

                        let _ = user_ws_tx.send(Message::text(serde_json::to_string(&err_msg).unwrap())).await;

                        return;
                    },
                    Ok(None) => {
                        // connection error: print and disconnect
                        eprintln!("Connection error; could not fetch whiteboard: not found in database");

                        let err_msg = ServerSocketMessage::IndividualError {
                            client_id: current_client_id.clone(),
                            error: ClientError::WhiteboardNotFound {
                                whiteboard_id: whiteboard_id.to_string(),
                            },
                        };
                        
                        let _ = user_ws_tx.send(Message::text(serde_json::to_string(&err_msg).unwrap())).await;

                        return;
                    },
                    Ok(Some(whiteboard)) => {
                        let whiteboard_id = whiteboard.id.clone();
                        let whiteboard_ref = Arc::new(Mutex::new(whiteboard));

                        // sender
                        // TODO: replace 100 with value from a config
                        let (tx, _rx) = broadcast::channel::<ServerSocketMessage>(100);
                        let shared_whiteboard_entry = SharedWhiteboardEntry {
                            whiteboard_ref: Arc::clone(&whiteboard_ref),
                            whiteboard_id: whiteboard_id.clone(),
                            broadcaster: tx.clone(),
                            active_clients: Arc::new(Mutex::new(HashMap::new())),
                            diffs: Arc::new(Mutex::new(Vec::new())),
                        };

                        // insert whiteboard into cache
                        whiteboards_by_id.insert(whiteboard_id, shared_whiteboard_entry.clone());

                        println!("Successfully fetched whiteboard {} from database", whiteboard_id);

                        // return new shared whiteboard entry
                        shared_whiteboard_entry.clone()
                    }
                }
            },
            &Some(shared_whiteboard_entry) => shared_whiteboard_entry.clone()
        }
    };

    // -- subscribe to broadcaster
    let tx = shared_whiteboard_entry.broadcaster.clone();
    let mut rx = tx.subscribe();

    // -- create client state
    let client_state_ref = Arc::new(ClientState {
        client_id: current_client_id.clone(),
        user_summary: Mutex::new(None),
        jwt_secret: connection_state_ref.jwt_secret.clone(),
        // None = user unauthenticated
        user_whiteboard_permission: Mutex::new(None),
        whiteboard_ref: Arc::clone(&shared_whiteboard_entry.whiteboard_ref),
        active_clients: Arc::clone(&shared_whiteboard_entry.active_clients),
        diffs: Arc::clone(&shared_whiteboard_entry.diffs)
    });

    let send_task = {
        let current_client_id = current_client_id.clone();

        tokio::spawn(async move {
            while let Ok(msg) = rx.recv().await {
                if let ServerSocketMessage::IndividualError { ref client_id, .. } = msg {
                    if let Ordering::Equal = client_id.cmp(&current_client_id) {
                        let json = serde_json::to_string(&msg).unwrap();
                        if user_ws_tx.send(Message::text(json)).await.is_err() {
                            break;
                        }
                    }
                } else {
                    let json = serde_json::to_string(&msg).unwrap();
                    if user_ws_tx.send(Message::text(json)).await.is_err() {
                        break;
                    }
                }
            }
        })
    };// -- end send_task

    let recv_task = {
        let current_client_id = current_client_id.clone();

        tokio::spawn({
            let tx = tx.clone();
            let client_state_ref = Arc::clone(&client_state_ref);
            let db = match connection_state_ref.mongo_client.default_database() {
                None => {
                    // No database specified in mongo uri
                    // Print error and disconnect early
                    eprintln!("Database connection error; could not fetch whiteboard - no default database defined in mongo uri");
                    let err_msg = ServerSocketMessage::IndividualError {
                        client_id: current_client_id.clone(),
                        error: ClientError::Other {
                            message: format!("Error fetching whiteboard {}", whiteboard_id),
                        },
                    };
                    
                    let _ = tx.send(err_msg);

                    return;
                },
                Some(db) => db
            };
            let whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView> = db.collection::<WhiteboardMetadataMongoDBView>(
                "whiteboards"
            );
            let canvas_coll: Collection<CanvasMongoDBView> = db.collection::<CanvasMongoDBView>(
                "canvases"
            );
            let shape_coll: Collection<CanvasObjectMongoDBView> = db.collection::<CanvasObjectMongoDBView>(
                "shapes"
            );
            let user_coll: Collection<UserMongoDBView> = db.collection::<UserMongoDBView>(
                "users"
            );
            let store = MongoDBStore::new(&user_coll, &whiteboard_metadata_coll);

            async move {
                // Handle client messages in this loop until user authenticates
                while let Some(Ok(msg)) = user_ws_rx.next().await {
                    println!("Client {} sent message ...", current_client_id);
                    if let Ok(msg_s) = msg.to_str() {
                        println!("Raw message: {}", msg_s);

                        let resp = handle_unauthenticated_client_message(
                            &client_state_ref,
                            &store,
                            msg_s
                        ).await;

                        if let Some(ref resp) = resp {
                            println!("Client response: {:?}", resp);
                        }

                        // -- update database, if there are diffs
                        {
                            let mut diffs = client_state_ref.diffs.lock().await;

                            if ! diffs.is_empty() {
                                for diff in diffs.iter() {
                                    match &diff {
                                        WhiteboardDiff::CreateCanvas { canvas } => {
                                            println!("Creating canvas \"{}\" in database ...", canvas.name);

                                            let now = bson::DateTime::now();
                                            let canvas_doc = CanvasMongoDBView {
                                                id: canvas.id,
                                                name: canvas.name.clone(),
                                                width: canvas.width,
                                                height: canvas.height,
                                                time_created: now.clone(),
                                                time_last_modified: now.clone(),
                                                parent_canvas: match &canvas.parent_canvas {
                                                    None => None,
                                                    Some(parent) => Some(
                                                        CanvasParentRefMongoDBView::from_canvas_parent_ref(parent)
                                                    ),
                                                },
                                                canvas_hierarchy: None,
                                                shapes: vec![],
                                                allowed_users: None,
                                            };
                                            let create_canvas_res = canvas_coll.insert_one(&canvas_doc).await;

                                            match create_canvas_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvas insert failed: {}", e);
                                                },
                                                Ok(insert) => {
                                                    eprintln!("CreateCanvas new document id: {}", insert.inserted_id);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::DeleteCanvases { canvas_ids } => {
                                            println!("Deleting canvases from database: {:?} ...", canvas_ids);

                                            // first delete contained canvas objects
                                            let delete_objects_res = shape_coll.delete_many(doc! {
                                                "canvas_id": {
                                                    "$in": canvas_ids.clone()
                                                }
                                            }).await;

                                            match delete_objects_res {
                                                Err(e) => {
                                                    eprintln!("DeleteCanvases object deletion failed: {}", e);
                                                },
                                                Ok(delete_result) => {
                                                    eprintln!("DeleteCanvases object deletion count {}", delete_result.deleted_count);
                                                }
                                            };

                                            // then, delete canvas itself
                                            let delete_canvas_res = canvas_coll.delete_many(doc! {
                                                "_id": {
                                                    "$in": canvas_ids.clone()
                                                }
                                            }).await;

                                            match delete_canvas_res {
                                                Err(e) => {
                                                    eprintln!("DeleteCanvases canvas deletion failed: {}", e);
                                                },
                                                Ok(delete_result) => {
                                                    eprintln!("DeleteCanvases canvas deletion count {}", delete_result.deleted_count);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::CreateShapes { canvas_id, shapes } => {
                                            println!("Creating shapes in database for canvas {} ...", canvas_id);

                                            let canvas_obj_docs : Vec<CanvasObjectMongoDBView> = shapes.iter()
                                                .map(|(obj_id, shape)| CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: canvas_id.clone(),
                                                    shape: shape.clone()
                                                })
                                                .collect();

                                            let create_shapes_res = shape_coll.insert_many(&canvas_obj_docs).await;

                                            match create_shapes_res {
                                                Err(e) => {
                                                    eprintln!("CreateShapes insert failed: {}", e);
                                                },
                                                Ok(insert) => {
                                                    eprintln!("CreateShapes new document ids: {:?}", insert.inserted_ids);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::UpdateShapes { canvas_id, shapes } => {
                                            println!("Updating shapes in database for canvas {} ...", canvas_id);

                                            for (obj_id, shape) in shapes.iter() {
                                                let query_doc = doc! { "_id": obj_id.clone() };
                                                let canvas_obj_doc = CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: canvas_id.clone(),
                                                    shape: shape.clone()
                                                };

                                                let replace_shape_res = shape_coll.replace_one(query_doc, &canvas_obj_doc).await;

                                                match replace_shape_res {
                                                    Err(e) => {
                                                        eprintln!("UpdateShapes replace failed: {}", e);
                                                    },
                                                    Ok(update) => {
                                                        eprintln!("UpdateShapes matched_count: {}", update.matched_count);
                                                        eprintln!("UpdateShapes modified_count: {}", update.modified_count);
                                                        eprintln!("UpdateShapes upserted_id: {:?}", update.upserted_id);
                                                    }
                                                };
                                            }// end for (obj_id, shape) in shapes.iter()
                                        },
                                        WhiteboardDiff::DeleteCanvasObjects { canvas_object_ids } => {
                                            println!("Deleting canvas objects in database");

                                            let filter = doc! {
                                                "_id": {
                                                    "$in": canvas_object_ids.clone()
                                                }
                                            };
                                            let delete_canvas_objects_res = canvas_coll.delete_many(filter).await;

                                            match delete_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!("UpdateCanvasAllowedUsers update failed: {}", e);
                                                },
                                                Ok(update) => {
                                                    eprintln!("UpdateCanvasAllowedUsers deleted: {}", update.deleted_count);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::UpdateCanvasAllowedUsers { canvas_id, allowed_users } => {
                                            println!("Updating allowed users in database for canvas {} ...", canvas_id);

                                            let query = doc! {
                                                "_id": canvas_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "allowed_users": allowed_users.clone()
                                                }
                                            };

                                            let update_allowed_users_res = canvas_coll.update_one(query, operator).await;

                                            match update_allowed_users_res {
                                                Err(e) => {
                                                    eprintln!("UpdateCanvasAllowedUsers update failed: {}", e);
                                                },
                                                Ok(update) => {
                                                    eprintln!("UpdateCanvasAllowedUsers matched_count: {}", update.matched_count);
                                                    eprintln!("UpdateCanvasAllowedUsers modified_count: {}", update.modified_count);
                                                    eprintln!("UpdateCanvasAllowedUsers upserted_id: {:?}", update.upserted_id);
                                                }
                                            };
                                        },
                                    }
                                }// -- end for &diff in diffs

                                // -- clear diffs
                                diffs.clear();
                            }
                        }

                        // -- send response to clients, if requested
                        if let Some(resp) = resp {
                            tx.send(resp).ok();
                        }
                    }

                    if let Some(_) = *client_state_ref.user_whiteboard_permission.lock().await {
                        // break if user has been authenticated (indicated by user_permission field
                        // being set in client state)

                        // First, notify all clients of new login
                        if let Some(ref user_summary) = *client_state_ref.user_summary.lock().await {
                            tx.send(ServerSocketMessage::LoginUsers{
                                users: vec![ user_summary.clone() ],
                            }).ok();
                        }

                        break;
                    }
                }// end while let Some(Ok(msg)) = user_ws_rx.next().await

                // Once client authenticates, handle client messages in this loop
                while let Some(Ok(msg)) = user_ws_rx.next().await {
                    println!("Client {} sent message ...", current_client_id);
                    if let Ok(msg_s) = msg.to_str() {
                        println!("Raw message: {}", msg_s);

                        let resp = handle_authenticated_client_message(
                            &client_state_ref,
                            msg_s
                        ).await;

                        if let Some(ref resp) = resp {
                            println!("Client response: {:?}", resp);
                        }

                        // -- update database, if there are diffs
                        {
                            let mut diffs = client_state_ref.diffs.lock().await;

                            if ! diffs.is_empty() {
                                for diff in diffs.iter() {
                                    match &diff {
                                        WhiteboardDiff::CreateCanvas { canvas } => {
                                            println!("Creating canvas \"{}\" in database ...", canvas.name);

                                            let now = bson::DateTime::now();
                                            let canvas_doc = CanvasMongoDBView {
                                                id: ObjectId::new(),
                                                name: canvas.name.clone(),
                                                width: canvas.width,
                                                height: canvas.height,
                                                time_created: now.clone(),
                                                time_last_modified: now.clone(),
                                                parent_canvas: match &canvas.parent_canvas {
                                                    None => None,
                                                    Some(parent) => Some(
                                                        CanvasParentRefMongoDBView::from_canvas_parent_ref(parent)
                                                    ),
                                                },
                                                canvas_hierarchy: None,
                                                shapes: vec![],
                                                allowed_users: None,
                                            };
                                            let create_canvas_res = canvas_coll.insert_one(&canvas_doc).await;

                                            match create_canvas_res {
                                                Err(e) => {
                                                    eprintln!("CreateCanvas insert failed: {}", e);
                                                },
                                                Ok(insert) => {
                                                    eprintln!("CreateCanvas new document id: {}", insert.inserted_id);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::DeleteCanvases { canvas_ids } => {
                                            println!("Deleting canvases from database: {:?} ...", canvas_ids);

                                            // first delete contained canvas objects
                                            let delete_objects_res = shape_coll.delete_many(doc! {
                                                "canvas_id": {
                                                    "$in": canvas_ids.clone()
                                                }
                                            }).await;

                                            match delete_objects_res {
                                                Err(e) => {
                                                    eprintln!("DeleteCanvases object deletion failed: {}", e);
                                                },
                                                Ok(delete_result) => {
                                                    eprintln!("DeleteCanvases object deletion count {}", delete_result.deleted_count);
                                                }
                                            };

                                            // then, delete canvas itself
                                            let delete_canvas_res = canvas_coll.delete_many(doc! {
                                                "_id": {
                                                    "$in": canvas_ids.clone()
                                                }
                                            }).await;

                                            match delete_canvas_res {
                                                Err(e) => {
                                                    eprintln!("DeleteCanvases canvas deletion failed: {}", e);
                                                },
                                                Ok(delete_result) => {
                                                    eprintln!("DeleteCanvases canvas deletion count {}", delete_result.deleted_count);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::CreateShapes { canvas_id, shapes } => {
                                            println!("Creating shapes in database for canvas {} ...", canvas_id);

                                            let canvas_obj_docs : Vec<CanvasObjectMongoDBView> = shapes.iter()
                                                .map(|(obj_id, shape)| CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: canvas_id.clone(),
                                                    shape: shape.clone()
                                                })
                                                .collect();

                                            let create_shapes_res = shape_coll.insert_many(&canvas_obj_docs).await;

                                            match create_shapes_res {
                                                Err(e) => {
                                                    eprintln!("CreateShapes insert failed: {}", e);
                                                },
                                                Ok(insert) => {
                                                    eprintln!("CreateShapes new document ids: {:?}", insert.inserted_ids);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::UpdateShapes { canvas_id, shapes } => {
                                            println!("Updating shapes in database for canvas {} ...", canvas_id);

                                            for (obj_id, shape) in shapes.iter() {
                                                let query_doc = doc! { "_id": obj_id.clone() };
                                                let canvas_obj_doc = CanvasObjectMongoDBView {
                                                    id: *obj_id,
                                                    canvas_id: canvas_id.clone(),
                                                    shape: shape.clone()
                                                };

                                                let replace_shape_res = shape_coll.replace_one(query_doc, &canvas_obj_doc).await;

                                                match replace_shape_res {
                                                    Err(e) => {
                                                        eprintln!("UpdateShapes replace failed: {}", e);
                                                    },
                                                    Ok(update) => {
                                                        eprintln!("UpdateShapes matched_count: {}", update.matched_count);
                                                        eprintln!("UpdateShapes modified_count: {}", update.modified_count);
                                                        eprintln!("UpdateShapes upserted_id: {:?}", update.upserted_id);
                                                    }
                                                };
                                            }// end for (obj_id, shape) in shapes.iter()
                                        },
                                        WhiteboardDiff::DeleteCanvasObjects { canvas_object_ids } => {
                                            println!("Deleting canvas objects in database");

                                            let filter = doc! {
                                                "_id": {
                                                    "$in": canvas_object_ids.clone()
                                                }
                                            };
                                            let delete_canvas_objects_res = canvas_coll.delete_many(filter).await;

                                            match delete_canvas_objects_res {
                                                Err(e) => {
                                                    eprintln!("UpdateCanvasAllowedUsers update failed: {}", e);
                                                },
                                                Ok(update) => {
                                                    eprintln!("UpdateCanvasAllowedUsers deleted: {}", update.deleted_count);
                                                }
                                            };
                                        },
                                        WhiteboardDiff::UpdateCanvasAllowedUsers { canvas_id, allowed_users } => {
                                            println!("Updating allowed users in database for canvas {} ...", canvas_id);

                                            let query = doc! {
                                                "_id": canvas_id,
                                            };

                                            let operator = doc! {
                                                "$set": {
                                                    "allowed_users": allowed_users.clone()
                                                }
                                            };

                                            let update_allowed_users_res = canvas_coll.update_one(query, operator).await;

                                            match update_allowed_users_res {
                                                Err(e) => {
                                                    eprintln!("UpdateCanvasAllowedUsers update failed: {}", e);
                                                },
                                                Ok(update) => {
                                                    eprintln!("UpdateCanvasAllowedUsers matched_count: {}", update.matched_count);
                                                    eprintln!("UpdateCanvasAllowedUsers modified_count: {}", update.modified_count);
                                                    eprintln!("UpdateCanvasAllowedUsers upserted_id: {:?}", update.upserted_id);
                                                }
                                            };
                                        },
                                    }
                                }// -- end for &diff in diffs

                                // -- clear diffs
                                diffs.clear();
                            }
                        }

                        // -- send response to clients, if requested
                        if let Some(resp) = resp {
                            tx.send(resp).ok();
                        }
                    }
                }// end while let Some(Ok(msg)) = user_ws_rx.next().await
            }
        })
    };

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Clean up when client disconnects
    {
        let mut clients = shared_whiteboard_entry.active_clients.lock().await;

        clients.remove(&current_client_id);

        // -- notify other clients of client disconnect
        let _ = tx.send(ServerSocketMessage::LogoutUsers{ clients: Vec::<ClientIdType>::from_iter([
                current_client_id.clone(),
            ])
        });
    }

    println!("Client {} disconnected", current_client_id);
}
