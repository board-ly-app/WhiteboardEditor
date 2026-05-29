// === server.rs ===================================================================================
//
// Core implementation of the web socket server, including high-level functions for handling
// messages from the client.
//
// =================================================================================================

use super::{db::WhiteboardDiff, models::*, protocol::*, store::*,collections::*};

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
    pub broadcaster: broadcast::Sender<ServerSocketMessage>,
    pub active_clients: Arc<Mutex<HashMap<ClientIdType, UserSummary>>>,
    // -- tracking which client is selecting, thereby currently owns, a given canvas object
    pub selectors_to_canvas_objects: Arc<Mutex<OneToOne<ClientIdType, CanvasObjectIdType>>>,
    pub edits: Arc<Mutex<Vec<Edit>>>,
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

// === ClientStateBase =================================================================================
//
// Encapsulate all state a thread needs to handle a single client, authenticated or unauthenticated.
//
// =================================================================================================
#[derive(Debug)]
pub struct ClientStateBase {
    pub client_id: ClientIdType,
    pub whiteboard_id: WhiteboardIdType,
    pub whiteboard_ref: Arc<Mutex<Whiteboard>>,
    pub jwt_secret: String,
    // The permission (view/edit/own) the user has on the current whiteboard
    pub active_clients: Arc<Mutex<HashMap<ClientIdType, UserSummary>>>,
    // -- tracking which client is selecting, thereby currently owns, a given canvas object
    pub selectors_to_canvas_objects: Arc<Mutex<OneToOne<ClientIdType, CanvasObjectIdType>>>,
    pub edits: Arc<Mutex<Vec<Edit>>>,
} // -- end pub struct ClientStateBase

// === pub struct ClientStateAuthenticated =========================================================
//
// Encapsulate all state a thread needs to handle a single authenticated client.
//
// =================================================================================================
#[derive(Debug)]
pub struct ClientStateAuthenticated <'a> {
    pub base: &'a ClientStateBase,
    pub user_summary: UserSummary,
    pub user_whiteboard_permission: WhiteboardPermissionEnum,
}// -- end pub struct ClientStateAuthenticated

impl <'a> ClientStateAuthenticated <'a> {
    pub fn generate_edit(&self, edit_kind: EditKind) -> Edit {
        Edit::new(
            &self.user_summary.user_id,
            &self.base.whiteboard_id,
            edit_kind,
        )
    }// -- end pub fn generate_edit
}// -- end impl <'a> ClientStateAuthenticated <'a>

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

// === ClientMessageResponse =======================================================================
//
// A response to a client's message to the server. Contains both the list of message to broadcast
// back to client(s) as well as the edits to commit to the database.
//
// =================================================================================================
pub struct ClientMessageResponse {
    // -- Messages to send back to the client(s)
    pub messages: Vec<ServerSocketMessage>,
}// -- end pub struct ClientMessageResponse

pub struct ClientMessageUnauthenticatedResponse <'a> {
    pub base: ClientMessageResponse,
    pub authenticated_state: Option<ClientStateAuthenticated <'a>>,
}// -- end pub struct ClientMessageUnauthenticatedResponse

