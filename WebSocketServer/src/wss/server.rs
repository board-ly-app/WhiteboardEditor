use super::{db::WhiteboardDiff, models::*, protocol::*, store::*};

use futures::lock::Mutex;

use chrono::Utc;

use tokio::sync::broadcast;

use mongodb::{Client, bson::oid::ObjectId};

use serde::{self, Deserialize, Serialize};

use std::{collections::HashMap, sync::Arc};

// === SharedWhiteboardEntry ======================================================================
//
// Contains a Whiteboard's data plus necessary objects for managing user connections to the
// whiteboard, including the Sender.
//
// ================================================================================================
#[derive(Clone, Debug)]
pub struct SharedWhiteboardEntry {
    pub whiteboard_ref: Arc<Mutex<Whiteboard>>,
    pub whiteboard_id: WhiteboardIdType,
    pub broadcaster: broadcast::Sender<ServerSocketMessage>,
    pub active_clients: Arc<Mutex<HashMap<ClientIdType, UserSummary>>>,
    pub diffs: Arc<Mutex<Vec<WhiteboardDiff>>>,
} // -- end pub struct SharedWhiteboardEntry

// === Program State ==============================================================================
//
// Holds all program state that a web socket connection may need to manipulate.
//
// Encapsulating all program state in a single thread-safe object allows for efficient testing and
// passing of state between threads.
//
// ================================================================================================
#[derive(Debug)]
pub struct ProgramState {
    pub whiteboards: Mutex<HashMap<WhiteboardIdType, SharedWhiteboardEntry>>,
} // -- end pub struct ProgramState

// === ClientState ================================================================================
//
// Encapsulate all state a thread needs to handle a single client.
//
// ================================================================================================
#[derive(Debug)]
pub struct ClientState {
    pub client_id: ClientIdType,
    pub user_summary: Mutex<Option<UserSummary>>,
    pub whiteboard_ref: Arc<Mutex<Whiteboard>>,
    pub jwt_secret: String,
    // The permission (view/edit/own) the user has on the current whiteboard
    pub user_whiteboard_permission: Mutex<Option<WhiteboardPermissionEnum>>,
    pub active_clients: Arc<Mutex<HashMap<ClientIdType, UserSummary>>>,
    pub diffs: Arc<Mutex<Vec<WhiteboardDiff>>>,
} // -- end pub struct ClientState

// === Connection State ===========================================================================
//
// Holds program state plus data necessary for broadcasting to clients and managing connections.
//
// ================================================================================================
#[derive(Debug)]
pub struct ConnectionState {
    pub jwt_secret: String,
    pub mongo_client: Client,
    pub next_client_id_index: Mutex<i32>,
    pub program_state: ProgramState,
} // -- end pub struct ConnectionState

// -- utility struct for handle_authenticated_client_message, for inspecting raw client messages
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientMessageInspector {
    #[serde(rename = "type")]
    type_tag: String,
} // -- end ClientMessageInspector

