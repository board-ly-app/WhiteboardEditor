// === protocol.rs =================================================================================
//
// Contains specifications of message protocols sent to and from the client.
//
// =================================================================================================

use serde::{self, Deserialize, Serialize};

use super::models::*;

use std::collections::{HashMap, HashSet};

// === ClientError ================================================================================
//
// Enumerates types of errors the server can send to the client. Sent within both the
// IndividualError and BroadcastError messages.
//
// ================================================================================================
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
        user_id: String,
    },
    // -- Client attempted to access whiteboard that doesn't exist
    WhiteboardNotFound {
        whiteboard_id: String,
    },
    // -- Client attempted to access canvas that doesn't exist
    CanvasNotFound {
        canvas_id: String,
    },
    NoParentCanvas {
        canvas_id: String,
    },
    // -- Another user has selected the resource the client has attempted to edit
    CanvasObjectAlreadySelected {
        // -- id of the selecting client
        client_id: ClientIdType,
    },
    // -- client doesn't have permission to perform a given action
    ActionForbidden {
        // -- description of the forbidden action that was attempted
        action: String,
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
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerSocketIndividualMessage {
    InitClient {
        client_id: ClientIdType,
        whiteboard: WhiteboardClientView,
        active_clients: HashMap<ClientIdType, UserSummary>,
        selectors_by_canvas_objects: HashMap<String, String>,
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
        clients: Vec<ClientIdType>,
    },
    SelectedCanvasObject {
        client_id: ClientIdType,
        canvas_object_id: String,
    },
    UnselectedCanvasObject {
        client_id: ClientIdType,
        canvas_object_id: String,
    },
    EditingCanvas {
        client_id: ClientIdType,
        canvas_id: String,
    },
    // TODO: replace HashMaps with Vectors, so object ids don't need to be cast to strings
    CreateShapes {
        client_id: ClientIdType,
        canvas_id: String,
        shapes: HashMap<String, ShapeModel>,
    },
    UpdateShapes {
        client_id: ClientIdType,
        canvas_id: String,
        shapes: HashMap<String, ShapeModel>,
    },
    DeleteCanvasObjects {
        client_id: ClientIdType,
        canvas_object_ids: Vec<String>,
    },
    CreateCanvas {
        client_id: ClientIdType,
        canvas: CanvasClientView,
    },
    DeleteCanvases {
        client_id: ClientIdType,
        canvas_ids: Vec<String>,
    },
    UpdateCanvasAllowedUsers {
        client_id: ClientIdType,
        canvas_id: String,
        allowed_users: Vec<String>,
    },
    MergeCanvas {
        client_id: ClientIdType,
        canvas_id: String,
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
#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ServerSocketBroadcastRestMessage {
    SetCursorPos {
        client_id: ClientIdType,
        x: usize,
        y: usize,
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
#[derive(Debug, Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ClientSocketMessage {
    EditingCanvas {
        canvas_id: String,
    },
    SelectedCanvasObject {
        canvas_object_id: CanvasObjectIdType,
    },
    UnselectedCanvasObject {
        canvas_object_id: CanvasObjectIdType,
    },
    CreateShapes {
        canvas_id: CanvasIdType,
        shapes: Vec<ShapeModel>,
    },
    UpdateShapes {
        canvas_id: CanvasIdType,
        shapes: HashMap<String, ShapeModel>,
    },
    DeleteCanvasObjects {
        canvas_object_ids: Vec<CanvasObjectIdType>,
    },
    CreateCanvas {
        name: String,
        width: f64,
        height: f64,
        parent_canvas: CanvasParentRefClientView,
        allowed_users: HashSet<UserIdType>,
    },
    DeleteCanvases {
        canvas_ids: Vec<CanvasIdType>,
    },
    Login {
        jwt: String,
    },
    UpdateCanvasAllowedUsers {
        canvas_id: CanvasIdType,
        allowed_users: HashSet<UserIdType>,
    },
    MergeCanvas {
        canvas_id: CanvasIdType,
    },
    SetCursorPos {
        x: usize,
        y: usize,
    },
} // -- end pub enum ClientSocketMessage