// Handle raw messages from clients. Assume client has already authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                    -- Messages to send to clients
pub async fn handle_authenticated_client_message<'a>(
    client_state: &ClientStateAuthenticated<'a>,
    client_msg_s: &str,
) -> ClientMessageResponse {
    use ClientSocketMessage::*;

    match serde_json::from_str::<ClientSocketMessage>(client_msg_s) {
        Ok(client_msg) => {
            println!("Received message from client {}", client_state.base.client_id);

            // All actions below require at least edit permission, since they all involve
            // mutating state in some way. Hence, we check permissions first, and send back an
            // error message if the user only has view permission.
            match client_state.user_whiteboard_permission {
                WhiteboardPermissionEnum::View => {
                    let inspector = serde_json::from_str::<ClientMessageInspector>(client_msg_s)
                        .expect("Expected to find \"type\" tag in client message.");

                    return ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Individual {
                            target_client_id: client_state.base.client_id.clone(),
                            msg: ServerSocketIndividualMessage::Error {
                                error: ClientError::ActionForbidden {
                                    action: inspector.type_tag,
                                },
                            }
                        }],
                    };
                }
                // Proceed to next step.
                // Don't just use _ here to accept all other permissions: if we add a new
                // permission type, we want to make sure we handle it uniquely, in case it involves
                // more unique logic.
                WhiteboardPermissionEnum::Edit | WhiteboardPermissionEnum::Own => {}
            };

            match client_msg {
                // -- User already authenticated; return error
                Login { .. } => ClientMessageResponse {
                    messages: vec![ServerSocketMessage::Individual {
                        target_client_id: client_state.base.client_id.clone(),
                        msg: ServerSocketIndividualMessage::Error {
                            error: ClientError::AlreadyAuthorized,
                        },
                    }],
                },
                EditingCanvas { canvas_id } => {
                    // TODO: validate that canvas id is valid and user has permission to edit
                    // canvas.
                    ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Broadcast {
                            msg: ServerSocketBroadcastMessage::EditingCanvas {
                                client_id: client_state.base.client_id.clone(),
                                canvas_id,
                            },
                        }],
                    }
                }
                SelectedCanvasObject {
                    canvas_object_id,
                } => {
                    // -- ensure the object isn't already selected by someone else
                    let mut selectors_to_canvas_objects = client_state.base.selectors_to_canvas_objects.lock().await;

                    match selectors_to_canvas_objects.get_key_by_value(&canvas_object_id).cloned() {
                        Some(selector_id) if selector_id != client_state.base.client_id => {
                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Individual {
                                    target_client_id: client_state.base.client_id.clone(),
                                    msg: ServerSocketIndividualMessage::Error {
                                        error: ClientError::CanvasObjectAlreadySelected {
                                            client_id: selector_id.clone(),
                                        },
                                    }
                                }],
                            }
                        },
                        _ => {
                            // -- set this client as the current selector
                            selectors_to_canvas_objects.insert(
                                client_state.base.client_id.clone(), canvas_object_id.clone()
                            );

                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Broadcast {
                                    msg: ServerSocketBroadcastMessage::SelectedCanvasObject {
                                        client_id: client_state.base.client_id.clone(),
                                        canvas_object_id: canvas_object_id.clone(),
                                    },
                                }],
                            }
                        }
                    }// -- end match
                }
                UnselectedCanvasObject {
                    canvas_object_id,
                } => {
                    let mut selectors_to_canvas_objects = client_state.base.selectors_to_canvas_objects.lock().await;

                    match selectors_to_canvas_objects.get_key_by_value(&canvas_object_id).cloned() {
                        Some(selector_id) if selector_id != client_state.base.client_id => {
                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Individual {
                                    target_client_id: client_state.base.client_id.clone(),
                                    msg: ServerSocketIndividualMessage::Error {
                                        error: ClientError::CanvasObjectAlreadySelected {
                                            client_id: selector_id.clone(),
                                        },
                                    }
                                }],
                            }
                        },
                        _ => {
                            // -- remove client->object mapping
                            selectors_to_canvas_objects.remove_value(&canvas_object_id);

                            // -- echo back to other clients
                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Broadcast {
                                    msg: ServerSocketBroadcastMessage::UnselectedCanvasObject {
                                        client_id: client_state.base.client_id.clone(),
                                        canvas_object_id: canvas_object_id.clone(),
                                    },
                                }],
                            }
                        },
                    }// -- end match
                }
                SetCursorPos {
                    x,
                    y,
                } => {
                    // -- UI-only feature; just relay the message to the other clients
                    ClientMessageResponse {
                        messages: vec![ServerSocketMessage::BroadcastRest {
                            src_client_id: client_state.base.client_id.clone(),
                            msg: ServerSocketBroadcastRestMessage::SetCursorPos {
                                client_id: client_state.base.client_id.clone(), x, y,
                            },
                        }],
                    }
                }
                CreateCanvasObjects {
                    canvas_id,
                    ref canvas_objects,
                } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
                    println!("Creating canvas_object on canvas {} ...", canvas_id);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => ClientMessageResponse {
                            messages: vec![ServerSocketMessage::Individual {
                                target_client_id: client_state.base.client_id.clone(),
                                msg: ServerSocketIndividualMessage::Error {
                                    error: ClientError::CanvasNotFound {
                                        canvas_id: canvas_id.clone(),
                                    },
                                }
                            }],
                        },
                        Some(canvas) => {
                            // -- Generate new canvas_objects
                            let new_canvas_objects : HashMap::<CanvasObjectIdType, CanvasObject>
                                = canvas_objects.iter()
                                .map(|obj_model| {
                                    let obj_id = ObjectId::new();

                                    (obj_id.clone(), CanvasObject {
                                        id: obj_id.clone(),
                                        canvas_id: canvas_id.clone(),
                                        canvas_object: obj_model.clone(),
                                    })
                                })
                                .collect();
                            let obj_models_by_id : HashMap::<CanvasObjectIdType, CanvasObjectModel>
                                = new_canvas_objects.iter()
                                .map(|(obj_id, obj)| (obj_id.clone(), obj.canvas_object.clone()))
                                .collect();

                            for (obj_id, canvas_object) in obj_models_by_id.iter() {
                                canvas.canvas_objects_mut().insert(
                                    obj_id.clone(), canvas_object.clone()
                                );
                            }// -- end for (obj_id, canvas_object) in obj_models_by_id.iter()

                            // -- Write edits to buffer
                            {
                                let mut edits = client_state.base.edits.lock().await;

                                edits.push(client_state.generate_edit(EditKind::CreateCanvasObjects {
                                    canvas_objects: new_canvas_objects,
                                }));
                            }

                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Broadcast {
                                    msg: ServerSocketBroadcastMessage::CreateCanvasObjects {
                                        client_id: client_state.base.client_id.clone(),
                                        canvas_id: canvas_id.clone(),
                                        canvas_objects: obj_models_by_id,
                                    },
                                }],
                            }
                        }
                    }
                }
                UpdateCanvasObjects {
                    canvas_id,
                    ref canvas_objects,
                } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
                    println!("Updating canvas_objects on canvas {} ...", canvas_id);
                    println!("CanvasObjects: {:?}", canvas_objects);

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => ClientMessageResponse {
                            messages: vec![ServerSocketMessage::Individual {
                                target_client_id: client_state.base.client_id.clone(),
                                msg: ServerSocketIndividualMessage::Error {
                                    error: ClientError::CanvasNotFound {
                                        canvas_id: canvas_id.clone(),
                                    },
                                }
                            }],
                        },
                        Some(canvas) => {
                            let selectors_to_canvas_objects = client_state.base
                                .selectors_to_canvas_objects.lock().await;
                            let mut upated_canvas_objects = HashMap::<CanvasObjectIdType, CanvasObjectModel>::new();
                            let mut responses = Vec::<ServerSocketMessage>::new();
                            let mut edit_updates = HashMap::<CanvasObjectIdType, CanvasObjectUpdate>::new();

                            for (obj_id, canvas_object) in canvas_objects.iter() {
                                match selectors_to_canvas_objects.get_key_by_value(&obj_id) {
                                    Some(selector_id) if *selector_id != client_state.base.client_id => {
                                        // -- another user has selected this object - can't
                                        // modify it ourselves
                                        responses.push(ServerSocketMessage::Individual {
                                            target_client_id: client_state.base.client_id.clone(),
                                            msg: ServerSocketIndividualMessage::Error {
                                                error: ClientError::CanvasObjectAlreadySelected {
                                                    client_id: selector_id.clone(),
                                                },
                                            },
                                        });
                                    },
                                    _ => {
                                        // -- modify canvas_objects
                                        if let Some(old_obj) = canvas.canvas_objects_mut().get_mut(&obj_id) {
                                            edit_updates.insert(obj_id.clone(), CanvasObjectUpdate {
                                                canvas_id: canvas_id.clone(),
                                                old_fields: old_obj.clone(),
                                                new_fields: canvas_object.clone(),
                                            });
                                            *old_obj = canvas_object.clone();
                                            upated_canvas_objects.insert(obj_id.clone(), canvas_object.clone());
                                        }
                                    },
                                };// -- end match
                            } // end for (&obj_id, &canvas_object) in canvas_objects.iter_mut()
                            println!("Updated CanvasObjects: {:?}", upated_canvas_objects);

                            responses.push(ServerSocketMessage::Broadcast {
                                msg: ServerSocketBroadcastMessage::UpdateCanvasObjects {
                                    client_id: client_state.base.client_id.clone(),
                                    canvas_id: canvas_id.clone(),
                                    canvas_objects: upated_canvas_objects
                                        .iter()
                                        .map(|(obj_id, canvas_object)| (obj_id.clone(), canvas_object.clone()))
                                        .collect(),
                                },
                            });

                            // -- write edits to buffer
                            {
                                let mut edits = client_state.base.edits.lock().await;

                                edits.push(client_state.generate_edit(EditKind::UpdateCanvasObjects {
                                    updates: edit_updates,
                                }));
                            }

                            ClientMessageResponse {
                                messages: responses,
                            }
                        }
                    }
                }
                DeleteCanvasObjects { canvas_object_ids } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
                    let mut selectors_to_canvas_objects = client_state.base.selectors_to_canvas_objects.lock().await;
                    let mut responses = Vec::<ServerSocketMessage>::new();
                    let mut deleted_object_ids = Vec::<CanvasObjectIdType>::new();
                    let mut edit_updates = HashMap::<CanvasObjectIdType, CanvasObject>::new();

                    // Delete objects locally
                    for canvas in whiteboard.canvases_mut().values_mut() {
                        // TODO: refactor to store all canvas objects in one large HashMap
                        for object_id in canvas_object_ids.iter() {
                            match selectors_to_canvas_objects.get_key_by_value(&object_id) {
                                Some(selector_id) if *selector_id != client_state.base.client_id => {
                                    responses.push(ServerSocketMessage::Individual {
                                        target_client_id: client_state.base.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::Error {
                                            error: ClientError::CanvasObjectAlreadySelected {
                                                client_id: selector_id.clone(),
                                            },
                                        },
                                    });
                                },
                                _ => {
                                    if canvas.canvas_objects().contains_key(&object_id) {
                                        let old_obj = canvas.canvas_objects_mut().remove(&object_id).unwrap();

                                        selectors_to_canvas_objects.remove_value(&object_id);
                                        canvas.canvas_objects_mut().remove(&object_id);
                                        deleted_object_ids.push(object_id.clone());
                                        edit_updates.insert(object_id.clone(), CanvasObject {
                                            id: object_id.clone(),
                                            canvas_id: canvas.id().clone(),
                                            canvas_object: old_obj.clone(),
                                        });
                                    }
                                },
                            };// -- end match
                        } // -- end for object_id
                    } // -- end for let mut canvas

                    // Forward message to clients
                    responses.push(ServerSocketMessage::Broadcast {
                        msg: ServerSocketBroadcastMessage::DeleteCanvasObjects {
                            client_id: client_state.base.client_id.clone(),
                            canvas_object_ids: deleted_object_ids
                                .iter()
                                .map(|oid| oid.clone())
                                .collect(),
                        },
                    });

                    // -- write edits to buffer
                    {
                        let mut edits = client_state.base.edits.lock().await;

                        edits.push(client_state.generate_edit(EditKind::DeleteCanvasObjects {
                            canvas_objects: edit_updates,
                        }));
                    }

                    ClientMessageResponse {
                        messages: responses,
                    }
                }
                CreateCanvas {
                    name,
                    width,
                    height,
                    parent_canvas,
                    allowed_users,
                } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
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
                        HashMap::<CanvasObjectIdType, CanvasObjectModel>::new(),
                        Some(allowed_users),
                    );

                    whiteboard
                        .canvases_mut()
                        .insert(new_canvas_id, canvas.clone());

                    // -- write edits to buffer
                    {
                        let mut edits = client_state.base.edits.lock().await;

                        edits.push(client_state.generate_edit(EditKind::CreateCanvas {
                            canvas: canvas.clone(),
                        }));
                    }

                    ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Broadcast {
                            msg: ServerSocketBroadcastMessage::CreateCanvas {
                                client_id: client_state.base.client_id.clone(),
                                canvas: canvas.to_client_view(),
                                // -- write edits to buffer
                                // 
                            },
                        }],
                    }
                }
                DeleteCanvases { canvas_ids } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
                    let mut edit_update = HashMap::<CanvasIdType, Canvas>::new();
                    let mut deleted_canvas_ids = Vec::<CanvasIdType>::new();

                    // delete canvases identified by the given ids
                    for id in &canvas_ids {
                        if let Some(old_canvas) = whiteboard.canvases_mut().remove(id) {
                            edit_update.insert(id.clone(), old_canvas);
                            deleted_canvas_ids.push(id.clone());
                        }
                    } // end for id in canvas_ids

                    // -- write edits to buffer
                    {
                        let mut edits = client_state.base.edits.lock().await;

                        edits.push(client_state.generate_edit(EditKind::DeleteCanvases {
                            canvases: edit_update,
                        }));
                    }

                    ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Broadcast {
                            msg: ServerSocketBroadcastMessage::DeleteCanvases {
                                client_id: client_state.base.client_id.clone(),
                                canvas_ids: deleted_canvas_ids,
                            },
                        }],
                    }
                }
                UpdateCanvasAllowedUsers {
                    canvas_id,
                    allowed_users,
                } => {
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;

                    // -- ensure all allowed users are valid users who have edit or own permission
                    for user_id in allowed_users.iter() {
                        match whiteboard
                            .metadata()
                            .permission_for_user(&user_id)
                        {
                            None => {
                                return ClientMessageResponse {
                                    messages: vec![ServerSocketMessage::Individual {
                                        target_client_id: client_state.base.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::Error {
                                            error: ClientError::Other {
                                                message: format!("User {} not found", user_id),
                                            },
                                        },
                                    }],
                                };
                            }
                            Some(perm) => match perm {
                                WhiteboardPermissionEnum::Own => {}
                                _ => {
                                    return ClientMessageResponse {
                                        messages: vec![ServerSocketMessage::Individual {
                                            target_client_id: client_state.base.client_id.clone(),
                                            msg: ServerSocketIndividualMessage::Error {
                                                error: ClientError::Other {
                                                    message: String::from(
                                                        "You cannot change a canvas' allowed users as a non-owner",
                                                    ),
                                                },
                                            },
                                        }],
                                    };
                                }
                            },
                        };
                    } // -- end for user_id in allowed_users.iter()

                    match whiteboard.canvases_mut().get_mut(&canvas_id) {
                        None => {
                            // canvas doesn't exist
                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Individual {
                                    target_client_id: client_state.base.client_id.clone(),
                                    msg: ServerSocketIndividualMessage::Error {
                                        error: ClientError::CanvasNotFound {
                                            canvas_id: canvas_id.clone(),
                                        },
                                    },
                                }],
                            }
                        }
                        Some(canvas) => {
                            let old_allowed_users = canvas.allowed_users().map(
                                |users_set| users_set.clone()
                            );

                            // update allowed users
                            canvas.set_allowed_users(Some(&allowed_users));

                            // broadcast to all users
                            // -- write edits to buffer
                            {
                                let mut edits = client_state.base.edits.lock().await;

                                edits.push(client_state.generate_edit(EditKind::UpdateCanvasAllowedUsers {
                                    canvas_id: canvas.id().clone(),
                                    old_allowed_users,
                                    new_allowed_users: Some(allowed_users.iter().copied().collect()),
                                }));
                            }

                            ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Broadcast {
                                    msg: ServerSocketBroadcastMessage::UpdateCanvasAllowedUsers {
                                        client_id: client_state.base.client_id.clone(),
                                        canvas_id: canvas_id.clone(),
                                        allowed_users: allowed_users
                                            .iter()
                                            .map(|oid| oid.clone())
                                            .collect(),
                                    },
                                }],
                            }
                        }
                    }
                }
                MergeCanvas { canvas_id } => {
                    // Merge the given canvas with its parent
                    let mut whiteboard = client_state.base.whiteboard_ref.lock().await;
                    let parent_ref: CanvasParentRef;
                    let mut new_parent_canvas_objects: Vec<(CanvasObjectIdType, CanvasObjectModel)>;

                    // What to do:
                    //  - Access child canvas and parent canvas sequentially, not at the same time
                    //  - Create a new hashmap that contains all the canvas_objects of the parent canvas,
                    //  then extend it with the canvas_objects from the child canvas, then make it the new
                    //  parent canvas canvas_objects
                    let old_child_canvas = if let Some(child_canvas) = whiteboard.canvases().get(&canvas_id) {
                        if let Some(parent_canvas) = child_canvas.parent_canvas() {
                            // Store copy of parent canvas ref, to allow resetting parent canvas refs
                            // later
                            parent_ref = parent_canvas.clone();

                            // Copy canvas objects/canvas_objects to new map
                            new_parent_canvas_objects = child_canvas
                                .canvas_objects()
                                .iter()
                                .map(|(k, v)| (*k, v.clone()))
                                .collect();

                        } else {
                            return ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Individual {
                                    target_client_id: client_state.base.client_id.clone(),
                                    msg: ServerSocketIndividualMessage::Error {
                                        error: ClientError::NoParentCanvas {
                                            canvas_id: canvas_id.clone(),
                                        },
                                    },
                                }],
                            }
                        }

                        child_canvas.clone()
                    } else {
                        return ClientMessageResponse {
                            messages: vec![ServerSocketMessage::Individual {
                                target_client_id: client_state.base.client_id.clone(),
                                msg: ServerSocketIndividualMessage::Error {
                                    error: ClientError::CanvasNotFound {
                                        canvas_id: canvas_id.clone(),
                                    },
                                },
                            }],
                        };
                    };

                    if let Some(parent_canvas) =
                        whiteboard.canvases_mut().get_mut(parent_ref.canvas_id())
                    {
                        // change child canvas objects' coordinates to match position on parent
                        // canvas
                        for &mut (_, ref mut canvas_obj) in new_parent_canvas_objects.iter_mut() {
                            match *canvas_obj {
                                CanvasObjectModel::Rect {
                                    ref mut x,
                                    ref mut y,
                                    ..
                                } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                }
                                CanvasObjectModel::Ellipse {
                                    ref mut x,
                                    ref mut y,
                                    ..
                                } => {
                                    *x += parent_ref.origin_x();
                                    *y += parent_ref.origin_y();
                                }
                                CanvasObjectModel::Vector { ref mut points, .. } => {
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
                                CanvasObjectModel::Text {
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
                            .canvas_objects_mut()
                            .extend(new_parent_canvas_objects.into_iter());
                    } else {
                        return ClientMessageResponse {
                            messages: vec![ServerSocketMessage::Individual {
                                target_client_id: client_state.base.client_id.clone(),
                                msg: ServerSocketIndividualMessage::Error {
                                    error: ClientError::CanvasNotFound {
                                        canvas_id: parent_ref.canvas_id().clone(),
                                    },
                                },
                            }],
                        };
                    }

                    // Replace all parent refs pointing to child canvas with references parent canvas,
                    // recalculating offsets accordingly.
                    for canvas in whiteboard.canvases_mut().values_mut() {
                        if let Some(ref mut target_parent_ref) = canvas.parent_canvas_mut()
                            && *target_parent_ref.canvas_id() == canvas_id {
                                *target_parent_ref.canvas_id_mut() = *parent_ref.canvas_id();
                                *target_parent_ref.origin_x_mut() += parent_ref.origin_x();
                                *target_parent_ref.origin_y_mut() += parent_ref.origin_y();
                            }
                    } // -- end for canvas

                    // Remove child canvas from canvases map
                    whiteboard.canvases_mut().remove(&canvas_id);

                    // -- write edits to buffer
                    {
                        let mut edits = client_state.base.edits.lock().await;

                        edits.push(client_state.generate_edit(EditKind::MergeCanvas {
                            child_canvas: old_child_canvas,
                        }));
                    }

                    // Tell clients to merge canvases on their end
                    ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Broadcast {
                            msg: ServerSocketBroadcastMessage::MergeCanvas {
                                client_id: client_state.base.client_id.clone(),
                                canvas_id: canvas_id.clone(),
                            },
                        }],
                    }
                }
                UndoHistory => todo!()
            }
        }
        Err(e) => {
            println!("ERROR: invalid client message: {}", client_msg_s);
            println!("Reason: {}", e);

            ClientMessageResponse {
                messages: vec![ServerSocketMessage::Individual {
                    target_client_id: client_state.base.client_id.clone(),
                    msg: ServerSocketIndividualMessage::Error {
                        error: ClientError::InvalidMessage {
                            client_message_raw: String::from(client_msg_s),
                        },
                    },
                }],
            }
        }
    }
} // end handle_authenticated_client_message

