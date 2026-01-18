// -- standard library imports

use std::{
    sync::Arc,
    collections::{
        HashSet,
        HashMap,
    },
};

// -- third party imports

use futures::{
    lock::Mutex,
    TryStreamExt,
};

use tokio::sync::broadcast;
use serde::{
    self,
    Deserialize,
    Serialize,
};
use serde_json;
use serde_with::{
    serde_as,
    DisplayFromStr,
};

use mongodb::{
    Collection,
    options::{
        ClientOptions,
        ServerApi,
        ServerApiVersion,
    },
    bson::{
        self,
        doc,
        oid::ObjectId,
    },
    Client,
    Database,
};

use chrono::{
    self,
    Utc,
};

// -- from unit_tests.rs
#[cfg(test)]
mod unit_tests;

pub type ClientIdType = String;
pub type CanvasIdType = ObjectId;
pub type CanvasObjectIdType = ObjectId;
pub type WhiteboardIdType = ObjectId;
pub type UserIdType = ObjectId;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields="camelCase")]
pub enum ShapeModel {
    Rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        stroke_width: f64,
        stroke_color: String,
        fill_color: String,
        rotation: f64
    },
    Ellipse {
        x: f64,
        y: f64,
        radius_x: f64,
        radius_y: f64,
        stroke_width: f64,
        stroke_color: String,
        fill_color: String,
        rotation: f64
    },
    Vector {
        points: Vec<f64>,
        stroke_width: f64,
        stroke_color: String
    },
    Text {
        text: String,
        font_size: i32,
        color: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        rotation: f64,
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CanvasObject {
    pub id: CanvasObjectIdType,
    pub shape: ShapeModel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasObjectMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub canvas_id: ObjectId,
    #[serde(flatten)]
    pub shape: ShapeModel,
}

impl CanvasObjectMongoDBView {
    pub fn to_canvas_object(&self) -> CanvasObject {
        CanvasObject {
            id: self.id.clone(),
            shape: self.shape.clone()
        }
    }
    
    pub fn from_canvas_object(obj: &CanvasObject, canvas_id: &CanvasIdType) -> Self {
        Self {
            id: obj.id,
            canvas_id: canvas_id.clone(),
            shape: obj.shape.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: UserIdType,
    pub username: String,
    pub email: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserClientView {
    pub id: String,
    pub username: String,
    pub email: String,
}

impl UserClientView {
    pub fn from_user(user: &User) -> Self {
        Self {
            id: user.id.to_string(),
            username: user.username.clone(),
            email: user.email.clone(),
        }
    }// end from_user

    pub fn to_user(&self) -> Result<User, mongodb::bson::oid::Error> {
        Ok(User {
            id: ObjectId::parse_str(&self.id)?,
            username: self.username.clone(),
            email: self.email.clone(),
        })
    }// end to_user
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UserMongoDBView {
    #[serde(rename = "_id")]
    id: ObjectId,
    username: String,
    email: String,
}

impl UserMongoDBView {
    pub fn from_user(user: &User) -> Self {
        Self {
            id: user.id.clone(),
            username: user.username.clone(),
            email: user.email.clone(),
        }
    }// end from_user

    pub fn to_user(&self) -> User {
        User {
            id: self.id.clone(),
            username: self.username.clone(),
            email: self.email.clone(),
        }
    }// end to_user
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    pub client_id: ClientIdType,
    pub user_id: String,
    pub username: String,
}

#[serde_as]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasClientView {
    // Option because it won't have an ID assigned when coming from the client
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde_as(as = "Option<DisplayFromStr>")]
    pub id: Option<ObjectId>,
    pub width: f64,
    pub height: f64,
    pub name: String,
    pub parent_canvas: Option<CanvasParentRefClientView>,
    pub time_created: String,               // rfc3339-encoded datetime
    pub time_last_modified: String,         // rfc3339-encoded datetime
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    pub shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    #[serde_as(as = "Vec<DisplayFromStr>")]
    pub allowed_users: Vec<ObjectId>,         // cast ObjectId to string for proper client-side parsing
}// -- end struct CanvasClientView

#[serde_as]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhiteboardClientView {
    // Option because it won't have an ID assigned when coming from the client
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde_as(as = "Option<DisplayFromStr>")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub canvases: Vec<CanvasClientView>,
    #[serde_as(as = "DisplayFromStr")]
    pub root_canvas: CanvasIdType,
}// -- end struct WhiteboardClientView

// === WhiteboardDiff =============================================================================
//
// Defines an atomic change to be made to the state of the Whiteboard. Used to indicate changes
// that should be written to the database.
//
// Largely overlaps with the ServerSocketMessage and ClientSocketMessage enums defined below.
//
// TODO: refactor ServerSocketMessage and ClientSocketMessage to incorporate WhiteboardDiff,
// instead of duplicating the given fields.
//
// ================================================================================================
#[derive(Debug, Clone)]
pub enum WhiteboardDiff {
    CreateCanvas {
       canvas: Canvas,
    },
    DeleteCanvases {
        canvas_ids: Vec<CanvasIdType>,
    },
    CreateShapes {
        canvas_id: CanvasIdType,
        shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    },
    UpdateShapes {
        canvas_id: CanvasIdType,
        shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    },
    DeleteCanvasObjects {
        canvas_object_ids: Vec<CanvasObjectIdType>,
    },
    UpdateCanvasAllowedUsers {
        canvas_id: CanvasIdType,
        allowed_users: Vec<ObjectId>,
    },
}// -- end enum WhiteboardDiff

// === ClientError ================================================================================
//
// Enumerates types of errors the server can send to the client. Sent within both the
// IndividualError and BroadcastError messages.
//
// ================================================================================================
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
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
}// -- end ClientError

// === ServerSocketMessage ========================================================================
//
// ================================================================================================
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum ServerSocketMessage {
    InitClient {
        client_id: ClientIdType,
        whiteboard: WhiteboardClientView,
        active_clients: HashMap<ClientIdType, UserSummary>,
    },
    LoginUsers {
        users: Vec<UserSummary>,
    },
    LogoutUsers {
        clients: Vec<ClientIdType>,
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
        canvas_object_ids: Vec<CanvasObjectIdType>,
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
    IndividualError {
        client_id: ClientIdType,
        error: ClientError,
    },
    BroadcastError {
        error: ClientError,
    },
}

// === ClientSocketMessage ========================================================================
//
// Enumerates all messages sent from the client to the server.
//
// ================================================================================================
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
pub enum ClientSocketMessage {
    EditingCanvas {
        canvas_id: String,
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
        allowed_users: HashSet::<ObjectId>,
    },
    DeleteCanvases {
        canvas_ids: Vec<CanvasIdType>,
    },
    Login {
        jwt: String,
    },
    UpdateCanvasAllowedUsers {
        canvas_id: CanvasIdType,
        allowed_users: HashSet<ObjectId>,
    },
}

// === CanvasParentRef ============================================================================
//
// Reference to a Canvas' parent, together with the xy coordinates of the top-left corner of the
// current Canvas within its parent.
//
// ================================================================================================
#[derive(Clone, Debug, PartialEq)]
pub struct CanvasParentRef {
    canvas_id: ObjectId,
    origin_x: f64,
    origin_y: f64,
}// -- end struct CanvasParentRef

#[serde_as]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasParentRefClientView {
    #[serde_as(as = "DisplayFromStr")]
    canvas_id: ObjectId,
    origin_x: f64,
    origin_y: f64,
}// -- end struct CanvasParentRefClientView

impl CanvasParentRefClientView {
    pub fn from_canvas_parent_ref(parent_ref: &CanvasParentRef) -> Self {
        Self {
            canvas_id: parent_ref.canvas_id,
            origin_x: parent_ref.origin_x,
            origin_y: parent_ref.origin_y,
        }
    }// -- end from_canvas_parent_ref

    pub fn to_canvas_parent_ref(&self) -> CanvasParentRef {
        CanvasParentRef {
            canvas_id: self.canvas_id,
            origin_x: self.origin_x,
            origin_y: self.origin_y,
        }
    }// -- end to_canvas_parent_ref
}// -- end impl CanvasParentRefClientView

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasParentRefMongoDBView {
    canvas_id: ObjectId,
    origin_x: f64,
    origin_y: f64,
}// -- end struct CanvasParentRefClientView

impl CanvasParentRefMongoDBView {
    pub fn from_canvas_parent_ref(parent_ref: &CanvasParentRef) -> Self {
        Self {
            canvas_id: parent_ref.canvas_id,
            origin_x: parent_ref.origin_x,
            origin_y: parent_ref.origin_y,
        }
    }// -- end from_canvas_parent_ref

    pub fn to_canvas_parent_ref(&self) -> CanvasParentRef {
        CanvasParentRef {
            canvas_id: self.canvas_id,
            origin_x: self.origin_x,
            origin_y: self.origin_y,
        }
    }// -- end to_canvas_parent_ref
}// -- end impl CanvasParentRefMongoDBView

#[derive(Clone, Debug)]
pub struct Canvas {
    pub id: CanvasIdType,
    pub width: f64,
    pub height: f64,
    pub name: String,
    pub time_created: chrono::DateTime<Utc>,
    pub time_last_modified: chrono::DateTime<Utc>,
    pub parent_canvas: Option<CanvasParentRef>,
    pub shapes: HashMap<CanvasObjectIdType, ShapeModel>,
    pub allowed_users: Option<HashSet<ObjectId>>, // None = open to all
}

impl Canvas {
    pub fn to_client_view(&self) -> CanvasClientView {
        // At the moment, the client view is identical to the Canvas type itself, but this may not
        // always be the case.
        CanvasClientView {
            id: Some(self.id),
            width: self.width,
            height: self.height,
            name: self.name.clone(),
            parent_canvas: match self.parent_canvas {
                None => None,
                Some(ref parent) => Some(
                    CanvasParentRefClientView::from_canvas_parent_ref(parent)
                ),
            },
            shapes: self.shapes.clone(),
            time_created: self.time_created.to_rfc3339(),
            time_last_modified: self.time_last_modified.to_rfc3339(),
            allowed_users: match &self.allowed_users {
                Some(set) => set.iter()
                    .map(|oid| *oid)
                    .collect(),
                None => vec![], // empty array means open to all
            },
        }
    }// end pub fn to_client_view(&self) -> CanvasClientView
}

#[derive(Copy, Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(tag = "permission", rename_all = "camelCase")]
pub enum WhiteboardPermissionEnum {
    View,
    Edit,
    Own,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "snake_case")]
