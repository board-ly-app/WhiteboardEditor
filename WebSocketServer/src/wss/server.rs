use super::{
    models::*,
    db::WhiteboardDiff,
    protocol::*,
    store::*,
};

use futures::lock::Mutex;

use chrono::Utc;

use tokio::sync::broadcast;

use mongodb::{
    bson::oid::ObjectId,
    Client,
};

use serde::{
    self,
    Serialize,
    Deserialize,
};

use std::{
    collections::{
        HashMap,
    },
    sync::Arc,
};

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
}// -- end pub struct SharedWhiteboardEntry

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
}// -- end pub struct ProgramState

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
}// -- end pub struct ClientState

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
}// -- end pub struct ConnectionState

// -- utility struct for handle_authenticated_client_message, for inspecting raw client messages
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientMessageInspector {
    #[serde(rename = "type")]
    type_tag: String,
}// -- end ClientMessageInspector

// Handle raw messages from clients. Assume client has already authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                      -- (Optional) Message to send to clients, if any
pub async fn handle_authenticated_client_message(
    client_state: &ClientState,
    client_msg_s: &str
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
                },
                // Proceed to next step.
                // Don't just use _ here to accept all other permissions: if we add a new
                // permission type, we want to make sure we handle it uniquely, in case it involves
                // more unique logic.
                Some(WhiteboardPermissionEnum::Edit) | Some(WhiteboardPermissionEnum::Own) => {},
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
                },
                CreateShapes{ canvas_id, ref shapes } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    println!("Creating shape on canvas {} ...", canvas_id);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => {
                            Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::CanvasNotFound {
                                    canvas_id: canvas_id.to_string(),
                                },
                            })
                        },
                        Some(canvas) => {
                            let mut new_shapes = HashMap::<CanvasObjectIdType, ShapeModel>::new();

                            for shape in shapes.iter() {
                                let obj_id = ObjectId::new();

                                new_shapes.insert(obj_id.clone(), shape.clone());
                                canvas.shapes_mut().insert(obj_id.clone(), shape.clone());
                            }// end for (idx, &mut shape) in new_shapes.iter_mut().enumerate()

                            // valid input: add to diffs
                            {
                                let mut diffs = client_state.diffs.lock().await;
                            
                                diffs.push(WhiteboardDiff::CreateShapes{
                                    canvas_id,
                                    shapes: new_shapes.clone()
                                });
                            }

                            Some(ServerSocketMessage::CreateShapes{
                                client_id: client_state.client_id.clone(),
                                canvas_id: canvas_id.to_string(),
                                shapes: new_shapes.iter()
                                    .map(|(obj_id, shape)| (obj_id.to_string(), shape.clone()))
                                    .collect()
                            })
                        }
                    }
                },
                UpdateShapes{ canvas_id, ref shapes } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    println!("Updating shapes on canvas {} ...", canvas_id);
                    println!("Shapes: {:?}", shapes);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => {
                            Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::CanvasNotFound {
                                    canvas_id: canvas_id.to_string(),
                                },
                            })
                        },
                        Some(canvas) => {
                            let mut new_shapes = HashMap::<CanvasObjectIdType, ShapeModel>::new();

                            for (obj_id_s, shape) in shapes.iter() {
                                match obj_id_s.parse::<CanvasObjectIdType>() {
                                    Ok(obj_id) => {
                                        if canvas.shapes().contains_key(&obj_id) {
                                            canvas.shapes_mut().insert(obj_id, shape.clone());
                                            new_shapes.insert(obj_id, shape.clone());
                                        }
                                    },
                                    Err(e) => {
                                        println!("Could not parse \"{}\" into object id: {}", obj_id_s, e);
                                    }
                                };
                            }// end for (&obj_id, &shape) in shapes.iter_mut()
                            println!("New Shapes: {:?}", new_shapes);
                            // valid input: add to diffs
                            {
                                let mut diffs = client_state.diffs.lock().await;
                            
                                diffs.push(WhiteboardDiff::UpdateShapes{
                                    canvas_id,
                                    shapes: new_shapes.clone()
                                });
                            }

                            Some(ServerSocketMessage::UpdateShapes{
                                client_id: client_state.client_id.clone(),
                                canvas_id: canvas_id.to_string(),
                                shapes: new_shapes.iter()
                                    .map(|(obj_id, shape)| (obj_id.to_string(), shape.clone()))
                                    .collect()
                            })
                        }
                    }
                },
                DeleteCanvasObjects { canvas_object_ids } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // Delete objects locally
                    for canvas in whiteboard.canvases_mut().values_mut() {
                        // TODO: refactor to store all canvas objects in one large HashMap
                        for object_id in canvas_object_ids.iter() {
                            canvas.shapes_mut().remove(object_id);
                        }// -- end for object_id
                    }// -- end for let mut canvas

                    // Store diffs to trigger deletion in database
                    {
                        let mut diffs = client_state.diffs.lock().await;
                    
                        diffs.push(WhiteboardDiff::DeleteCanvasObjects{
                            canvas_object_ids: canvas_object_ids.clone()
                        });
                    }

                    // Forward message to clients
                    Some(ServerSocketMessage::DeleteCanvasObjects{
                        client_id: client_state.client_id.clone(),
                        canvas_object_ids: canvas_object_ids.into_iter().map(|oid| oid.to_string()).collect(),
                    })
                },
                CreateCanvas { name, width, height, parent_canvas, allowed_users } => {
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
                    
                    whiteboard.canvases_mut().insert(
                        new_canvas_id,
                        canvas.clone()
                    );

                    // valid input: add to diffs
                    {
                        let mut diffs = client_state.diffs.lock().await;
                    
                        diffs.push(WhiteboardDiff::CreateCanvas{
                            canvas: canvas.clone(),
                        });
                    }

                    Some(ServerSocketMessage::CreateCanvas{
                        client_id: client_state.client_id.clone(),
                        canvas: canvas.to_client_view(),
                    })
                },
                DeleteCanvases { canvas_ids } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // delete canvases identified by the given ids
                    for id in &canvas_ids {
                        whiteboard.canvases_mut().remove(&id);
                    }// end for id in canvas_ids

                    // valid message: add to diffs
                    {
                        let mut diffs = client_state.diffs.lock().await;
                    
                        diffs.push(WhiteboardDiff::DeleteCanvases {
                            canvas_ids: canvas_ids.clone()
                        });
                    }

                    Some(ServerSocketMessage::DeleteCanvases{
                        client_id: client_state.client_id.clone(),
                        canvas_ids: canvas_ids.iter()
                            .map(|id| id.to_string())
                            .collect()
                    })
                },
                UpdateCanvasAllowedUsers { canvas_id, allowed_users } => {
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;

                    // -- ensure all allowed users are valid users who have edit or own permission
                    for user_id in allowed_users.iter() {
                        match whiteboard.metadata().permission_for_user(&user_id.to_string()) {
                            None => {
                                return Some(ServerSocketMessage::IndividualError {
                                    client_id: client_state.client_id.clone(),
                                    error: ClientError::Other {
                                        message: format!("User {} not found", user_id),
                                    }
                                });
                            },
                            Some(perm) => match perm {
                                WhiteboardPermissionEnum::Own => {},
                                _  => {
                                    return Some(ServerSocketMessage::IndividualError {
                                        client_id: client_state.client_id.clone(),
                                        error: ClientError::Other {
                                            message: String::from(
                                                "You cannot change a canvas' allowed users as a non-owner"
                                            ),
                                        }
                                    });
                                },
                            },
                        };
                    }// -- end for user_id in allowed_users.iter()

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => {
                            // canvas doesn't exist
                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::CanvasNotFound {
                                    canvas_id: canvas_id.to_string(),
                                },
                            });
                        },
                        Some(canvas) => {
                            // update allowed users
                            canvas.set_allowed_users(Some(&allowed_users));

                            // record a diff so changes get written back to database
                            {
                                let mut diffs = client_state.diffs.lock().await;

                                diffs.push(WhiteboardDiff::UpdateCanvasAllowedUsers{
                                    canvas_id, 
                                    allowed_users: allowed_users.iter()
                                        .map(|oid| *oid)
                                        .collect(), 
                                });
                            }

                            // broadcast to all users
                            Some(ServerSocketMessage::UpdateCanvasAllowedUsers { 
                                client_id: client_state.client_id.clone(), 
                                canvas_id: canvas_id.to_string(), 
                                allowed_users: allowed_users.iter()
                                    .map(|oid| oid.to_string())
                                    .collect(), 
                            })
                        }
                    }
                },
                MergeCanvas { canvas_id } => {
                    // Merge the given canvas with its parent
                    let mut whiteboard = client_state.whiteboard_ref.lock().await;
                    let parent_ref : CanvasParentRef;
                    let mut new_parent_canvas_objects : Vec::<(CanvasObjectIdType, ShapeModel)>;
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
                            new_parent_canvas_objects = child_canvas.shapes().iter()
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
                                    canvas_id: canvas_id.to_string()
                                }
                            });
                        }
                    } else {
                        return Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: canvas_id.to_string()
                            }
                        });
                    }

                    if let Some(parent_canvas) = whiteboard.canvases_mut().get_mut(parent_ref.canvas_id()) {
                        // change child canvas objects' coordinates to match position on parent
                        // canvas
                        for &mut (_, ref mut canvas_obj) in new_parent_canvas_objects.iter_mut() {
                            match canvas_obj {
                                &mut ShapeModel::Rect { ref mut x, ref mut y, .. } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                },
                                &mut ShapeModel::Ellipse { ref mut x, ref mut y, .. } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                },
                                &mut ShapeModel::Vector { ref mut points, .. } => {
                                    for (idx, ref mut coord) in points.iter_mut().enumerate() {
                                        if idx % 2 == 0 {
                                            // even-indexed coordinates are x coordinates
                                            **coord += parent_ref.origin_x();
                                        } else {
                                            // odd-indexed coordinates are y coordinates
                                            **coord += parent_ref.origin_y();
                                        }
                                    }// -- end for idx, point
                                },
                                &mut ShapeModel::Text { ref mut x, ref mut y, .. } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                },
                            };// -- end match canvas_obj
                        }// -- end for canvas_obj

                        // extend new canvas objects map with parent canvas' original objects
                        parent_canvas.shapes_mut().extend(new_parent_canvas_objects.into_iter());
                    } else {
                        return Some(ServerSocketMessage::IndividualError {
                            client_id: client_state.client_id.clone(),
                            error: ClientError::CanvasNotFound {
                                canvas_id: parent_ref.canvas_id().to_string()
                            }
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
                    }// -- end for canvas

                    // Remove child canvas from canvases map
                    whiteboard.canvases_mut().remove(&canvas_id);

                    // push diff to indicate that child canvas should be deleted in database
                    new_diffs.push(WhiteboardDiff::DeleteCanvases {
                        canvas_ids: vec![ canvas_id.clone() ],
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
                },
            }
        },
        Err(e) => {
            println!("ERROR: invalid client message: {}", client_msg_s);
            println!("Reason: {}", e);

            Some(ServerSocketMessage::IndividualError{
                client_id: client_state.client_id.clone(),
                error: ClientError::InvalidMessage {
                    client_message_raw: String::from(client_msg_s),
                },
            })
        }
    }
}// end handle_authenticated_client_message