// Handle raw messages from clients. Assume client has not been authenticated.
// Input parameter is a string to enable testing on all possible inputs.
// @param client_state          -- Current client state
// @param client_msg_s          -- Content of client message
// @return                      -- Messages to send to clients
pub async fn handle_unauthenticated_client_message<
    'a, StoreType: UserStore + WhiteboardMetadataStore,
>(
    client_state: &'a ClientStateBase,
    store: &StoreType,
    client_msg_s: &str,
) -> ClientMessageUnauthenticatedResponse <'a> {
    use super::jwt::get_user_id_from_jwt;

    match serde_json::from_str::<ClientSocketMessage>(client_msg_s) {
        Ok(client_msg) => {
            println!("Received message from client {}", client_state.client_id.clone());

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

                            return ClientMessageUnauthenticatedResponse {
                                authenticated_state: None,
                                base: ClientMessageResponse {
                                    messages: vec![ServerSocketMessage::Individual {
                                        target_client_id: client_state.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::Error {
                                            error: ClientError::InvalidAuth,
                                        },
                                    }],
                                },
                            };
                        }
                        Ok(user_id) => user_id,
                    };

                    let user = match store.get_user_by_id(&user_id).await {
                        Err(e) => {
                            println!("Error fetching user by id: {}", e);

                            return ClientMessageUnauthenticatedResponse {
                                authenticated_state: None,
                                base: ClientMessageResponse {
                                    messages: vec![ServerSocketMessage::Individual {
                                        target_client_id: client_state.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::Error {
                                            error: ClientError::Other {
                                                message: format!("Error fetching user {}", user_id),
                                            },
                                        },
                                    }],
                                },
                            };
                        }
                        Ok(None) => {
                            return ClientMessageUnauthenticatedResponse {
                                authenticated_state: None,
                                base: ClientMessageResponse {
                                    messages: vec![ServerSocketMessage::Individual {
                                        target_client_id: client_state.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::Error {
                                            error: ClientError::UserNotFound {
                                                user_id: user_id.clone(),
                                            },
                                        }
                                    }],
                                },
                            };
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
                            .permission_for_user(&user_id.clone())
                    };

                    if let Some(permission) = permission {
                        // User has a valid permission
                        let user_summary = UserSummary {
                            client_id: client_state.client_id.clone(),
                            user_id: user_id.clone(),
                            username: match user {
                                User::Permanent { username, .. } | User::Temp { username, .. } => {
                                    username.clone()
                                }
                            },
                        };

                        let active_clients = {
                            // Return a clone of clients here to avoid acquiring two locks at the
                            // same time (reduces risk of deadlock).
                            let mut clients = client_state.active_clients.lock().await;

                            clients.insert(client_state.client_id.clone(), user_summary.clone());

                            clients.clone()
                        };

                        // -- initialize client
                        {
                            let whiteboard = client_state.whiteboard_ref.lock().await;
                            let selectors_to_canvas_objects = client_state
                                .selectors_to_canvas_objects
                                .lock().await;

                            ClientMessageUnauthenticatedResponse {
                                authenticated_state: Some(ClientStateAuthenticated {
                                    base: &client_state,
                                    user_summary: user_summary.clone(),
                                    user_whiteboard_permission: permission,
                                }),
                                base: ClientMessageResponse {
                                    messages: vec![ServerSocketMessage::Individual {
                                        target_client_id: client_state.client_id.clone(),
                                        msg: ServerSocketIndividualMessage::InitClient {
                                            client_id: client_state.client_id.clone(),
                                            whiteboard: whiteboard.to_client_view(),
                                            active_clients,
                                            selectors_by_canvas_objects: selectors_to_canvas_objects
                                                .iter_key_value()
                                                .map(|(selector_id, obj_id)| (obj_id.clone(), selector_id.clone()))
                                                .collect()
                                        },
                                    }],
                                },
                            }
                        }
                    } else {
                        // User has no valid permission; send back an error message
                        return ClientMessageUnauthenticatedResponse {
                            authenticated_state: None,
                            base: ClientMessageResponse {
                                messages: vec![ServerSocketMessage::Individual {
                                    target_client_id: client_state.client_id.clone(),
                                    msg: ServerSocketIndividualMessage::Error {
                                        error: ClientError::Unauthorized,
                                    }
                                }],
                            },
                        };
                    }
                }
                // -- All other messages should be responded to with an individual error
                _ => ClientMessageUnauthenticatedResponse {
                    authenticated_state: None,
                    base: ClientMessageResponse {
                        messages: vec![ServerSocketMessage::Individual {
                            target_client_id: client_state.client_id.clone(),
                            msg: ServerSocketIndividualMessage::Error {
                                error: ClientError::NotAuthenticated,
                            },
                        }],
                    },
                }
            }
        },
        Err(e) => {
            println!("ERROR: invalid client message: {}", client_msg_s);
            println!("Reason: {}", e);

            ClientMessageUnauthenticatedResponse {
                authenticated_state: None,
                base: ClientMessageResponse {
                    messages: vec![ServerSocketMessage::Individual {
                        target_client_id: client_state.client_id.clone(),
                        msg: ServerSocketIndividualMessage::Error {
                            error: ClientError::InvalidMessage {
                                client_message_raw: String::from(client_msg_s),
                            },
                        }
                    }],
                },
            }
        }
    }
}// -- end handle_unauthenticated_client_message