pub enum WhiteboardPermissionType {
    User { user: ObjectId },
    Email { email: String },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WhiteboardPermission {
    #[serde(flatten)]
    permission_type: WhiteboardPermissionType,
    #[serde(flatten)]
    permission: WhiteboardPermissionEnum,
}

pub type WhiteboardPermissionMongoDBView = WhiteboardPermission;

// === WhiteboardMetadata =========================================================================
//
// Encompasses data about a whiteboard that doesn't pertain to graphic elements that are updated
// during the process of users editing the whiteboard. This includes the whiteboard's name, id,
// user permissions, etc.
//
// ================================================================================================
#[derive(Clone, Debug)]
pub struct WhiteboardMetadata {
    pub name: String,
    pub user_permissions: Vec<WhiteboardPermission>,
    // For permissions attached to an existing account, index by user id, to enable faster
    // retrieval when users log in.
    pub permissions_by_user_id: HashMap<String, WhiteboardPermissionEnum>,
}// -- end WhiteboardMetadata

#[derive(Clone, Debug)]
pub struct Whiteboard {
    pub id: WhiteboardIdType,
    pub metadata: WhiteboardMetadata,
    pub canvases: HashMap<CanvasIdType, Canvas>,
    pub root_canvas: CanvasIdType,
}// -- end struct Whiteboard

impl Whiteboard {
    pub fn to_client_view(&self) -> WhiteboardClientView {
        // At the moment, the client view is identical to the Canvas type itself, but this may not
        // always be the case.
        WhiteboardClientView {
            id: Some(self.id),
            name: self.metadata.name.clone(),
            canvases: self.canvases.iter()
                .map(|(_, canvas)| canvas.to_client_view())
                .collect(),
            root_canvas: self.root_canvas.clone(),
        }
    }// end pub fn to_client_view(&self) -> CanvasClientView
}

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
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub width: f64,
    pub height: f64,
    pub name: String,
    pub time_created: bson::DateTime,
    pub time_last_modified: bson::DateTime,
    pub parent_canvas: Option<CanvasParentRefMongoDBView>,
    // used to fetch all descendants of the root canvas via a $graphLookup operation in an
    // aggregation pipeline
    // virtual field - don't serialize
    #[serde(skip_serializing)]
    pub canvas_hierarchy: Option<Vec<CanvasMongoDBView>>,
    // virtual field - don't serialize
    #[serde(skip_serializing)]
    pub shapes: Vec<CanvasObjectMongoDBView>,
    pub allowed_users: Option<Vec<ObjectId>>
}