// Handle raw messages from clients. Assume client has not been authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                      -- (Optional) Message to send to clients, if any
pub async fn handle_unauthenticated_client_message<StoreType: UserStore + WhiteboardMetadataStore>(
    client_state: &ClientState,
    store: &StoreType,
    client_msg_s: &str
) -> Option<ServerSocketMessage> {
    use super::jwt::get_user_id_from_jwt;

    match serde_json::from_str::<ClientSocketMessage>(client_msg_s) {
        Ok(client_msg) => {
            println!("Received message from client {}", client_state.client_id.clone());

            match client_msg {
                // -- This is the only valid message an unathenticated client can send and expect a
                // non-error response from.
                ClientSocketMessage::Login { jwt } => {
                    let user_id = match get_user_id_from_jwt(jwt.as_str(), client_state.jwt_secret.as_str()) {
                        Err(e) => {
                            println!("Error parsing user_id from jwt: {}", e);

                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::UserNotFound {
                                    user_id: client_state.client_id.to_string(),
                                },
                            });
                        },
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
                            })
                        },
                        Ok(None) => {
                            return Some(ServerSocketMessage::IndividualError {
                                client_id: client_state.client_id.clone(),
                                error: ClientError::UserNotFound {
                                    user_id: user_id.to_string(),
                                },
                            })
                        },
                        Ok(Some(user)) => user,
                    };

                    let permission : Option<WhiteboardPermissionEnum> = {
                        let mut whiteboard = client_state.whiteboard_ref.lock().await;

                        // refresh metadata from store, in case it has been changed by another
                        // service
                        match store.get_whiteboard_metadata_by_id(whiteboard.id()).await {
                            Err(e) => {
                                eprintln!("Error: could not refresh whiteboard metadata: {}", e);
                            },
                            Ok(None) => {
                                eprintln!("Error: could not refresh whiteboard metadata");
                            },
                            Ok(Some(metadata)) => {
                                *whiteboard.metadata_mut() = metadata.clone();
                            },
                        };

                        whiteboard.metadata().permission_for_user(&user_id.to_string())
                    };

                    if let Some(permission) = permission {
                        // User has a valid permission
                        let user_summary = UserSummary {
                            client_id: client_state.client_id.clone(),
                            user_id: user_id.to_string(),
                            username: match user {
                                User::Permanent { username, .. } | User::Temp { username, .. } => username.clone(),
                            },
                        };

                        *client_state.user_summary.lock().await = Some(user_summary.clone());

                        let active_clients = {
                            // Return a clone of clients here to avoid acquiring two locks at the
                            // same time (reduces risk of deadlock).
                            let mut clients = client_state.active_clients.lock().await;

                            clients.insert(
                                client_state.client_id.clone(),
                                user_summary.clone(),
                            );

                            clients.clone()
                        };

                        {
                            let mut user_perm = client_state.user_whiteboard_permission.lock().await;

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
                },
                // -- All other messages should be responded to with an individual error
                _ => Some(ServerSocketMessage::IndividualError {
                    client_id: client_state.client_id.clone(),
                    error: ClientError::NotAuthenticated,
                }),
            }
        },
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
}// end handle_unauthenticated_client_message