#[cfg(test)]
mod unit_tests {
    use crate::wss::{self, db, models, protocol, server, store, collections, utils};
    use models::*;
    use std::collections::HashMap;

    use mongodb::bson::oid::ObjectId;

    use chrono::Utc;

    #[tokio::test]
    async fn handle_invalid_client_message() {
        use futures::lock::Mutex;
        use models::{UserSummary, Whiteboard, WhiteboardMetadata};
        use protocol::{ServerSocketMessage,ServerSocketIndividualMessage};
        use server::{ClientStateBase, ClientStateAuthenticated, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;
        use ServerSocketMessage::*;

        // not even valid json
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let client_msg_s = "This is not valid json";
        let test_canvas_id = ObjectId::new();

        // -- initialize client state
        let whiteboard_id = ObjectId::new();
        let whiteboard = Whiteboard::new(
            whiteboard_id.clone(),
            true,
            WhiteboardMetadata::new(String::from("Test"), vec![], HashMap::new()),
            test_canvas_id,
            HashMap::new(),
            // -- Edit history irrelevant
            Vec::new(),
        );

        let client_state_base = ClientStateBase {
            client_id: test_client_id.clone(),
            jwt_secret: String::from("abcd"),
            whiteboard_id: whiteboard_id.clone(),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
            edits: Arc::new(Mutex::new(Vec::new())),
        };

        let client_state = ClientStateAuthenticated {
            base: &client_state_base,
            user_summary: UserSummary {
                client_id: test_client_id.clone(),
                user_id: ObjectId::parse_str("68d5e8cf829da666aece0101").unwrap(),
                username: String::from("Alice"),
            },
            user_whiteboard_permission: WhiteboardPermissionEnum::View,
        };

        let resp = handle_authenticated_client_message(&client_state, client_msg_s).await;
        let server_msg = resp.messages.into_iter().next().expect("Expected some client message, got empty vec");

        match server_msg {
            Individual {
                target_client_id,
                msg: ServerSocketIndividualMessage::Error { .. },
            } => {
                if target_client_id != test_client_id {
                    panic!("Expected client_id = {}; got {}", test_client_id, target_client_id);
                } else {
                    // success
                }
            }
            _ => panic!(
                "Expected ServerSocketMessage::Individual {{ Error }}, got {:?}",
                server_msg
            ),
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_create_canvas_objects() {
        use chrono::Utc;
        use futures::lock::Mutex;
        use models::{
            Canvas, CanvasObjectModel, UserSummary, Whiteboard, WhiteboardMetadata,
            WhiteboardPermissionEnum,
        };
        use protocol::{ServerSocketMessage,ServerSocketBroadcastMessage};
        use server::{ClientStateBase, ClientStateAuthenticated, handle_authenticated_client_message};
        use std::{collections::HashMap, sync::Arc};
        use utils::generate_unique_client_id;

        let f64_prec: f64 = 1.0e-16;
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let canvas_a_id = ObjectId::new();
        let canvas_objects_expected = vec![
            CanvasObjectModel::Rect {
                x: 100.0,
                y: 100.0,
                width: 64.0,
                height: 64.0,
                stroke_width: 1.0,
                stroke_color: String::from("#333333"),
                fill_color: String::from("#ff0000"),
                rotation: 0.0,
            },
            CanvasObjectModel::Rect {
                x: 200.0,
                y: 200.0,
                width: 64.0,
                height: 64.0,
                stroke_width: 1.0,
                stroke_color: String::from("#333333"),
                fill_color: String::from("#ff0000"),
                rotation: 0.0,
            },
            CanvasObjectModel::Rect {
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
            "type": "create_canvas_objects",
            "canvasId": "{}",
            "canvasObjects": [
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

        let whiteboard_id = ObjectId::new();

        let whiteboard = Whiteboard::new(
            whiteboard_id.clone(),
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
            // -- Edit history irrelevant
            Vec::new(),
        );

        let client_state_base = ClientStateBase {
            client_id: test_client_id.clone(),
            jwt_secret: String::from("abcd"),
            whiteboard_id: whiteboard_id.clone(),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
            edits: Arc::new(Mutex::new(Vec::new())),
        };

        let client_state = ClientStateAuthenticated {
            base: &client_state_base,
            user_summary: UserSummary {
                client_id: test_client_id.clone(),
                user_id: ObjectId::parse_str("68d5e8cf829da666aece0101").unwrap(),
                username: String::from("Alice"),
            },
            user_whiteboard_permission: WhiteboardPermissionEnum::Own,
        };

        let resp = handle_authenticated_client_message(&client_state, &client_msg_s).await;
        // CreateCanvasObjects { client_id: ClientIdType, canvas_id: CanvasIdType, canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel> }
        let server_msg = resp.messages.into_iter().next().expect("Expected some client message, got empty vec");

        match server_msg {
            ServerSocketMessage::Broadcast {
                msg: ServerSocketBroadcastMessage::CreateCanvasObjects {
                    client_id,
                    canvas_id,
                    canvas_objects,
                },
            } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else if canvas_id != canvas_a_id {
                        panic!("Expected canvas_id = {}; got {}", canvas_a_id, canvas_id);
                    } else if canvas_objects.len() != canvas_objects_expected.len() {
                        panic!(
                            r#"
                            Expected canvas_objects map to contain {} items; got {}

                            CanvasObjects: {:?}
                            "#,
                            canvas_objects_expected.len(),
                            canvas_objects.len(),
                            canvas_objects
                        );
                    } else {
                        // success
                        let mut canvas_objects_entries: Vec<(&CanvasObjectIdType, &CanvasObjectModel)> =
                            canvas_objects.iter().collect();

                        canvas_objects_entries.sort_by_key(|(obj_id, _)| (*obj_id).clone());

                        for (ref canvas_object_entry, ref canvas_object_expected) in
                            canvas_objects_entries.iter().zip(canvas_objects_expected.iter())
                        {
                            let (_, canvas_object) = canvas_object_entry;

                            match (canvas_object, canvas_object_expected) {
                                (
                                    CanvasObjectModel::Rect {
                                        x,
                                        y,
                                        width,
                                        height,
                                        stroke_width,
                                        stroke_color,
                                        fill_color,
                                        rotation,
                                    },
                                    CanvasObjectModel::Rect {
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
                                        panic!("Expected canvas_object x = {}; got {}", x, x_exp);
                                    }
                                    if (y - y_exp).abs() > f64_prec {
                                        panic!("Expected canvas_object y = {}; got {}", y, y_exp);
                                    }
                                    if (width - width_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected canvas_object width = {}; got {}",
                                            width, width_exp
                                        );
                                    }
                                    if (height - height_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected canvas_object height = {}; got {}",
                                            height, height_exp
                                        );
                                    }
                                    if (stroke_width - stroke_width_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected canvas_object stroke_width = {}; got {}",
                                            stroke_width, stroke_width_exp
                                        );
                                    }
                                    if stroke_color != stroke_color_exp {
                                        panic!(
                                            "Expected canvas_object stroke_color = {}; got {}",
                                            stroke_color, stroke_color_exp
                                        );
                                    }
                                    if fill_color != fill_color_exp {
                                        panic!(
                                            "Expected canvas_object fill_color = {}; got {}",
                                            fill_color, fill_color_exp
                                        );
                                    }
                                    if (rotation - rotation_exp).abs() > f64_prec {
                                        panic!(
                                            "Expected canvas_object rotation = {}; got {}",
                                            rotation, rotation_exp
                                        );
                                    }
                                }
                                (_, _) => panic!("Expected Rect; got {:?}", canvas_object),
                            };

                            // success
                        }
                    }
                }
                _ => panic!(
                    "Expected ServerSocketMessage::IndividualError, got {:?}",
                    server_msg
                ),
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_delete_canvas_objects() {
        use futures::lock::Mutex;
        use models::{
            Canvas, CanvasObjectModel, UserSummary, Whiteboard, WhiteboardMetadata,
            WhiteboardPermissionEnum,
        };
        use protocol::{ServerSocketMessage,ServerSocketBroadcastMessage};
        use server::{ClientStateBase, ClientStateAuthenticated, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;

        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let canvas_a_id = ObjectId::new();
        let object_a_id = ObjectId::new();
        let canvas_objects_initial_kv = vec![
            (
                object_a_id,
                CanvasObjectModel::Rect {
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
                CanvasObjectModel::Rect {
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
                CanvasObjectModel::Rect {
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
            HashMap::<ObjectId, CanvasObjectModel>::from_iter(canvas_objects_initial_kv.into_iter());
        let canvas_objects_final_expected =
            HashMap::<ObjectId, CanvasObjectModel>::from_iter(canvas_objects_final_kv.into_iter());
        let canvas_obj_ids_expected = vec![object_a_id];
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

        let whiteboard_id = ObjectId::new();

        let whiteboard = Whiteboard::new(
            whiteboard_id.clone(),
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
            // -- Edit history irrelevant
            Vec::new(),
        );

        let client_state_base = ClientStateBase {
            client_id: test_client_id.clone(),
            jwt_secret: String::from("abcd"),
            whiteboard_id: whiteboard_id.clone(),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
            edits: Arc::new(Mutex::new(Vec::new())),
        };

        let client_state = ClientStateAuthenticated {
            base: &client_state_base,
            user_summary: UserSummary {
                client_id: test_client_id.clone(),
                user_id: ObjectId::parse_str("68d5e8cf829da666aece0101").unwrap(),
                username: String::from("Alice"),
            },
            user_whiteboard_permission: WhiteboardPermissionEnum::Own,
        };

        let resp = handle_authenticated_client_message(&client_state, &client_msg_s).await;
        let server_msg = resp.messages.into_iter().next().expect("Expected some client message, got empty vec");

        match server_msg {
            ServerSocketMessage::Broadcast {
                msg: ServerSocketBroadcastMessage::DeleteCanvasObjects {
                    client_id,
                    canvas_object_ids,
                },
            } => {
                if client_id != test_client_id {
                    panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                } else if canvas_object_ids != canvas_obj_ids_expected {
                    panic!(
                        "Expected canvas_object_ids = {:?}; got {:?}",
                        canvas_obj_ids_expected, canvas_object_ids
                    );
                } else {
                    let whiteboard = client_state.base.whiteboard_ref.lock().await;

                    // Ensure the correct canvas objects remain in the store of canvas objects
                    if let Some(canvas_a) = whiteboard.canvases().get(&canvas_a_id) {
                        if *canvas_a.canvas_objects() != canvas_objects_final_expected {
                            panic!(
                                "Expected final canvas objects to be {:?}; got {:?}",
                                canvas_objects_final_expected,
                                canvas_a.canvas_objects()
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
        assert!(canvas.canvas_objects().len() == 0);
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
        use protocol::{ServerSocketMessage,ServerSocketIndividualMessage};
        use server::{ClientStateBase, handle_unauthenticated_client_message};
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

        let whiteboard_id = ObjectId::new();

        let whiteboard = Whiteboard::new(
            whiteboard_id.clone(),
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
                HashMap::from([(target_uid.clone(), WhiteboardPermissionEnum::Edit)]),
            ),
            ObjectId::new(),
            HashMap::new(),
            // -- Edit history irrelevant
            Vec::new(),
        );

        let client_state = ClientStateBase {
            client_id: test_client_id.clone(),
            jwt_secret: String::from(jwt_secret),
            whiteboard_id: whiteboard_id.clone(),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
            edits: Arc::new(Mutex::new(Vec::new())),
        };

        // -- create authentication message (json)
        let client_login_msg_s = format!(r#"{{ "type": "login", "jwt": "{}" }}"#, token_s);

        // -- attempt login
        let resp = handle_unauthenticated_client_message(
            &client_state,
            &user_store,
            client_login_msg_s.as_str(),
        )
        .await;

        let msg = resp
            .base
            .messages
            .into_iter()
            .next()
            .expect("Response to client login message");

        match msg {
            ServerSocketMessage::Individual {
                target_client_id,
                msg: ServerSocketIndividualMessage::InitClient {
                    client_id,
                    whiteboard: whiteboard_view,
                    active_clients,
                    selectors_by_canvas_objects,
                },
            } => {
                let auth_state = resp.authenticated_state.expect("Authenticated state");
                let user_perm = auth_state.user_whiteboard_permission;

                assert_eq!(target_client_id, test_client_id);
                assert_eq!(client_id, test_client_id);
                assert_eq!(whiteboard_view, whiteboard.to_client_view());
                assert_eq!(user_perm, WhiteboardPermissionEnum::Edit);
                assert_eq!(
                    active_clients,
                    HashMap::from([(
                        test_client_id.clone(),
                        UserSummary {
                            client_id: test_client_id.clone(),
                            user_id: target_uid.clone(),
                            username: String::from("bob"),
                        }
                    )])
                );
                assert_eq!(selectors_by_canvas_objects, HashMap::new());
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

    // === test_create_canvas_objects_nonexistent_canvas_id ===============================================
    //
    // Ensure that an IndividualError is returned when provided
    //
    // ============================================================================================
    #[tokio::test]
    async fn test_create_canvas_objects_nonexistent_canvas_id() {
        use futures::lock::Mutex;
        use models::{
            UserSummary, Whiteboard, WhiteboardMetadata, WhiteboardPermission,
            WhiteboardPermissionEnum, WhiteboardPermissionType,
        };
        use mongodb::bson::oid::ObjectId;
        use protocol::{ClientError,ServerSocketMessage::*,ServerSocketIndividualMessage};
        use server::{ClientStateBase, ClientStateAuthenticated, handle_authenticated_client_message};
        use std::sync::Arc;
        use utils::generate_unique_client_id;

        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let test_user_id = ObjectId::new();
        let invalid_canvas_id = ObjectId::new();
        let client_msg_s = format!(
            r#"{{
            "type": "create_canvas_objects",
            "canvasId": "{}",
            "canvasObjects": [
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
        let whiteboard_id = ObjectId::new();

        let whiteboard = Whiteboard::new(
            whiteboard_id.clone(),
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
                HashMap::from([(test_user_id.clone(), WhiteboardPermissionEnum::Edit)]),
            ),
            // no canvases
            ObjectId::new(),
            HashMap::new(),
            // -- Edit history irrelevant
            Vec::new(),
        );

        let client_state_base = ClientStateBase {
            client_id: test_client_id.clone(),
            jwt_secret: String::from("abcd"),
            whiteboard_id: whiteboard_id.clone(),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            selectors_to_canvas_objects: Arc::new(Mutex::new(collections::OneToOne::new())),
            edits: Arc::new(Mutex::new(Vec::new())),
        };

        let client_state = ClientStateAuthenticated {
            base: &client_state_base,
            user_summary: UserSummary {
                client_id: test_client_id.clone(),
                user_id: ObjectId::parse_str("68d5e8cf829da666aece0101").unwrap(),
                username: String::from("Alice"),
            },
            user_whiteboard_permission: WhiteboardPermissionEnum::Edit,
        };

        let resp = handle_authenticated_client_message(&client_state, client_msg_s.as_str()).await;
        let server_msg = resp.messages.into_iter().next().expect("Expected some client message, got empty vec");

        match server_msg {
            Individual {
                target_client_id, 
                msg: ServerSocketIndividualMessage::Error {
                    error,
                },
            } => {
                assert_eq!(target_client_id, test_client_id);

                match error {
                    ClientError::CanvasNotFound { canvas_id } => {
                        assert_eq!(canvas_id, invalid_canvas_id);
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
    } // -- end test_create_canvas_objects_nonexistent_canvas_id
}
