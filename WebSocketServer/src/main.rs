mod wss;

// -- standard library imports

use std::{cmp::Ordering, collections::HashMap, env, net::SocketAddr, process, sync::Arc};

use futures::{SinkExt, StreamExt, lock::Mutex};

// -- third party imports

use tokio::sync::broadcast;
use warp::Filter;
use warp::ws::{Message, WebSocket};

use mongodb::{
    bson,
};

// -- local imports

#[tokio::main]
async fn main() -> process::ExitCode {
    use wss::{
        db::connect_mongodb,
        models::{
            WhiteboardIdType,
            WhiteboardMongoDBView,
            WhiteboardPermissionEnumClientView,
            WhiteboardVisibilityEnum,
        },
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
    let whiteboard_watcher_thread = {
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
            let mut wb_change_stream = match whiteboard_coll.watch()
                    .full_document(mongodb::options::FullDocumentType::UpdateLookup)
                    .await {
                Err(e) => panic!(
                    "Could not subscribe to change stream on whiteboards collection: {}",
                    e
                ),
                Ok(stream) => stream,
            };

            // TODO: replace while-let with loop that includes error logging
            'next_event: while let Ok(Some(event)) = wb_change_stream.next().await.transpose() {
                match event.operation_type {
                    // -- check for permission updates
                    mongodb::change_stream::event::OperationType::Update => {
                        if let Some(curr_doc) = event.full_document {
                            let mut whiteboards =
                                connection_state_ref.program_state.whiteboards.lock().await;

                            if let Some(wb_entry) = whiteboards.get_mut(&curr_doc.id) {
                                let mut wb = wb_entry.whiteboard_ref.lock().await;
                                let mut messages_to_clients = Vec::<ServerSocketMessage>::new();

                                // -- check that permissions have changed
                                'check_relevant_change: {
                                    let wb_meta = wb.metadata();
                                    let n_prev_perms = wb_meta.permissions_by_user_id().len()
                                        + wb_meta.permissions_by_email().len();

                                    if wb_meta.name() != curr_doc.metadata.name {
                                        messages_to_clients.push(ServerSocketMessage::Broadcast {
                                            msg: ServerSocketBroadcastMessage::UpdateWhiteboardMetadata {
                                                name: Some(curr_doc.metadata.name.clone()),
                                            },
                                        });
                                        // -- Proceed to metadata update
                                    } else if n_prev_perms == curr_doc.metadata.user_permissions.len() {
                                        for perm in curr_doc.metadata.user_permissions.iter() {
                                            match &perm.permission_type {
                                                wss::models::WhiteboardPermissionType::User {
                                                    user: user_id,
                                                    ..
                                                } => {
                                                    if let Some(prev_perm) = wb_meta.permissions_by_user_id().get(&user_id) {
                                                        if *prev_perm != perm.permission {
                                                            break 'check_relevant_change;
                                                        }
                                                    } else {
                                                        break 'check_relevant_change;
                                                    }
                                                },
                                                wss::models::WhiteboardPermissionType::Email {
                                                    email,
                                                } => {
                                                    if let Some(prev_perm) = wb_meta.permissions_by_email().get(email.as_str()) {
                                                        if *prev_perm != perm.permission {
                                                            break 'check_relevant_change;
                                                        }
                                                    } else {
                                                        break 'check_relevant_change;
                                                    }
                                                },
                                            };// -- end match
                                        }// -- end for perm

                                        continue 'next_event;
                                    }
                                }// -- end 'check_relevant_change

                                // -- change permissions in metadata
                                wb.set_permissions(curr_doc.metadata.user_permissions.as_slice());

                                let wb_meta = wb.metadata();

                                messages_to_clients.push(ServerSocketMessage::Broadcast {
                                    msg: ServerSocketBroadcastMessage::SetPermissions {
                                        permissions_by_user_id: wb_meta.permissions_by_user_id().iter()
                                            .map(|(uid, perm)| (uid.clone(), WhiteboardPermissionEnumClientView::from_permission_enum(&perm)))
                                            .collect(),
                                        permissions_by_email: wb_meta.permissions_by_email().iter()
                                            .map(|(email, perm)| (email.clone(), WhiteboardPermissionEnumClientView::from_permission_enum(&perm)))
                                            .collect(),
                                    },
                                });

                                // -- evict users whose permissions have been revoked if the
                                // whiteboard is private
                                if wb_meta.visibility() == WhiteboardVisibilityEnum::Private {
                                    let clients_by_user_id = wb_entry.clients_by_user_id.lock().await;

                                    // -- evict users whose permissions have been completely removed
                                    for (user_id, client_id) in clients_by_user_id.iter() {
                                        if ! wb_meta.permissions_by_user_id().contains_key(user_id) {
                                            messages_to_clients.push(ServerSocketMessage::Evict {
                                                evicted_client_id: client_id.clone(),
                                                reason: String::from("Access revoked"),
                                            });
                                        }
                                    }// -- end for user_id, client_id
                                }

                                // -- broadcast updated permissions to clients
                                while let Some(msg) = messages_to_clients.pop() {
                                    let _ = wb_entry.broadcaster.send(msg);
                                }// -- end for msg
                            }
                        }
                    },
                    // -- whiteboard deleted
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
    }; // -- end let whiteboard_watcher_thread

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

    // -- abort and reap whiteboard watcher thread
    whiteboard_watcher_thread.abort();
    let _ = whiteboard_watcher_thread.await;

    process::ExitCode::SUCCESS
} // end async fn main()

async fn handle_connection(
    ws: WebSocket,
    whiteboard_id: wss::models::WhiteboardIdType,
    connection_state_ref: Arc<wss::server::ConnectionState>,
) {
    use wss::{
        db::{MongoDBInterface, get_whiteboard_by_id},
        models::{
            ClientIdType,
        },
        protocol::{
            ClientError,
            ServerSocketMessage,
            ServerSocketBroadcastMessage,
            ServerSocketIndividualMessage,
        },
        server::{
            ClientStateBase, SharedWhiteboardEntry,
            handle_authenticated_client_message,
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
                            clients_by_user_id: Arc::new(Mutex::new(collections::OneToMany::new())),
                            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
                            edits: Arc::new(Mutex::new(Vec::new())),
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
        clients_by_user_id: Arc::clone(&shared_whiteboard_entry.clients_by_user_id),
        selectors_to_canvas_objects: Arc::clone(
            &shared_whiteboard_entry.selectors_to_canvas_objects
        ),
        edits: Arc::clone(&shared_whiteboard_entry.edits),
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
                    Evict {
                        evicted_client_id,
                        reason,
                    } => {
                        if matches!(evicted_client_id.cmp(&current_client_id), Ordering::Equal) {
                            // -- send eviction notification and disconnect
                            let json = serde_json::to_string(&ServerSocketIndividualMessage::Evict {
                                reason,
                            }).unwrap();

                            let _ = user_ws_tx.send(Message::text(json)).await;
                            break;
                        }
                    }
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

                   if let Err(e) = tx.send(err_msg) {
                       eprintln!("ERROR: failed to send message to client: {:?}", e);
                   }

                    return;
                }
                Some(db) => db,
            };
            let mongo_interface = MongoDBInterface::new(&db);

            async move {
                // Handle client messages in this loop
                loop {
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
                        let resp = if let Some(auth_state) = client_state_base.authenticated_state().await {
                            handle_authenticated_client_message(&auth_state, msg_s).await
                        } else {
                            handle_unauthenticated_client_message(&client_state_base, &mongo_interface, msg_s)
                                .await
                                .base
                        };// -- end let resp

                        // -- update database, if there are edits
                        {
                            let mut edits = client_state_base.edits.lock().await;

                            // -- update local edit history
                            
                            for edit in edits.iter() {
                                mongo_interface.process_edit(edit).await;
                            }// -- end for edit in edits.iter()

                            edits.clear();
                        }


                        // -- send response to clients, if requested
                        for r in resp.messages.iter() {
                           if let Err(e) = tx.send(r.clone()) {
                               eprintln!("ERROR: failed to send message to client: {:?}", e);
                           }
                        }// -- end for r
                    }
                }// -- end loop
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
        let mut clients_by_user_id = shared_whiteboard_entry.clients_by_user_id.lock().await;
        let mut selectors_to_canvas_objects = shared_whiteboard_entry
            .selectors_to_canvas_objects.lock().await;

        clients.remove(&current_client_id);
        clients_by_user_id.remove_value(&current_client_id);
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