// Handle raw messages from clients. Assume client has already authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                      -- (Optional) Message to send to clients, if any
pub async fn handle_authenticated_client_message(
    client_state: &ClientState,
    client_msg_s: &str,
) -> Option<ServerSocketMessage> {
    use ClientSocketMessage::*;

    match serde_json::from_str::<ClientSocketMessage>(client_msg_s) {
        Ok(client_msg) => {
            println!("Received message from client {}", client_state.client_id);

            // All actions below require at least edit permission, since they all involve
            // mutating state in some way. Hence, we check permissions first, and send back an
            // error message if the user only has view permission.
            let user_whiteboard_permission = {
                let perm = client_state.user_whiteboard_permission.lock().await;

                perm.clone()
            };

            match user_whiteboard_permission {
                None | Some(WhiteboardPermissionEnum::View) => {
                    let inspector = serde_json::from_str::<ClientMessageInspector>(client_msg_s)
                        .expect("Expected to find \"type\" tag in client message.");

                    return Some(ServerSocketMessage::IndividualError {
                        client_id: client_state.client_id.clone(),
                        error: ClientError::ActionForbidden {
                            action: inspector.type_tag,
                        },
                    });
                }
                // Proceed to next step.
                // Don't just use _ here to accept all other permissions: if we add a new
                // permission type, we want to make sure we handle it uniquely, in case it involves
                // more unique logic.
                Some(WhiteboardPermissionEnum::Edit) | Some(WhiteboardPermissionEnum::Own) => {}
            };

            match client_msg {
                // -- User already authenticated; return error
                Login { .. } => Some(ServerSocketMessage::IndividualError {
                    client_id: client_state.client_id.clone(),
                    error: ClientError::AlreadyAuthorized,
                }),
                EditingCanvas { canvas_id } => {
                    // TODO: validate that canvas id is valid and user has permission to edit
                    // canvas.
                    Some(ServerSocketMessage::EditingCanvas {
                        client_id: client_state.client_id.clone(),
                        canvas_id: canvas_id,
                    })
                }
                CreateShapes {
                    canvas_id,
                    ref shapes,
                } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    println!("Creating shape on canvas {} ...", canvas_id);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: canvas_id.to_string(),
                            },
                        }),
                        Some(canvas) => {
                            let mut new_shapes = HashMap::<CanvasObjectIdType, ShapeModel>::new();

                            for shape in shapes.iter() {
                                let obj_id = ObjectId::new();

                                new_shapes.insert(obj_id.clone(), shape.clone());
                                canvas.shapes_mut().insert(obj_id.clone(), shape.clone());
                            } // end for (idx, &mut shape) in new_shapes.iter_mut().enumerate()

                            // valid input: add to diffs
                            {
                                let mut diffs = client_state.diffs.lock().await;

                                diffs.push(WhiteboardDiff::CreateShapes {
                                    canvas_id,
                                    shapes: new_shapes.clone(),
                                });
                            }

                            Some(ServerSocketMessage::CreateShapes {
                                client_id: client_state.client_id.clone(),
                                canvas_id: canvas_id.to_string(),
                                shapes: new_shapes
                                    .iter()
                                    .map(|(obj_id, shape)| (obj_id.to_string(), shape.clone()))
                                    .collect(),
                            })
                        }
                    }
                }
                UpdateShapes {
                    canvas_id,
                    ref shapes,
                } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    println!("Updating shapes on canvas {} ...", canvas_id);
                    println!("Shapes: {:?}", shapes);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: canvas_id.to_string(),
                            },
                        }),
                        Some(canvas) => {
                            let mut new_shapes = HashMap::<CanvasObjectIdType, ShapeModel>::new();

                            for (obj_id_s, shape) in shapes.iter() {
                                match obj_id_s.parse::<CanvasObjectIdType>() {
                                    Ok(obj_id) => {
                                        if canvas.shapes().contains_key(&obj_id) {
                                            canvas.shapes_mut().insert(obj_id, shape.clone());
                                            new_shapes.insert(obj_id, shape.clone());
                                        }
                                    }
                                    Err(e) => {
                                        println!(
                                            "Could not parse \"{}\" into object id: {}",
                                            obj_id_s, e
                                        );
                                    }
                                };
                            } // end for (&obj_id, &shape) in shapes.iter_mut()
                            println!("New Shapes: {:?}", new_shapes);
                            // valid input: add to diffs
                            {
                                let mut diffs = client_state.diffs.lock().await;

                                diffs.push(WhiteboardDiff::UpdateShapes {
                                    canvas_id,
                                    shapes: new_shapes.clone(),
                                });
                            }

                            Some(ServerSocketMessage::UpdateShapes {
                                client_id: client_state.client_id.clone(),
                                canvas_id: canvas_id.to_string(),
                                shapes: new_shapes
                                    .iter()
                                    .map(|(obj_id, shape)| (obj_id.to_string(), shape.clone()))
                                    .collect(),
                            })
                        }
                    }
                }
                DeleteCanvasObjects { canvas_object_ids } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // Delete objects locally
                    for canvas in whiteboard.canvases_mut().values_mut() {
                        // TODO: refactor to store all canvas objects in one large HashMap
                        for object_id in canvas_object_ids.iter() {
                            canvas.shapes_mut().remove(object_id);
                        } // -- end for object_id
                    } // -- end for let mut canvas

                    // Store diffs to trigger deletion in database
                    {
                        let mut diffs = client_state.diffs.lock().await;

                        diffs.push(WhiteboardDiff::DeleteCanvasObjects {
                            canvas_object_ids: canvas_object_ids.clone(),
                        });
                    }

                    // Forward message to clients
                    Some(ServerSocketMessage::DeleteCanvasObjects {
                        client_id: client_state.client_id.clone(),
                        canvas_object_ids: canvas_object_ids
                            .into_iter()
                            .map(|oid| oid.to_string())
                            .collect(),
                    })
                }
                CreateCanvas {
                    name,
                    width,
                    height,
                    parent_canvas,
                    allowed_users,
                } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    let new_canvas_id = ObjectId::new();

                    // -- allowed_users passed in as parameter from AllowedUsersPopover
                    // let mut allowed = HashSet::<ObjectId>::new();

                    // Initialize new canvas with only current user allowed to edit
                    // TODO: actually fetch user's id from database
                    // allowed_users.insert(ObjectId::new());

                    // instantiate new canvas
                    let canvas = Canvas::new(
                        &new_canvas_id,
                        width,
                        height,
                        name.as_str(),
                        &Utc::now(),
                        &Utc::now(),
                        Some(&parent_canvas.to_canvas_parent_ref()),
                        HashMap::<CanvasObjectIdType, ShapeModel>::new(),
                        Some(allowed_users),
                    );

                    whiteboard
                        .canvases_mut()
                        .insert(new_canvas_id, canvas.clone());

                    // valid input: add to diffs
                    {
                        let mut diffs = client_state.diffs.lock().await;

                        diffs.push(WhiteboardDiff::CreateCanvas {
                            canvas: canvas.clone(),
                        });
                    }

                    Some(ServerSocketMessage::CreateCanvas {
                        client_id: client_state.client_id.clone(),
                        canvas: canvas.to_client_view(),
                    })
                }
                DeleteCanvases { canvas_ids } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // delete canvases identified by the given ids
                    for id in &canvas_ids {
                        whiteboard.canvases_mut().remove(&id);
                    } // end for id in canvas_ids

                    // valid message: add to diffs
                    {
                        let mut diffs = client_state.diffs.lock().await;

                        diffs.push(WhiteboardDiff::DeleteCanvases {
                            canvas_ids: canvas_ids.clone(),
                        });
                    }

                    Some(ServerSocketMessage::DeleteCanvases {
                        client_id: client_state.client_id.clone(),
                        canvas_ids: canvas_ids.iter().map(|id| id.to_string()).collect(),
                    })
                }
                UpdateCanvasAllowedUsers {
                    canvas_id,
                    allowed_users,
                } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // -- ensure all allowed users are valid users who have edit or own permission
                    for user_id in allowed_users.iter() {
                        match whiteboard
                            .metadata()
                            .permission_for_user(&user_id.to_string())
                        {
                            None => {
                                return Some(ServerSocketMessage::IndividualError {
                                    client_id: client_state.client_id.clone(),
                                    error: ClientError::Other {
                                        message: format!("User {} not found", user_id),
                                    },
                                });
                            }
                            Some(perm) => match perm {
                                WhiteboardPermissionEnum::Own => {}
                                _ => {
                                    return Some(ServerSocketMessage::IndividualError {
                                        client_id: client_state.client_id.clone(),
                                        error: ClientError::Other {
                                            message: String::from(
                                                "You cannot change a canvas' allowed users as a non-owner",
                                            ),
                                        },
                                    });
                                }
                            },
                        };
                    } // -- end for user_id in allowed_users.iter()

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => {
                            // canvas doesn't exist
                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::CanvasNotFound {
                                    canvas_id: canvas_id.to_string(),
                                },
                            });
                        }
                        Some(canvas) => {
                            // update allowed users
                            canvas.set_allowed_users(Some(&allowed_users));

                            // record a diff so changes get written back to database
                            {
                                let mut diffs = client_state.diffs.lock().await;

                                diffs.push(WhiteboardDiff::UpdateCanvasAllowedUsers {
                                    canvas_id,
                                    allowed_users: allowed_users.iter().map(|oid| *oid).collect(),
                                });
                            }

                            // broadcast to all users
                            Some(ServerSocketMessage::UpdateCanvasAllowedUsers {
                                client_id: client_state.client_id.clone(),
                                canvas_id: canvas_id.to_string(),
                                allowed_users: allowed_users
                                    .iter()
                                    .map(|oid| oid.to_string())
                                    .collect(),
                            })
                        }
                    }
                }
                MergeCanvas { canvas_id } => {
                    // Merge the given canvas with its parent
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    let parent_ref: CanvasParentRef;
                    let mut new_parent_canvas_objects: Vec<(CanvasObjectIdType, ShapeModel)>;
                    // diffs store changes to the database to be made after this function has
                    // returned
                    let mut new_diffs = Vec::<WhiteboardDiff>::new();

                    // What to do:
                    //  - Access child canvas and parent canvas sequentially, not at the same time
                    //  - Create a new hashmap that contains all the shapes of the parent canvas,
                    //  then extend it with the shapes from the child canvas, then make it the new
                    //  parent canvas shapes
                    if let Some(ref child_canvas) = whiteboard.canvases().get(&canvas_id) {
                        if let Some(parent_canvas) = child_canvas.parent_canvas() {
                            // Store copy of parent canvas ref, to allow resetting parent canvas refs
                            // later
                            parent_ref = parent_canvas.clone();

                            // Copy canvas objects/shapes to new map
                            new_parent_canvas_objects = child_canvas
                                .shapes()
                                .iter()
                                .map(|(k, v)| (k.clone(), v.clone()))
                                .collect();

                            // store diff to indicate change in ownership of canvases
                            new_diffs.push(WhiteboardDiff::TransferCanvasObjects {
                                old_canvas_id: canvas_id.clone(),
                                new_canvas_id: parent_canvas.canvas_id().clone(),
                                translate_x: parent_canvas.origin_x(),
                                translate_y: parent_canvas.origin_y(),
                            });

                            // store diff to indicate change of ownership of canvas objects
                            new_diffs.push(WhiteboardDiff::TransferChildCanvases {
                                old_parent_id: canvas_id.clone(),
                                new_parent_id: parent_canvas.canvas_id().clone(),
                                translate_x: parent_canvas.origin_x(),
                                translate_y: parent_canvas.origin_y(),
                            });
                        } else {
                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::NoParentCanvas {
                                    canvas_id: canvas_id.to_string(),
                                },
                            });
                        }
                    } else {
                        return Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: canvas_id.to_string(),
                            },
                        });
                    }

                    if let Some(parent_canvas) =
                        whiteboard.canvases_mut().get_mut(parent_ref.canvas_id())
                    {
                        // change child canvas objects' coordinates to match position on parent
                        // canvas
                        for &mut (_, ref mut canvas_obj) in new_parent_canvas_objects.iter_mut() {
                            match canvas_obj {
                                &mut ShapeModel::Rect {
                                    ref mut x,
                                    ref mut y,
                                    ..
                                } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                }
                                &mut ShapeModel::Ellipse {
                                    ref mut x,
                                    ref mut y,
                                    ..
                                } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                }
                                &mut ShapeModel::Vector { ref mut points, .. } => {
                                    for (idx, ref mut coord) in points.iter_mut().enumerate() {
                                        if idx % 2 == 0 {
                                            // even-indexed coordinates are x coordinates
                                            **coord += parent_ref.origin_x();
                                        } else {
                                            // odd-indexed coordinates are y coordinates
                                            **coord += parent_ref.origin_y();
                                        }
                                    } // -- end for idx, point
                                }
                                &mut ShapeModel::Text {
                                    ref mut x,
                                    ref mut y,
                                    ..
                                } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                }
                            }; // -- end match canvas_obj
                        } // -- end for canvas_obj

                        // extend new canvas objects map with parent canvas' original objects
                        parent_canvas
                            .shapes_mut()
                            .extend(new_parent_canvas_objects.into_iter());
                    } else {
                        return Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: parent_ref.canvas_id().to_string(),
                            },
                        });
                    }

                    // Replace all parent refs pointing to child canvas with references parent canvas,
                    // recalculating offsets accordingly.
                    for canvas in whiteboard.canvases_mut().values_mut() {
                        if let Some(ref mut target_parent_ref) = canvas.parent_canvas_mut() {
                            if *target_parent_ref.canvas_id() == canvas_id {
                                *target_parent_ref.canvas_id_mut() = *parent_ref.canvas_id();
                                *target_parent_ref.origin_x_mut() += parent_ref.origin_x();
                                *target_parent_ref.origin_y_mut() += parent_ref.origin_y();
                            }
                        }
                    } // -- end for canvas

                    // Remove child canvas from canvases map
                    whiteboard.canvases_mut().remove(&canvas_id);

                    // push diff to indicate that child canvas should be deleted in database
                    new_diffs.push(WhiteboardDiff::DeleteCanvases {
                        canvas_ids: vec![canvas_id.clone()],
                    });

                    // Leave diff to indicate that canvas should be merged in database
                    {
                        let mut diffs = client_state.diffs.lock().await;

                        diffs.extend_from_slice(&new_diffs[..]);
                    }

                    // Tell clients to merge canvases on their end
                    Some(ServerSocketMessage::MergeCanvas {
                        client_id: client_state.client_id.clone(),
                        canvas_id: canvas_id.to_string(),
                    })
                }
            }
        }
        Err(e) => {
            println!("ERROR: invalid client message: {}", client_msg_s);
            println!("Reason: {}", e);

            Some(ServerSocketMessage::IndividualError {
                client_id: client_state.client_id.clone(),
                error: ClientError::InvalidMessage {
                    client_message_raw: String::from(client_msg_s),
                },
            })
        }
    }
} // end handle_authenticated_client_message

