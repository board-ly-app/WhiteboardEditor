// === protocol.rs =================================================================================
//
// Contains specifications of message protocols sent to and from the client.
//
// =================================================================================================

use serde::{self, Deserialize, Serialize};
use serde_with::{serde_as,DisplayFromStr};

use super::models::*;

use std::collections::{HashMap, HashSet};

// === ClientError ================================================================================
//
// Enumerates types of errors the server can send to the client. Sent within both the
// IndividualError and BroadcastError messages.
//
// ================================================================================================
#[serde_as]
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ClientError {
    // -- previous message from client was invalid in some form (invalid json, non-existent message
    // type, invalid message format, etc.)
    InvalidMessage {
        client_message_raw: String,
    },
    // -- client did not send an auth token
    NotAuthenticated,
    // -- client not authorized to view this whiteboard at all
    Unauthorized,
    // -- client already authorized (cannot re-authenticate within the same connection)
    AlreadyAuthorized,
    // -- client's auth token is somehow malformed
    InvalidAuth,
    // -- client's auth token has expired
    AuthTokenExpired,
    // -- Client attempted to sign in as or access user that doesn't exist
    UserNotFound {
        #[serde_as(as = "DisplayFromStr")]
        user_id: UserIdType,
    },
    // -- Client attempted to access whiteboard that doesn't exist
    WhiteboardNotFound {
        #[serde_as(as = "DisplayFromStr")]
        whiteboard_id: WhiteboardIdType,
    },
    // -- Client attempted to access canvas that doesn't exist
    CanvasNotFound {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    NoParentCanvas {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    // -- Another user has selected the resource the client has attempted to edit
    CanvasObjectAlreadySelected {
        // -- id of the selecting client
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
    },
    // -- client doesn't have permission to perform a given action
    ActionForbidden {
        // -- description of the forbidden action that was attempted
        action: String,
    },
    // -- Edit can't be reversed (i.e. another user has edited the relevant portion of the
    // whiteboard in the time since the user performed the edit.
    EditIrreversible {
        edit: EditIdType,
    },
    // -- misc. errors not neatly handled by the above common cases
    Other {
        // -- descriptive message to send to client
        // -- make sure it excludes sensitive information
        message: String,
    },
} // -- end ClientError

// === ServerSocketIndividualMessage ===============================================================
//
// Enumerates all messages sent from the server to an individual client.
//
// ================================================================================================
#[serde_as]
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerSocketIndividualMessage {
    InitClient {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        whiteboard: WhiteboardClientView,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        active_clients: HashMap<ClientIdType, UserSummary>,
        #[serde_as(as = "HashMap<DisplayFromStr, DisplayFromStr>")]
        selectors_by_canvas_objects: HashMap<CanvasObjectIdType, ClientIdType>,
    },
    Error {
        error: ClientError,
    },
}// -- end pub enum ServerSocketIndividualMessage

// === ServerSocketBroadcastMessage ================================================================
//
// Enumerates all messages sent from the server to all clients.
//
// ================================================================================================
#[serde_as]
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerSocketBroadcastMessage {
    LoginUsers {
        users: Vec<UserSummary>,
    },
    LogoutUsers {
        #[serde_as(as = "Vec<DisplayFromStr>")]
        clients: Vec<ClientIdType>,
    },
    SelectedCanvasObject {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_object_id: CanvasObjectIdType,
    },
    UnselectedCanvasObject {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_object_id: CanvasObjectIdType,
    },
    EditingCanvas {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    // TODO: replace HashMaps with Vectors, so object ids don't need to be cast to strings
    CreateShapes {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    },
    UpdateShapes {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    },
    DeleteCanvasObjects {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "Vec<DisplayFromStr>")]
        canvas_object_ids: Vec<CanvasObjectIdType>,
    },
    CreateCanvas {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        canvas: CanvasClientView,
    },
    DeleteCanvases {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "Vec<DisplayFromStr>")]
        canvas_ids: Vec<CanvasIdType>,
    },
    UpdateCanvasAllowedUsers {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "Vec<DisplayFromStr>")]
        allowed_users: Vec<UserIdType>,
    },
    MergeCanvas {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    DeleteWhiteboard,
    Error {
        error: ClientError,
    },
}// -- end pub enum ServerSocketBroadcastMessage

// === enum ServerSocketBroadcastRestMessage =======================================================
//
// Broadcasts a message to all clients except the source client.
//
// =================================================================================================
#[serde_as]
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerSocketBroadcastRestMessage {
    SetCursorPos {
        #[serde_as(as = "DisplayFromStr")]
        client_id: ClientIdType,
        x: f64,
        y: f64,
    },
}// -- end pub enum ServerSocketBroadcastRestMessage

#[derive(Debug, Clone)]
pub enum ServerSocketMessage {
    // -- Messages to send to an individual client
    Individual {
        target_client_id: ClientIdType,
        msg: ServerSocketIndividualMessage,
    },
    Broadcast {
        msg: ServerSocketBroadcastMessage,
    },
    BroadcastRest {
        src_client_id: ClientIdType,
        msg: ServerSocketBroadcastRestMessage,
    },
}// -- end pub enum ServerSocketMessage

// === ClientSocketMessage ========================================================================
//
// Enumerates all messages sent from the client to the server.
//
// ================================================================================================
#[serde_as]
#[derive(Debug, Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ClientSocketMessage {
    EditingCanvas {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    SelectedCanvasObject {
        #[serde_as(as = "DisplayFromStr")]
        canvas_object_id: CanvasObjectIdType,
    },
    UnselectedCanvasObject {
        #[serde_as(as = "DisplayFromStr")]
        canvas_object_id: CanvasObjectIdType,
    },
    CreateShapes {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        shapes: Vec<ShapeModel>,
    },
    UpdateShapes {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    },
    DeleteCanvasObjects {
        #[serde_as(as = "Vec<DisplayFromStr>")]
        canvas_object_ids: Vec<CanvasObjectIdType>,
    },
    CreateCanvas {
        name: String,
        width: f64,
        height: f64,
        parent_canvas: CanvasParentRefClientView,
        #[serde_as(as = "HashSet<DisplayFromStr>")]
        allowed_users: HashSet<UserIdType>,
    },
    DeleteCanvases {
        #[serde_as(as = "Vec<DisplayFromStr>")]
        canvas_ids: Vec<CanvasIdType>,
    },
    Login {
        jwt: String,
    },
    UpdateCanvasAllowedUsers {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashSet<DisplayFromStr>")]
        allowed_users: HashSet<UserIdType>,
    },
    MergeCanvas {
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
    },
    SetCursorPos {
        x: f64,
        y: f64,
    },
    // -- Undo the user's last edit, if possible
    UndoHistory,
} // -- end pub enum ClientSocketMessage