impl CanvasMongoDBView {
    pub fn to_canvas(&self) -> Canvas {
        Canvas {
            id: self.id,
            width: self.width,
            height: self.height,
            name: self.name.clone(),
            time_created: dt_bson_to_chrono_utc(&self.time_created),
            time_last_modified: dt_bson_to_chrono_utc(&self.time_last_modified),
            shapes: self.shapes.iter()
                .map(|shape| (shape.id, shape.to_canvas_object().shape))
                .collect(),
            parent_canvas: match self.parent_canvas {
                None => None,
                Some(ref parent_ref) => Some(parent_ref.to_canvas_parent_ref()),
            },
            allowed_users: match &self.allowed_users {
                None => None,
                Some(users) => Some(users.iter().map(|uid| uid.clone()).collect())
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserPermissionEnum {
    Own,
    Edit,
    View,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UserPermission {
    #[serde(rename = "id")]
    Id {
        user_id: ObjectId,
        permission: UserPermissionEnum,
    },
    #[serde(rename = "email")]
    Email {
        email: String,
        permission: UserPermissionEnum,
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WhiteboardMetadataMongoDBView {
    pub name: String,
    #[serde(rename = "user_permissions")]
    pub user_permissions: Vec<WhiteboardPermissionMongoDBView>,
}// -- end struct WhiteboardMetadataMongoDBView

impl WhiteboardMetadataMongoDBView {
    pub fn to_whiteboard_metadata(&self) -> WhiteboardMetadata {
        WhiteboardMetadata {
            name: self.name.clone(),
            user_permissions: self.user_permissions.clone(),
            permissions_by_user_id: self.user_permissions.iter()
                .map(|wb_perm| match wb_perm.permission_type {
                    WhiteboardPermissionType::User { ref user} => Some((user.to_string(), wb_perm.permission)),
                    _ => None
                })
                .filter(|x| x.is_some())
                .map(|x| x.unwrap())
                .collect(),
        }
    }// -- end fn to_whiteboard_metadata
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WhiteboardMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(flatten)]
    metadata: WhiteboardMetadataMongoDBView,
    root_canvas: ObjectId,
}// -- end struct WhiteboardMongoDBView

impl WhiteboardMongoDBView {
    pub fn to_whiteboard(&self, canvases: &[Canvas]) -> Whiteboard {
        Whiteboard {
            id: self.id,
            metadata: self.metadata.to_whiteboard_metadata(),
            canvases: canvases.iter()
                .map(|canvas| (canvas.id, canvas.clone()))
                .collect(),
            root_canvas: self.root_canvas,
        }
    }
}

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
}

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
}

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
}

// === misc. utils ================================================================================
//
// ================================================================================================

pub fn generate_unique_client_id(whiteboard_id: WhiteboardIdType, index: i32) -> ClientIdType {
    format!("{}.{}", whiteboard_id, index)
}// -- end generate_unique_client_id

pub fn dt_bson_to_chrono_utc(dt: &bson::DateTime) -> chrono::DateTime::<Utc> {
    match chrono::DateTime::<Utc>::from_timestamp_millis(dt.timestamp_millis()) {
        Some(dt) => dt,
        None => {
            panic!("Could not parse bson datetime {} into chrono datetime", dt);
        }
    }
}

pub fn dt_chrono_utc_to_bson(dt: &chrono::DateTime<Utc>) -> bson::DateTime {
    bson::DateTime::from_millis(dt.timestamp_millis())
}

// -- utilify struct for handle_authenticated_client_message, for inspectint raw client messages
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientMessageInspector {
    #[serde(rename = "type")]
    type_tag: String,
}// -- end ClientMessageInspector

// === UserStore ==================================================================================
//
// Trait that defines a way for fetching users by ID. Depending on this trait rather than directly
// on a database client allows the implementation of unit tests without using a database client.
//
// Read-only: does not implement setting, updating, or deleting users.
//
// ================================================================================================
pub trait UserStore {
    fn get_user_by_id(&self, user_id: &UserIdType) -> impl futures::Future<
        Output = Result<Option<User>, Box<dyn std::error::Error + Send + Sync>>
    >;
}// -- end trait UserStore

// === WhiteboardMetadataStore ====================================================================
//
// Trait that defines a way for fetching whiteboard metadata by ID. Depending on this trait rather
// than directly on a database client allows the implementation of unit tests without using a
// database client.
//
// Read-only: does not implement setting, updating, or deleting whiteboards.
//
// ================================================================================================
pub trait WhiteboardMetadataStore {
    fn get_whiteboard_metadata_by_id(&self, whiteboard_id: &WhiteboardIdType) -> impl futures::Future<
        Output = Result<Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>>
    >;
}// -- end trait WhiteboardMetadataStore

// === MongoDBStore ===============================================================================
//
// Interface for fetching objects from the MongoDB database, by id.
//
// ================================================================================================
#[derive(Debug)]
pub struct MongoDBStore {
    user_collection: Collection<UserMongoDBView>,
    whiteboard_metadata_collection: Collection<WhiteboardMetadataMongoDBView>,
}// -- end MongoDBStore

impl MongoDBStore {
    pub fn new(
        user_coll: &Collection<UserMongoDBView>,
        whiteboard_metadata_coll: &Collection<WhiteboardMetadataMongoDBView>
    ) -> Self {
        Self {
            user_collection: user_coll.clone(),
            whiteboard_metadata_collection: whiteboard_metadata_coll.clone(),
        }
    }// -- end fn new(coll: &Collection<UserMongoDBView>) -> Self
}// -- end impl MongoDBStore

impl UserStore for MongoDBStore {
    async fn get_user_by_id(&self, user_id: &UserIdType) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
        match self.user_collection.find_one(doc! { "_id": user_id.clone() }).await? {
            Some(user_view) => Ok(Some(user_view.to_user())),
            None => Ok(None),
        }// -- end match self.user_collection.find_one(doc! { "_id": user_id.clone() }).await
    }
}

impl WhiteboardMetadataStore for MongoDBStore {
    async fn get_whiteboard_metadata_by_id(&self, whiteboard_id: &WhiteboardIdType) -> Result<
        Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>
    > {
        match self.whiteboard_metadata_collection.find_one(doc! { "_id": whiteboard_id.clone() }).await? {
            Some(metadata_view) => Ok(Some(metadata_view.to_whiteboard_metadata())),
            None => Ok(None),
        }// -- end match self.whiteboard_metadata_collection.find_one(doc! { "_id": whiteboard_metadata_id.clone() }).await
    }
}

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

                    match whiteboard.canvases.get_mut(&canvas_id) {
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
                                canvas.shapes.insert(obj_id.clone(), shape.clone());
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

                    match whiteboard.canvases.get_mut(&canvas_id) {
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
                                        if canvas.shapes.contains_key(&obj_id) {
                                            canvas.shapes.insert(obj_id, shape.clone());
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
                    for canvas in whiteboard.canvases.values_mut() {
                        // TODO: refactor to store all canvas objects in one large HashMap
                        for object_id in canvas_object_ids.iter() {
                            canvas.shapes.remove(object_id);
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
                        canvas_object_ids: canvas_object_ids.clone(),
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
                    let canvas = Canvas {
                        id: new_canvas_id,
                        name: name.clone(),
                        width,
                        height,
                        parent_canvas: Some(parent_canvas.to_canvas_parent_ref()),
                        time_created: Utc::now(),
                        time_last_modified: Utc::now(),
                        shapes: HashMap::<CanvasObjectIdType, ShapeModel>::new(),
                        allowed_users: Some(allowed_users),
                    };
                    
                    whiteboard.canvases.insert(
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
                        whiteboard.canvases.remove(&id);
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
                        match whiteboard.metadata.permissions_by_user_id.get(&user_id.to_string()) {
                            None => {
                                return Some(ServerSocketMessage::IndividualError {
                                    client_id: client_state.client_id.clone(),
                                    error: ClientError::Other {
                                        message: format!("User {} not found", user_id),
                                    }
                                });
                            },
                            Some(perm) => match perm {
                                WhiteboardPermissionEnum::View => {
                                    return Some(ServerSocketMessage::IndividualError {
                                        client_id: client_state.client_id.clone(),
                                        error: ClientError::Other {
                                            message: format!("User {} does not have edit permission", user_id),
                                        }
                                    });
                                },
                                WhiteboardPermissionEnum::Edit | WhiteboardPermissionEnum::Own => {},
                            },
                        };
                    }// -- end for user_id in allowed_users.iter()

                    match whiteboard.canvases.get_mut(&canvas_id) {
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
                            canvas.allowed_users = Some(allowed_users.clone());

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
                }
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
                        match store.get_whiteboard_metadata_by_id(&whiteboard.id).await {
                            Err(e) => {
                                eprintln!("Error: could not refresh whiteboard metadata: {}", e);
                            },
                            Ok(None) => {
                                eprintln!("Error: could not refresh whiteboard metadata");
                            },
                            Ok(Some(metadata)) => {
                                whiteboard.metadata = metadata.clone();
                            },
                        };

                        whiteboard.metadata.permissions_by_user_id.get(&user_id.to_string()).copied()
                    };

                    if let Some(permission) = permission {
                        // User has a valid permission
                        let user_summary = UserSummary{
                            client_id: client_state.client_id.clone(),
                            user_id: user_id.to_string(),
                            username: user.username.clone(),
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

pub async fn connect_mongodb(uri: &str) -> mongodb::error::Result<Client> {
    // Replace the placeholder with your Atlas connection string
    let mut client_options = ClientOptions::parse(uri).await?;

    // Set the server_api field of the client_options object to Stable API version 1
    let server_api = ServerApi::builder().version(ServerApiVersion::V1).build();
    client_options.server_api = Some(server_api);

    // Create a new client and connect to the server
    let client = Client::with_options(client_options)?;

    // Send a ping to confirm a successful connection
    client.database("admin").run_command(doc! { "ping": 1 }).await?;
    println!("Pinged your deployment. You successfully connected to MongoDB!");

    Ok(client)
}// end connect_mongodb

pub async fn get_whiteboard_metadata_by_id(db: &Database, wid: &WhiteboardIdType) -> Result<Option<WhiteboardMetadata>, mongodb::error::Error> {
    let metadata_coll = db.collection::<WhiteboardMetadataMongoDBView>("whiteboards");

    match metadata_coll.find_one(doc! { "_id": wid.clone() }).await? {
        None => { return Ok(None); },
        Some(metadata) => Ok(Some(metadata.to_whiteboard_metadata()))
    }
}// -- end get_whiteboard_metadata_by_id

pub async fn get_whiteboard_by_id(db: &Database, wid: &WhiteboardIdType) -> Result<Option<Whiteboard>, mongodb::error::Error> {
    let whiteboard_coll = db.collection::<WhiteboardMongoDBView>("whiteboards");
    let canvas_coll = db.collection::<CanvasMongoDBView>("canvases");

    let whiteboard_view = match whiteboard_coll.find_one(doc! { "_id": wid.clone() }).await? {
        None => { return Ok(None); },
        Some(wb) => wb
    };

    eprintln!("!! whiteboard view: {:?}", whiteboard_view);
    let canvas_cursor = canvas_coll.aggregate([
        // -- locate root canvas
        doc! {
            "$match": {
                "_id": whiteboard_view.root_canvas
            }
        },
        // -- add shapes to root canvas
        doc! {
            "$lookup" : {
                "from" : "shapes",
                "localField" : "_id",
                "foreignField" : "canvas_id",
                "as" : "shapes",
            }
        },
        // -- aggregate descendant canvases
        doc! {
            "$graphLookup" : {
                "from" : "canvases",
                "startWith" : "$_id",
                "connectFromField" : "_id",
                "connectToField" : "parent_canvas.canvas_id",
                "as" : "canvas_hierarchy",
            }
        },
        // -- unwind to allow adding shapes to each descendant canvas
        doc! {
            "$unwind": {
                "path": "$canvas_hierarchy",
                "preserveNullAndEmptyArrays": true
            }
        },
        // -- look up shapes for each descendant canvas
        doc! {
            "$lookup" : {
                "from" : "shapes",
                "localField" : "canvas_hierarchy._id",
                "foreignField" : "canvas_id",
                "as" : "canvas_hierarchy.shapes",
            }
        },
        // -- exclude empty canvas hierarchy containing only shapes from previous stage
        doc! {
          "$set": {
            "canvas_hierarchy": {
              "$cond": {
                "if": {
                  "$not": "$canvas_hierarchy._id"
                },
                "then": "$$REMOVE",
                "else": "$canvas_hierarchy"
              }
            }
          }
        },
        // -- re-group descendant canvases
        doc! {
            "$group": {
                "_id": "$_id",
                "rootDoc": {
                    "$first": "$$ROOT"
                },
                "canvas_hierarchy": {
                    "$push": "$canvas_hierarchy"
                },
            }
        },
        // -- rebuild root canvas
        doc! {
            "$replaceRoot": {
                "newRoot": {
                    "$mergeObjects": [
                        "$rootDoc",
                        {
                            "canvas_hierarchy": "$canvas_hierarchy"
                        }
                    ]
                }
            }
        },
    ])
        .with_type::<CanvasMongoDBView>()
        .await?;
    let canvas_views : Vec<CanvasMongoDBView> = canvas_cursor.try_collect().await?;
    let root_canvas_view = canvas_views.first().ok_or_else(|| mongodb::error::Error::custom(
        format!("Could not find root canvas with id {}", whiteboard_view.root_canvas)
    ))?;
    let mut canvases = vec![ root_canvas_view.to_canvas() ];

    if let Some(canvas_views) = &root_canvas_view.canvas_hierarchy {
        for canvas_view in canvas_views {
            canvases.push(canvas_view.to_canvas());
        }// -- end for canvas_view in canvas_views
    }

    Ok(Some(whiteboard_view.to_whiteboard(canvases.as_slice())))
}// -- end fn get_whiteboard_by_id

// === JWTClaims ==================================================================================
//
// Stores the claims of the JWTs generated by the RestAPI's login service.
//
// Ensure that this struct stays in-sync with the claims generated by the RestAPI.
//
// ================================================================================================
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JWTClaims {
    sub: String,

    // -- the time at which the token was issued, in UNIX epoch seconds
    #[serde(rename = "iat")]
    issued_at_epoch_secs: i64,

    // -- the time at which the token should expire, in UNIX epoch seconds
    #[serde(rename = "exp")]
    expiration_epoch_secs: i64,
}

#[derive(Clone, Debug)]
pub struct JWTExpiredError {
    expiration_dt_utc: Option<chrono::DateTime<Utc>>,
}

impl JWTExpiredError {
    pub fn new(timestamp: i64) -> Self {
        Self {
            expiration_dt_utc: chrono::DateTime::<Utc>::from_timestamp(timestamp, 0),
        }
    }
}

impl std::fmt::Display for JWTExpiredError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "jwt expired at {:?}", self.expiration_dt_utc)
    }
}

impl std::error::Error for JWTExpiredError {}

pub fn get_user_id_from_jwt(token_s: &str, secret: &str) -> Result<ObjectId, Box::<dyn std::error::Error + Send + Sync>> {
    use hmac::{Hmac, Mac};
    use jwt::{
        VerifyWithKey,
        Header,
        Token,
    };
    use sha2::Sha256;

    let key: Hmac<Sha256> = Hmac::new_from_slice(secret.as_bytes())?;
    let token : Token<Header, JWTClaims, _> = token_s.verify_with_key(&key)?;
    let claims = token.claims();

    let timestamp_now_utc = chrono::Local::now().to_utc().timestamp();
    let timestamp_exp_utc = claims.expiration_epoch_secs;
    
    if timestamp_now_utc >= timestamp_exp_utc {
        Err(Box::new(JWTExpiredError::new(timestamp_exp_utc)))
    } else {
        Ok(ObjectId::parse_str(claims.sub.as_str())?)
    }
}