// Handle raw messages from clients. Assume client has not been authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                      -- (Optional) Message to send to clients, if any
pub async fn handle_unauthenticated_client_message<
    StoreType: UserStore + WhiteboardMetadataStore,
>(
    client_state: &ClientState,
    store: &StoreType,
    client_msg_s: &str,
) -> Option<ServerSocketMessage> {
    use super::jwt::get_user_id_from_jwt;

    match serde_json::from_str::<ClientSocketMessage>(client_msg_s) {
        Ok(client_msg) => {
            println!(
                "Received message from client {}",
                client_state.client_id.clone()
            );

            match client_msg {
                // -- This is the only valid message an unathenticated client can send and expect a
                // non-error response from.
                ClientSocketMessage::Login { jwt } => {
                    let user_id = match get_user_id_from_jwt(
                        jwt.as_str(),
                        client_state.jwt_secret.as_str(),
                    ) {
                        Err(e) => {
                            println!("Error parsing user_id from jwt: {}", e);

                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::UserNotFound {
                                    user_id: client_state.client_id.to_string(),
                                },
                            });
                        }
                        Ok(user_id) => user_id,
                    };

                    let user = match store.get_user_by_id(&user_id).await {
                        Err(e) => {
                            println!("Error fetching user {}: {}", user_id, e);

                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::Other {
                                    message: format!("Error fetching user {}", user_id),
                                },
                            });
                        }
                        Ok(None) => {
                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::UserNotFound {
                                    user_id: user_id.to_string(),
                                },
                            });
                        }
                        Ok(Some(user)) => user,
                    };

                    let permission: Option<WhiteboardPermissionEnum> = {
                        let mut whiteboard = client_state.whiteboard_ref.lock().await;

                        // refresh metadata from store, in case it has been changed by another
                        // service
                        match store.get_whiteboard_metadata_by_id(whiteboard.id()).await {
                            Err(e) => {
                                eprintln!("Error: could not refresh whiteboard metadata: {}", e);
                            }
                            Ok(None) => {
                                eprintln!("Error: could not refresh whiteboard metadata");
                            }
                            Ok(Some(metadata)) => {
                                *whiteboard.metadata_mut() = metadata.clone();
                            }
                        };

                        whiteboard
                            .metadata()
                            .permission_for_user(&user_id.to_string())
                    };

                    if let Some(permission) = permission {
                        // User has a valid permission
                        let user_summary = UserSummary {
                            client_id: client_state.client_id.clone(),
                            user_id: user_id.to_string(),
                            username: match user {
                                User::Permanent { username, .. } | User::Temp { username, .. } => {
                                    username.clone()
                                }
                            },
                        };

                        *client_state.user_summary.lock().await = Some(user_summary.clone());

                        let active_clients = {
                            // Return a clone of clients here to avoid acquiring two locks at the
                            // same time (reduces risk of deadlock).
                            let mut clients = client_state.active_clients.lock().await;

                            clients.insert(client_state.client_id.clone(), user_summary.clone());

                            clients.clone()
                        };

                        {
                            let mut user_perm =
                                client_state.user_whiteboard_permission.lock().await;

                            *user_perm = Some(permission);
                        }

                        // -- initialize client
                        Some(ServerSocketMessage::InitClient {
                            client_id: client_state.client_id.clone(),
                            whiteboard: client_state.whiteboard_ref.lock().await.to_client_view(),
                            active_clients,
                        })
                    } else {
                        // User has no valid permission; send back an error message
                        Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::Unauthorized,
                        })
                    }
                }
                // -- All other messages should be responded to with an individual error
                _ => Some(ServerSocketMessage::IndividualError {
                    client_id: client_state.client_id.clone(),
                    error: ClientError::NotAuthenticated,
                }),
            }
        }
        Err(e) => {
            println!("ERROR: invalid client message: {}", client_msg_s);
            println!("Reason: {}", e);

            Some(ServerSocketMessage::IndividualError {
                client_id: client_state.client_id.clone(),
                error: ClientError::InvalidMessage {
                    client_message_raw: String::from(client_msg_s),
                },
            })
        }
    }
} // end handle_unauthenticated_client_message

#[cfg(test)]
mod unit_tests {
    use crate::wss::{self, db, models, protocol, server, store, utils};
    use std::collections::HashMap;

    use mongodb::bson::oid::ObjectId;

    use chrono::Utc;

    #[tokio::test]
    async fn handle_invalid_client_message() {
        use futures::lock::Mutex;
        use models::{UserSummary, Whiteboard, WhiteboardMetadata};
        use protocol::ServerSocketMessage;
        use server::{ClientState, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;

        // not even valid json
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let client_msg_s = "This is not valid json";
        let test_canvas_id = ObjectId::new();

        // -- initialize client state
        let whiteboard = Whiteboard::new(
            ObjectId::new(),
            true,
            WhiteboardMetadata::new(String::from("Test"), vec![], HashMap::new()),
            test_canvas_id,
            HashMap::new(),
        );

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary {
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(None),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(&client_state, client_msg_s).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            Some(server_msg) => match server_msg {
                ServerSocketMessage::IndividualError { client_id, .. } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else {
                        // success
                    }
                }
                _ => panic!(
                    "Expected ServerSocketMessage::IndividualError, got {:?}",
                    server_msg
                ),
            },
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_create_shapes() {
        use chrono::Utc;
        use futures::lock::Mutex;
        use models::{
            Canvas, ShapeModel, UserSummary, Whiteboard, WhiteboardMetadata,
            WhiteboardPermissionEnum,
        };
        use protocol::ServerSocketMessage;
        use server::{ClientState, handle_authenticated_client_message};
        use std::{collections::HashMap, sync::Arc};
        use utils::generate_unique_client_id;

        let f64_prec: f64 = 1.0e-16;
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let canvas_a_id = ObjectId::new();
        let shapes_expected = vec![
            ShapeModel::Rect {
                x: 100.0,
                y: 100.0,
                width: 64.0,
                height: 64.0,
                stroke_width: 1.0,
                stroke_color: String::from("#333333"),
                fill_color: String::from("#ff0000"),
                rotation: 0.0,
            },
            ShapeModel::Rect {
                x: 200.0,
                y: 200.0,
                width: 64.0,
                height: 64.0,
                stroke_width: 1.0,
                stroke_color: String::from("#333333"),
                fill_color: String::from("#ff0000"),
                rotation: 0.0,
            },
            ShapeModel::Rect {
                x: 300.0,
                y: 300.0,
                width: 64.0,
                height: 64.0,
                stroke_width: 1.0,
                stroke_color: String::from("#333333"),
                fill_color: String::from("#ff0000"),
                rotation: 0.0,
            },
        ];
        let client_msg_s = format!(
            r##"
        {{
            "type": "create_shapes",
            "canvasId": "{}",
            "shapes": [
                {{
                    "type": "rect",
                    "x": 100,
                    "y": 100,
                    "width": 64,
                    "height": 64,
                    "rotation": 0,
                    "strokeWidth": 1,
                    "strokeColor": "#333333",
                    "fillColor": "#ff0000"
                }},
                {{
                    "type": "rect",
                    "x": 200,
                    "y": 200,
                    "width": 64,
                    "height": 64,
                    "rotation": 0,
                    "strokeWidth": 1,
                    "strokeColor": "#333333",
                    "fillColor": "#ff0000"
                }},
                {{
                    "type": "rect",
                    "x": 300,
                    "y": 300,
                    "width": 64,
                    "height": 64,
                    "rotation": 0,
                    "strokeWidth": 1,
                    "strokeColor": "#333333",
                    "fillColor": "#ff0000"
                }}
            ]
        }}
        "##,
            canvas_a_id
        );

        let whiteboard = Whiteboard::new(
            ObjectId::new(),
            true,
            WhiteboardMetadata::new(String::from("Test"), vec![], HashMap::new()),
            canvas_a_id,
            HashMap::from([(
                canvas_a_id.clone(),
                Canvas::new(
                    &canvas_a_id,
                    512.0,
                    512.0,
                    "Canvas A",
                    &Utc::now(),
                    &Utc::now(),
                    None,
                    HashMap::new(),
                    None, // None = open to all
                ),
            )]),
        );

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary {
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(Some(WhiteboardPermissionEnum::Own)),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(&client_state, &client_msg_s).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            // CreateShapes { client_id: ClientIdType, canvas_id: CanvasIdType, shapes: HashMap<CanvasObjectIdType, ShapeModel> },
            Some(server_msg) => match server_msg {
                ServerSocketMessage::CreateShapes {
                    client_id,
                    canvas_id,
                    shapes,
                } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else if canvas_id != canvas_a_id.to_string() {
                        panic!("Expected canvas_id = {}; got {}", canvas_a_id, canvas_id);
                    } else if shapes.len() != shapes_expected.len() {
                        panic!(
                            r#"
                            Expected shapes map to contain {} items; got {}

                            Shapes: {:?}
                            "#,
                            shapes_expected.len(),
                            shapes.len(),
                            shapes
                        );
                    } else {
                        // success
                        let mut shapes_entries: Vec<(&String, &ShapeModel)> =
                            shapes.iter().collect();

                        shapes_entries.sort_by_key(|(obj_id, _)| (*obj_id).clone());

                        for (ref shape_entry, ref shape_expected) in
                            shapes_entries.iter().zip(shapes_expected.iter())
                        {
                            let (_, shape) = shape_entry;

                            match (shape, shape_expected) {
                                (
                                    ShapeModel::Rect {
                                        x,
                                        y,
                                        width,
                                        height,
                                        stroke_width,
                                        stroke_color,
                                        fill_color,
                                        rotation,
                                    },
                                    ShapeModel::Rect {
                                        x: x_exp,
                                        y: y_exp,
                                        width: width_exp,
                                        height: height_exp,
                                        stroke_width: stroke_width_exp,
                                        stroke_color: stroke_color_exp,
                                        fill_color: fill_color_exp,
                                        rotation: rotation_exp,
                                    },
                                ) => {
                                    if (x - x_exp).abs() > f64_prec {
                                        panic!("Expected shape x = {}; got {}", x, x_exp);
                                    }
                                    if (y - y_exp).abs() > f64_prec {
                                        panic!("Expected shape y = {}; got {}", y, y_exp);
                                    }
                                    if (width - width_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected shape width = {}; got {}",
                                            width, width_exp
                                        );
                                    }
                                    if (height - height_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected shape height = {}; got {}",
                                            height, height_exp
                                        );
                                    }
                                    if (stroke_width - stroke_width_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected shape stroke_width = {}; got {}",
                                            stroke_width, stroke_width_exp
                                        );
                                    }
                                    if stroke_color != stroke_color_exp {
                                        panic!(
                                            "Expected shape stroke_color = {}; got {}",
                                            stroke_color, stroke_color_exp
                                        );
                                    }
                                    if fill_color != fill_color_exp {
                                        panic!(
                                            "Expected shape fill_color = {}; got {}",
                                            fill_color, fill_color_exp
                                        );
                                    }
                                    if (rotation - rotation_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected shape rotation = {}; got {}",
                                            rotation, rotation_exp
                                        );
                                    }
                                }
                                (_, _) => panic!("Expected Rect; got {:?}", shape),
                            };

                            // success
                        }
                    }
                }
                _ => panic!(
                    "Expected ServerSocketMessage::IndividualError, got {:?}",
                    server_msg
                ),
            },
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_delete_canvas_objects() {
        use futures::lock::Mutex;
        use models::{
            Canvas, ShapeModel, UserSummary, Whiteboard, WhiteboardMetadata,
            WhiteboardPermissionEnum,
        };
        use protocol::ServerSocketMessage;
        use server::{ClientState, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;

        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let canvas_a_id = ObjectId::new();
        let object_a_id = ObjectId::new();
        let canvas_objects_initial_kv = vec![
            (
                object_a_id,
                ShapeModel::Rect {
                    x: 100.0,
                    y: 100.0,
                    width: 64.0,
                    height: 64.0,
                    stroke_width: 1.0,
                    stroke_color: String::from("#333333"),
                    fill_color: String::from("#ff0000"),
                    rotation: 0.0,
                },
            ),
            (
                ObjectId::new(),
                ShapeModel::Rect {
                    x: 200.0,
                    y: 200.0,
                    width: 64.0,
                    height: 64.0,
                    stroke_width: 1.0,
                    stroke_color: String::from("#333333"),
                    fill_color: String::from("#ff0000"),
                    rotation: 0.0,
                },
            ),
            (
                ObjectId::new(),
                ShapeModel::Rect {
                    x: 300.0,
                    y: 300.0,
                    width: 64.0,
                    height: 64.0,
                    stroke_width: 1.0,
                    stroke_color: String::from("#333333"),
                    fill_color: String::from("#ff0000"),
                    rotation: 0.0,
                },
            ),
        ];
        let canvas_objects_final_kv = Vec::from(&canvas_objects_initial_kv[1..]);
        let canvas_objects_initial =
            HashMap::<ObjectId, ShapeModel>::from_iter(canvas_objects_initial_kv.into_iter());
        let canvas_objects_final_expected =
            HashMap::<ObjectId, ShapeModel>::from_iter(canvas_objects_final_kv.into_iter());
        let canvas_obj_ids_expected = vec![object_a_id.to_string()];
        let client_msg_s = format!(
            r##"
        {{
            "type": "delete_canvas_objects",
            "canvasObjectIds": [
                "{}"
            ]
        }}
        "##,
            object_a_id.to_string()
        );

        let whiteboard = Whiteboard::new(
            ObjectId::new(),
            true,
            WhiteboardMetadata::new(String::from("Test"), vec![], HashMap::new()),
            canvas_a_id,
            HashMap::from([(
                canvas_a_id.clone(),
                Canvas::new(
                    &canvas_a_id,
                    512.0,
                    512.0,
                    "Canvas A",
                    &Utc::now(),
                    &Utc::now(),
                    None,
                    canvas_objects_initial.clone(),
                    None, // None = open to all
                ),
            )]),
        );

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary {
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(Some(WhiteboardPermissionEnum::Own)),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(&client_state, &client_msg_s).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            // CreateShapes { client_id: ClientIdType, canvas_id: CanvasIdType, shapes: HashMap<CanvasObjectIdType, ShapeModel> },
            Some(server_msg) => match server_msg {
                ServerSocketMessage::DeleteCanvasObjects {
                    client_id,
                    canvas_object_ids,
                } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else if canvas_object_ids != canvas_obj_ids_expected {
                        panic!(
                            "Expected canvas_object_ids = {:?}; got {:?}",
                            canvas_obj_ids_expected, canvas_object_ids
                        );
                    } else {
                        let whiteboard = client_state.whiteboard_ref.lock().await;

                        // Ensure the correct canvas objects remain in the store of canvas objects
                        if let Some(canvas_a) = whiteboard.canvases().get(&canvas_a_id) {
                            if *canvas_a.shapes() != canvas_objects_final_expected {
                                panic!(
                                    "Expected final canvas objects to be {:?}; got {:?}",
                                    canvas_objects_final_expected,
                                    canvas_a.shapes()
                                );
                            }
                        } else {
                            panic!(
                                "ERROR: could not find canvas {} in final whiteboard",
                                canvas_a_id
                            );
                        }
                    }
                }
                _ => panic!(
                    "Expected ServerSocketMessage::DeleteCanvasObjects, got {:?}",
                    server_msg
                ),
            },
        };
    }

    // === fetch_whiteboard_from_mongodb ==========================================================
    //
    // Ensures that data is properly fetched and deserialized from MongoDB into the *MongoDBView
    // structs.
    //
    // Requires the test database to be running and freshly initialized before each invocation. See
    // the "test_db" service in docker-compose.yml and the TestDatabase directory for reference.
    //
    // ============================================================================================
    #[tokio::test]
    async fn fetch_whiteboard_from_mongodb() {
        // -- try fetching Project Alpha and its constituent components (see
        // TestDatabase/init-db.js for document definitions)
        use crate::bson::oid::ObjectId;
        use chrono::{MappedLocalTime, TimeZone, Utc};
        use db::{connect_mongodb, get_whiteboard_by_id};

        // -- initialize database connection
        let mongo_uri = "mongodb://test_db:27017/testdb";
        let mongo_client = connect_mongodb(&mongo_uri).await.unwrap();
        let db = mongo_client.default_database().unwrap();

        // -- call get_whiteboard_by_id; uses ID for "Project Alpha" in TestDatabase/init-db.js
        let whiteboard_id_s = "68d5e8d4829da666aece0400";
        let whiteboard_id = ObjectId::parse_str(&whiteboard_id_s).unwrap();
        // -- id for root canvas
        let root_canvas_id = ObjectId::parse_str("68d5e8d4829da666aece0200").unwrap();

        // -- ids for all canvases
        let canvas_ids = vec![
            ObjectId::parse_str("68d5e8d4829da666aece0200").unwrap(),
            ObjectId::parse_str("68d5e8d4829da666aece0202").unwrap(),
            ObjectId::parse_str("68d5e8d4829da666aece0203").unwrap(),
            ObjectId::parse_str("68d5e8d4829da666aece0204").unwrap(),
        ];

        let whiteboard = get_whiteboard_by_id(&db, &whiteboard_id)
            .await
            .unwrap()
            .unwrap();

        println!("Whiteboard Received: {:?}", whiteboard);

        assert!(*whiteboard.id() == whiteboard_id);
        assert!(whiteboard.metadata().name() == "Project Alpha");
        assert!(whiteboard.metadata().user_permissions().len() == 1);
        assert!(*whiteboard.root_canvas() == root_canvas_id);
        assert!(whiteboard.canvases().len() == 4);
        assert!(whiteboard.canvases().contains_key(&root_canvas_id));

        // -- ensure all expected canvases are present
        for canvas_id in &canvas_ids {
            assert!(whiteboard.canvases().contains_key(canvas_id));
        } // -- end for canvas_id in &canvas_ids

        // -- check contents of root canvas
        let canvas = whiteboard.canvases().get(&root_canvas_id).unwrap();

        assert!(*canvas.id() == root_canvas_id);
        assert!(f64::abs(canvas.width() - 3000.0) < 1.0e-16);
        assert!(f64::abs(canvas.height() - 3000.0) < 1.0e-16);
        assert!(canvas.name() == "Canvas Alpha");

        let exp_time_created = match Utc.timestamp_opt(1754050200, 0) {
            MappedLocalTime::Single(val) => val,
            bad_val => {
                panic!("Got {:?} from expected time created timestamp", bad_val);
            }
        };

        let exp_time_last_modified = match Utc.timestamp_opt(1754827800, 0) {
            MappedLocalTime::Single(val) => val,
            bad_val => {
                panic!(
                    "Got {:?} from expected time last modified timestamp",
                    bad_val
                );
            }
        };

        assert!(*canvas.time_created() == exp_time_created);
        assert!(*canvas.time_last_modified() == exp_time_last_modified);
        assert!(canvas.shapes().len() == 0);
        assert!(canvas.allowed_users().is_none());
    } // -- end fn fetch_whiteboard_from_mongodb()

    // === MockStore ==============================================================================
    //
    // Instead of pulling data from database, contains pre-cached user values.
    //
    // ============================================================================================
    struct MockStore {
        users_by_id: HashMap<models::UserIdType, models::User>,
        whiteboards_by_id: HashMap<models::WhiteboardIdType, models::Whiteboard>,
    } // -- end struct MockStore

    impl store::UserStore for MockStore {
        async fn get_user_by_id(
            &self,
            user_id: &models::UserIdType,
        ) -> Result<Option<models::User>, Box<dyn std::error::Error + Send + Sync>> {
            match self.users_by_id.get(user_id) {
                Some(user) => Ok(Some(user.clone())),
                None => Ok(None),
            }
        } // -- end get_user_by_id
    }

    impl store::WhiteboardMetadataStore for MockStore {
        async fn get_whiteboard_metadata_by_id(
            &self,
            whiteboard_id: &models::WhiteboardIdType,
        ) -> Result<Option<models::WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>>
        {
            match self.whiteboards_by_id.get(whiteboard_id) {
                Some(whiteboard) => Ok(Some(whiteboard.metadata().clone())),
                None => Ok(None),
            }
        } // -- end get_whiteboard_metadata_by_id
    }

    // === handle_valid_login_attempt =============================================================
    //
    // Ensure that handle_unauthenticated_client_message correctly handles a valid login attempt.
    //
    // ============================================================================================
    #[tokio::test]
    async fn handle_valid_login_attempt() {
        use futures::lock::Mutex;
        use hmac::{Hmac, Mac};
        use jwt::SignWithKey;
        use models::{
            User, UserSummary, Whiteboard, WhiteboardMetadata, WhiteboardPermission,
            WhiteboardPermissionEnum, WhiteboardPermissionType,
        };
        use mongodb::bson::oid::ObjectId;
        use protocol::ServerSocketMessage;
        use server::{ClientState, handle_unauthenticated_client_message};
        use sha2::Sha256;
        use std::sync::Arc;
        use utils::generate_unique_client_id;
        use wss::jwt::JWTClaims;

        let jwt_secret = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
        let target_uid_s = "68d5e8d4829da666aece5f48";
        let target_uid = ObjectId::parse_str(target_uid_s).expect("UID to be valid");

        // -- pre-generate jwt with desired uid
        let key: Hmac<Sha256> =
            Hmac::new_from_slice(jwt_secret.as_bytes()).expect("Valid key to be generated");
        let timestamp_iat_utc = chrono::Local::now().to_utc().timestamp() - 20;
        // expiration always in the future
        let timestamp_exp_utc = timestamp_iat_utc + 999999;
        let jwt_claims = JWTClaims {
            sub: String::from(target_uid_s),
            issued_at_epoch_secs: timestamp_iat_utc,
            expiration_epoch_secs: timestamp_exp_utc,
        };
        let token_s = jwt_claims.sign_with_key(&key).unwrap();

        // -- initialize user store
        let user_store = MockStore {
            users_by_id: HashMap::from([(
                target_uid,
                User::Permanent {
                    id: ObjectId::parse_str(target_uid_s).unwrap(),
                    username: String::from("bob"),
                    email: String::from("bob@example.com"),
                },
            )]),
            whiteboards_by_id: HashMap::new(), // not needed here
        };

        // -- initialize mock client state
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);

        let whiteboard = Whiteboard::new(
            ObjectId::new(),
            true,
            WhiteboardMetadata::new(
                String::from("Test"),
                vec![WhiteboardPermission {
                    permission_type: WhiteboardPermissionType::User {
                        user: target_uid,
                        email: Some(String::from("bob@example.com")),
                    },
                    permission: WhiteboardPermissionEnum::Edit,
                }],
                HashMap::from([(String::from(target_uid_s), WhiteboardPermissionEnum::Edit)]),
            ),
            ObjectId::new(),
            HashMap::new(),
        );
        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary {
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from(jwt_secret),
            user_whiteboard_permission: Mutex::new(None),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        // -- create authentication message (json)
        let client_login_msg_s = format!(r#"{{ "type": "login", "jwt": "{}" }}"#, token_s);

        // -- attempt login
        let resp = handle_unauthenticated_client_message(
            &client_state,
            &user_store,
            client_login_msg_s.as_str(),
        )
        .await
        .expect("Response to client login message");

        match resp {
            ServerSocketMessage::InitClient {
                client_id,
                whiteboard: whiteboard_view,
                active_clients,
            } => {
                let user_perm = client_state.user_whiteboard_permission.lock().await;

                assert_eq!(client_id, test_client_id);
                assert_eq!(whiteboard_view, whiteboard.to_client_view());
                assert_eq!(*user_perm, Some(WhiteboardPermissionEnum::Edit));
                assert_eq!(
                    active_clients,
                    HashMap::from([(
                        test_client_id.clone(),
                        UserSummary {
                            client_id: test_client_id.clone(),
                            user_id: String::from(target_uid_s),
                            username: String::from("bob"),
                        }
                    )])
                );
            }
            bad_resp => {
                panic!("Expected InitClient message, got {:?}", bad_resp);
            }
        };
    } // -- end fn fetch_permanent_user_from_mongodb_user_store

    // === fetch_permanent_user_from_mongodb_user_store ===========================================
    //
    // Tests instantiating a MongoDBStore and using it to fetch a permanent user account from the
    // test database.
    //
    // See TestDatabase/init-db.js for the sample data.
    //
    // ============================================================================================
    #[tokio::test]
    async fn fetch_permanent_user_from_mongodb_user_store() {
        use db::{MongoDBStore, connect_mongodb};
        use models::{User, UserMongoDBView, WhiteboardMetadataMongoDBView};
        use mongodb::Collection;
        use mongodb::bson::oid::ObjectId;
        use store::UserStore;

        // -- initialize database connection
        let mongo_uri = "mongodb://test_db:27017/testdb";
        let mongo_client = connect_mongodb(&mongo_uri)
            .await
            .expect("Mongo client to establish connection to database");
        let db = mongo_client
            .default_database()
            .expect("The mongo uri to point to a default database");
        let user_coll: Collection<UserMongoDBView> = db.collection::<UserMongoDBView>("users");
        let whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView> =
            db.collection::<WhiteboardMetadataMongoDBView>("whiteboards");

        // -- "alice"
        let uid = ObjectId::parse_str("68d5e8cf829da666aece0101")
            .expect("The provided string is a valid ObjectId");

        // -- instantiate MongoDBStore
        let user_store = MongoDBStore::new(&user_coll, &whiteboard_metadata_coll);

        // -- fetch the user from the database
        let user_opt = user_store
            .get_user_by_id(&uid)
            .await
            .expect("The user store to return a user with the given ID");
        let user = user_opt.expect("User to be non-null");

        // -- ensure fetched user matches expected value
        match user {
            User::Permanent {
                id,
                username,
                email,
            } => {
                assert!(id == uid);
                assert!(username.as_str() == "alice");
                assert!(email.as_str() == "alice@example.com");
            }
            _ => panic!("Expected permanent user"),
        };
    } // -- end fn fetch_permanent_user_from_mongodb_user_store()

    // === fetch_temp_user_from_mongodb_user_store ================================================
    //
    // Tests instantiating a MongoDBStore and using it to fetch a temporary user account from the
    // test database.
    //
    // See TestDatabase/init-db.js for the sample data.
    //
    // ============================================================================================
    #[tokio::test]
    async fn fetch_temp_user_from_mongodb_user_store() {
        use db::{MongoDBStore, connect_mongodb};
        use models::{User, UserMongoDBView, WhiteboardMetadataMongoDBView};
        use mongodb::{Collection, bson::oid::ObjectId};
        use store::UserStore;

        // -- initialize database connection
        let mongo_uri = "mongodb://test_db:27017/testdb";
        let mongo_client = connect_mongodb(&mongo_uri)
            .await
            .expect("Mongo client to establish connection to database");
        let db = mongo_client
            .default_database()
            .expect("The mongo uri to point to a default database");
        let user_coll: Collection<UserMongoDBView> = db.collection::<UserMongoDBView>("users");
        let whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView> =
            db.collection::<WhiteboardMetadataMongoDBView>("whiteboards");

        // -- "TempUser68d5e8d4829da666aece0107"
        let uid = ObjectId::parse_str("68d5e8d4829da666aece0107")
            .expect("The provided string is a valid ObjectId");

        // -- instantiate MongoDBStore
        let user_store = MongoDBStore::new(&user_coll, &whiteboard_metadata_coll);

        // -- fetch the user from the database
        let user_opt = user_store
            .get_user_by_id(&uid)
            .await
            .expect("The user store to return a user with the given ID");
        let user = user_opt.expect("User to be non-null");

        // -- ensure fetched user matches expected value
        match user {
            User::Temp { id, username, .. } => {
                assert!(id == uid);
                assert!(username.as_str() == "TempUser68d5e8d4829da666aece0107");
            }
            _ => panic!("Expected temp user"),
        };
    } // -- end fn fetch_temp_user_from_mongodb_user_store()

    // === test_create_shapes_nonexistent_canvas_id ===============================================
    //
    // Ensure that an IndividualError is returned when provided
    //
    // ============================================================================================
    #[tokio::test]
    async fn test_create_shapes_nonexistent_canvas_id() {
        use futures::lock::Mutex;
        use models::{
            UserSummary, Whiteboard, WhiteboardMetadata, WhiteboardPermission,
            WhiteboardPermissionEnum, WhiteboardPermissionType,
        };
        use mongodb::bson::oid::ObjectId;
        use protocol::{ClientError, ServerSocketMessage::*};
        use server::{ClientState, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;

        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let test_user_id = ObjectId::new();
        let invalid_canvas_id = ObjectId::new();
        let client_msg_s = format!(
            r#"{{
            "type": "create_shapes",
            "canvasId": "{}",
            "shapes": [
                {{
                    "type": "rect",
                    "x": 10.0,
                    "y": 10.0,
                    "width": 10.0,
                    "height": 10.0,
                    "rotation": 0,
                    "strokeWidth": 1.0,
                    "strokeColor": "black",
                    "fillColor": "red"
                }}
            ]
        }}"#,
            invalid_canvas_id.to_string()
        );

        // -- initialize client state
        let whiteboard = Whiteboard::new(
            ObjectId::new(),
            true,
            WhiteboardMetadata::new(
                String::from("Test"),
                vec![WhiteboardPermission {
                    permission_type: WhiteboardPermissionType::User {
                        user: test_user_id,
                        email: None,
                    },
                    permission: WhiteboardPermissionEnum::Edit,
                }],
                HashMap::from([(test_user_id.to_string(), WhiteboardPermissionEnum::Edit)]),
            ),
            // no canvases
            ObjectId::new(),
            HashMap::new(),
        );

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary {
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(Some(WhiteboardPermissionEnum::Edit)),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(&client_state, client_msg_s.as_str()).await;

        match resp {
            Some(IndividualError { client_id, error }) => {
                assert_eq!(client_id, test_client_id);

                match error {
                    ClientError::CanvasNotFound { canvas_id } => {
                        assert_eq!(canvas_id, invalid_canvas_id.to_string());
                    }
                    bad_err => {
                        panic!("expected CanvasNotFound, got {:?}", bad_err);
                    }
                };
            }
            bad_resp => {
                panic!("expected IndividualError in response, got {:?}", bad_resp);
            }
        };
    } // -- end test_create_shapes_nonexistent_canvas_id
}
