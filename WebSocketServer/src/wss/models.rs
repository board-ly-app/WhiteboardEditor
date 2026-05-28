// === models.rs ===================================================================================
//
// Contains specifications of objects that the user manipulates via the whiteboard editor interface.
//
// =================================================================================================

use chrono::{self, Utc};
use mongodb::bson::{self, oid::ObjectId};
use serde::{self, Deserialize, Serialize};
use serde_with::{DisplayFromStr, serde_as};

use std::collections::{HashMap, HashSet};

pub type ClientIdType = String;
pub type UserIdType = ObjectId;
pub type CanvasIdType = ObjectId;
pub type CanvasObjectIdType = ObjectId;
pub type WhiteboardIdType = ObjectId;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum CanvasObjectModel {
    Rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        stroke_width: f64,
        stroke_color: String,
        fill_color: String,
        rotation: f64,
    },
    Ellipse {
        x: f64,
        y: f64,
        radius_x: f64,
        radius_y: f64,
        stroke_width: f64,
        stroke_color: String,
        fill_color: String,
        rotation: f64,
    },
    Vector {
        points: Vec<f64>,
        stroke_width: f64,
        stroke_color: String,
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
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct CanvasObject {
    id: CanvasObjectIdType,
    canvas_id: CanvasIdType,
    canvas_object: CanvasObjectModel,
}

#[serde_as]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasObjectClientView {
    #[serde_as(as = "DisplayFromStr")]
    pub id: CanvasObjectIdType,
    #[serde_as(as = "DisplayFromStr")]
    pub canvas_id: CanvasIdType,
    #[serde(flatten)]
    pub canvas_object: CanvasObjectModel,
}

impl CanvasObjectClientView {
    pub fn from_canvas_object(src: &CanvasObject) -> Self {
        Self {
            id: src.id.clone(),
            canvas_id: src.canvas_id.clone(),
            canvas_object: src.canvas_object.clone(),
        }
    }// -- end pub fn from_canvas_object

    pub fn to_canvas_object(&self) -> CanvasObject {
        CanvasObject {
            id: self.id.clone(),
            canvas_id: self.canvas_id.clone(),
            canvas_object: self.canvas_object.clone(),
        }
    }// -- end pub fn to_canvas_object
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasObjectMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub canvas_id: ObjectId,
    #[serde(flatten)]
    pub canvas_object: CanvasObjectModel,
}

impl CanvasObjectMongoDBView {
    pub fn to_canvas_object(&self) -> CanvasObject {
        CanvasObject {
            id: self.id,
            canvas_id: self.canvas_id,
            canvas_object: self.canvas_object.clone(),
        }
    }

    pub fn from_canvas_object(obj: &CanvasObject) -> Self {
        Self {
            id: obj.id,
            canvas_id: obj.canvas_id.clone(),
            canvas_object: obj.canvas_object.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum UserMongoDBView {
    Permanent {
        #[serde(rename = "_id")]
        id: UserIdType,
        username: String,
        email: String,
    },
    #[serde(rename = "temp")]
    Temp {
        #[serde(rename = "_id")]
        id: UserIdType,
        username: String,
        // temp_expires_at: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum UserClientView {
    Permanent {
        id: String,
        username: String,
        email: String,
    },
    Temp {
        id: String,
        username: String,
        // temp_expires_at: String,
    },
}

impl UserClientView {
    pub fn from_user(user: &User) -> Self {
        match user {
            User::Permanent {
                id,
                username,
                email,
            } => Self::Permanent {
                id: id.to_hex(),
                username: username.clone(),
                email: email.clone(),
            },
            User::Temp {
                id,
                username,
                // temp_expires_at,
            } => Self::Temp {
                id: id.to_hex(),
                username: username.clone(),
                // temp_expires_at: temp_expires_at.clone(),
            },
        }
    } // end from_user

    pub fn to_user(&self) -> Result<User, mongodb::bson::oid::Error> {
        match self {
            Self::Permanent {
                id,
                username,
                email,
            } => Ok(User::Permanent {
                id: ObjectId::parse_str(id)?,
                username: username.clone(),
                email: email.clone(),
            }),
            Self::Temp {
                id,
                username,
                // temp_expires_at,
            } => Ok(User::Temp {
                id: ObjectId::parse_str(id)?,
                username: username.clone(),
                // temp_expires_at: temp_expires_at.clone(),
            }),
        }
    } // end to_user
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum User {
    Permanent {
        id: ObjectId,
        username: String,
        email: String,
    },
    Temp {
        id: ObjectId,
        username: String,
        // temp_expires_at: String,
    },
}

impl UserMongoDBView {
    pub fn from_user(user: &User) -> Self {
        match user {
            User::Permanent {
                id,
                username,
                email,
            } => Self::Permanent {
                id: *id,
                username: username.clone(),
                email: email.clone(),
            },
            User::Temp {
                id,
                username,
                // temp_expires_at,
            } => Self::Temp {
                id: *id,
                username: username.clone(),
                // temp_expires_at: temp_expires_at.clone(),
            },
        }
    } // end from_user

    pub fn to_user(&self) -> User {
        match self {
            Self::Permanent {
                id,
                username,
                email,
            } => User::Permanent {
                id: *id,
                username: username.clone(),
                email: email.clone(),
            },
            Self::Temp {
                id,
                username,
                // temp_expires_at,
            } => User::Temp {
                id: *id,
                username: username.clone(),
                // temp_expires_at: temp_expires_at.clone(),
            },
        }
    } // end to_user
}

#[serde_as]
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    #[serde_as(as = "DisplayFromStr")]
    pub client_id: ClientIdType,
    #[serde_as(as = "DisplayFromStr")]
    pub user_id: UserIdType,
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
    pub time_created: String,       // rfc3339-encoded datetime
    pub time_last_modified: String, // rfc3339-encoded datetime
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    pub canvas_objects: std::collections::HashMap<CanvasObjectIdType, CanvasObjectModel>,
    #[serde_as(as = "Vec<DisplayFromStr>")]
    pub allowed_users: Vec<ObjectId>, // cast ObjectId to string for proper client-side parsing
} // -- end struct CanvasClientView

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
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    pub permissions_by_user_id: HashMap<UserIdType, WhiteboardPermissionEnum>,
} // -- end struct WhiteboardClientView

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
} // -- end struct CanvasParentRef

impl CanvasParentRef {
    pub fn canvas_id(&self) -> &ObjectId {
        &self.canvas_id
    } // -- end pub fn canvas_id

    pub fn canvas_id_mut(&mut self) -> &mut ObjectId {
        &mut self.canvas_id
    } // -- end pub fn canvas_id

    pub fn origin_x(&self) -> f64 {
        self.origin_x
    } // -- end pub fn origin_x

    pub fn origin_x_mut(&mut self) -> &mut f64 {
        &mut self.origin_x
    } // -- end pub fn origin_x

    pub fn origin_y(&self) -> f64 {
        self.origin_y
    } // -- end pub fn origin_y

    pub fn origin_y_mut(&mut self) -> &mut f64 {
        &mut self.origin_y
    } // -- end pub fn origin_y
} // -- end impl CanvasParentRef

#[serde_as]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasParentRefClientView {
    #[serde_as(as = "DisplayFromStr")]
    pub canvas_id: ObjectId,
    pub origin_x: f64,
    pub origin_y: f64,
} // -- end struct CanvasParentRefClientView

impl CanvasParentRefClientView {
    pub fn from_canvas_parent_ref(parent_ref: &CanvasParentRef) -> Self {
        Self {
            canvas_id: parent_ref.canvas_id,
            origin_x: parent_ref.origin_x,
            origin_y: parent_ref.origin_y,
        }
    } // -- end from_canvas_parent_ref

    pub fn to_canvas_parent_ref(&self) -> CanvasParentRef {
        CanvasParentRef {
            canvas_id: self.canvas_id,
            origin_x: self.origin_x,
            origin_y: self.origin_y,
        }
    } // -- end to_canvas_parent_ref
} // -- end impl CanvasParentRefClientView

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasParentRefMongoDBView {
    pub canvas_id: ObjectId,
    pub origin_x: f64,
    pub origin_y: f64,
} // -- end struct CanvasParentRefClientView

impl CanvasParentRefMongoDBView {
    pub fn from_canvas_parent_ref(parent_ref: &CanvasParentRef) -> Self {
        Self {
            canvas_id: parent_ref.canvas_id,
            origin_x: parent_ref.origin_x,
            origin_y: parent_ref.origin_y,
        }
    } // -- end from_canvas_parent_ref

    pub fn to_canvas_parent_ref(&self) -> CanvasParentRef {
        CanvasParentRef {
            canvas_id: self.canvas_id,
            origin_x: self.origin_x,
            origin_y: self.origin_y,
        }
    } // -- end to_canvas_parent_ref
} // -- end impl CanvasParentRefMongoDBView

#[derive(Clone, Debug)]
pub struct Canvas {
    id: CanvasIdType,
    width: f64,
    height: f64,
    name: String,
    time_created: chrono::DateTime<Utc>,
    time_last_modified: chrono::DateTime<Utc>,
    parent_canvas: Option<CanvasParentRef>,
    canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
    allowed_users: Option<HashSet<ObjectId>>, // None = open to all
}

impl Canvas {
    pub fn new(
        id: &CanvasIdType,
        width: f64,
        height: f64,
        name: &str,
        time_created: &chrono::DateTime<Utc>,
        time_last_modified: &chrono::DateTime<Utc>,
        parent_canvas: Option<&CanvasParentRef>,
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
        allowed_users: Option<HashSet<ObjectId>>, // None = open to all
    ) -> Self {
        Self {
            id: *id,
            width,
            height,
            name: String::from(name),
            time_created: *time_created,
            time_last_modified: *time_last_modified,
            parent_canvas: parent_canvas.cloned(),
            canvas_objects,
            allowed_users,
        }
    } // -- end pub fn new

    pub fn to_client_view(&self) -> CanvasClientView {
        // At the moment, the client view is identical to the Canvas type itself, but this may not
        // always be the case.
        CanvasClientView {
            id: Some(self.id),
            width: self.width,
            height: self.height,
            name: self.name.clone(),
            parent_canvas: self.parent_canvas.as_ref().map(CanvasParentRefClientView::from_canvas_parent_ref),
            canvas_objects: self.canvas_objects.clone(),
            time_created: self.time_created.to_rfc3339(),
            time_last_modified: self.time_last_modified.to_rfc3339(),
            allowed_users: match &self.allowed_users {
                Some(set) => set.iter().copied().collect(),
                None => vec![], // empty array means open to all
            },
        }
    } // end pub fn to_client_view(&self) -> CanvasClientView

    pub fn id(&self) -> &CanvasIdType {
        &self.id
    } // -- end pub fn id

    pub fn name(&self) -> &str {
        self.name.as_str()
    } // -- end pub fn name

    pub fn width(&self) -> f64 {
        self.width
    } // -- end pub fn width

    pub fn height(&self) -> f64 {
        self.height
    } // -- end pub fn height

    pub fn time_created(&self) -> &chrono::DateTime<Utc> {
        &self.time_created
    } // -- end pub fn time_created

    pub fn time_last_modified(&self) -> &chrono::DateTime<Utc> {
        &self.time_last_modified
    } // -- end pub fn time_last_modified

    pub fn allowed_users(&self) -> Option<&HashSet<ObjectId>> {
        self.allowed_users.as_ref()
    } // -- end pub fn allowed_users

    pub fn canvas_objects(&self) -> &HashMap<CanvasObjectIdType, CanvasObjectModel> {
        &self.canvas_objects
    } // -- end pub fn canvas_objects

    pub fn canvas_objects_mut(&mut self) -> &mut HashMap<CanvasObjectIdType, CanvasObjectModel> {
        &mut self.canvas_objects
    } // -- end pub fn canvas_objects

    pub fn parent_canvas(&self) -> Option<&CanvasParentRef> {
        self.parent_canvas.as_ref()
    } // -- end pub fn parent_canvas

    pub fn parent_canvas_mut(&mut self) -> Option<&mut CanvasParentRef> {
        self.parent_canvas.as_mut()
    } // -- end pub fn parent_canvas

    pub fn set_allowed_users(&mut self, allowed_users: Option<&HashSet<ObjectId>>) {
        if let Some(a_users) = allowed_users {
            self.allowed_users = Some(a_users.clone());
        } else {
            self.allowed_users = None;
        }
    } // -- end pub fn set_allowed_users
} // -- end impl Canvas

#[derive(Copy, Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(tag = "permission", rename_all = "camelCase")]
pub enum WhiteboardPermissionEnum {
    View,
    Edit,
    Own,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "snake_case"
)]
pub enum WhiteboardPermissionType {
    User {
        user: ObjectId,
        email: Option<String>,
    },
    Email {
        email: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WhiteboardPermission {
    #[serde(flatten)]
    pub permission_type: WhiteboardPermissionType,
    #[serde(flatten)]
    pub permission: WhiteboardPermissionEnum,
}

pub type WhiteboardPermissionMongoDBView = WhiteboardPermission;
pub type WhiteboardPermissionClientView = WhiteboardPermission;

// === WhiteboardMetadata =========================================================================
//
// Encompasses data about a whiteboard that doesn't pertain to graphic elements that are updated
// during the process of users editing the whiteboard. This includes the whiteboard's name, id,
// user permissions, etc.
//
// ================================================================================================
#[derive(Clone, Debug)]
pub struct WhiteboardMetadata {
    name: String,
    user_permissions: Vec<WhiteboardPermission>,
    // For permissions attached to an existing account, index by user id, to enable faster
    // retrieval when users log in.
    permissions_by_user_id: HashMap<UserIdType, WhiteboardPermissionEnum>,
} // -- end WhiteboardMetadata

impl WhiteboardMetadata {
    pub fn new(
        name: String,
        user_permissions: Vec<WhiteboardPermission>,
        permissions_by_user_id: HashMap<UserIdType, WhiteboardPermissionEnum>,
    ) -> Self {
        Self {
            name,
            user_permissions,
            permissions_by_user_id,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn user_permissions(&self) -> &[WhiteboardPermission] {
        &self.user_permissions
    }

    pub fn permission_for_user(&self, user_id: &UserIdType) -> Option<WhiteboardPermissionEnum> {
        self.permissions_by_user_id.get(user_id).copied()
    }
}

// === Whiteboard ==================================================================================
//
// Encompasses all business logic regarding a single whiteboard.
//
// =================================================================================================
#[derive(Clone, Debug)]
pub struct Whiteboard {
    id: WhiteboardIdType,
    is_active: bool,
    metadata: WhiteboardMetadata,
    canvases: HashMap<CanvasIdType, Canvas>,
    root_canvas: CanvasIdType,
    // -- A series of contiguous, ordered 
    edit_history_by_author: HashMap<UserIdType, Vec<Edit>>,
} // -- end struct Whiteboard

impl Whiteboard {
    pub fn new(
        id: WhiteboardIdType,
        is_active: bool,
        metadata: WhiteboardMetadata,
        root_canvas: CanvasIdType,
        canvases: HashMap<CanvasIdType, Canvas>,
        edit_history: Vec<Edit>,
    ) -> Self {
        let mut edit_history_by_author = HashMap::<UserIdType, Vec<Edit>>::new();

        for edit in edit_history.iter() {
            if let Some(edits) = edit_history_by_author.get_mut(&edit.author) {
                edits.push(edit.clone());
            } else {
                edit_history_by_author.insert(edit.author.clone(), vec![ edit.clone() ]);
            }
        }// -- end for edit

        Self {
            id,
            is_active,
            metadata,
            canvases,
            root_canvas,
            edit_history_by_author,
        }
    } // -- end pub fn new

    // -- TODO: refactor to make use of references to original object, scoped by lifetime
    pub fn to_client_view(&self) -> WhiteboardClientView {
        // At the moment, the client view is identical to the Canvas type itself, but this may not
        // always be the case.
        WhiteboardClientView {
            id: Some(self.id),
            name: self.metadata.name().to_string(),
            canvases: self
                .canvases.values().map(|canvas| canvas.to_client_view())
                .collect(),
            root_canvas: self.root_canvas,
            permissions_by_user_id: self.metadata.permissions_by_user_id.clone(),
        }
    } // end pub fn to_client_view(&self) -> CanvasClientView

    pub fn id(&self) -> &WhiteboardIdType {
        &self.id
    } // -- end pub fn id

    pub fn canvases(&self) -> &HashMap<CanvasIdType, Canvas> {
        &self.canvases
    } // -- end pub fn canvases

    pub fn canvases_mut(&mut self) -> &mut HashMap<CanvasIdType, Canvas> {
        &mut self.canvases
    } // -- end pub fn canvases

    pub fn metadata(&self) -> &WhiteboardMetadata {
        &self.metadata
    } // -- end pub fn metadata

    pub fn metadata_mut(&mut self) -> &mut WhiteboardMetadata {
        &mut self.metadata
    } // -- end pub fn metadata

    pub fn is_active(&self) -> bool {
        self.is_active
    } // -- end pub fn is_active

    pub fn root_canvas(&self) -> &CanvasIdType {
        &self.root_canvas
    } // -- end pub fn root_canvas
} // -- end impl Whiteboard

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
    pub canvas_objects: Vec<CanvasObjectMongoDBView>,
    pub allowed_users: Option<Vec<ObjectId>>,
}

impl CanvasMongoDBView {
    pub fn to_canvas(&self) -> Canvas {
        use super::utils::dt_bson_to_chrono_utc;

        Canvas {
            id: self.id,
            width: self.width,
            height: self.height,
            name: self.name.clone(),
            time_created: dt_bson_to_chrono_utc(&self.time_created),
            time_last_modified: dt_bson_to_chrono_utc(&self.time_last_modified),
            canvas_objects: self
                .canvas_objects
                .iter()
                .map(|canvas_object| (canvas_object.id, canvas_object.to_canvas_object().canvas_object))
                .collect(),
            parent_canvas: self.parent_canvas.as_ref().map(|parent_ref| parent_ref.to_canvas_parent_ref()),
            allowed_users: self.allowed_users.as_ref().map(|users| users.iter().copied().collect()),
        }
    } // -- end pub fn to_canvas

    pub fn from_canvas(canvas: &Canvas) -> Self {
        use super::utils::dt_chrono_utc_to_bson;

        Self {
            id: canvas.id,
            width: canvas.width,
            height: canvas.height,
            name: canvas.name.clone(),
            time_created: dt_chrono_utc_to_bson(&canvas.time_created),
            time_last_modified: dt_chrono_utc_to_bson(&canvas.time_last_modified),
            parent_canvas: canvas
                .parent_canvas
                .as_ref()
                .map(CanvasParentRefMongoDBView::from_canvas_parent_ref),
            // canvas_hierarchy: Option<Vec<CanvasMongoDBView>>,
            canvas_hierarchy: None,
            canvas_objects: vec![],
            allowed_users: None,
        }
    } // -- end pub fn from_canvas
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
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WhiteboardMetadataMongoDBView {
    pub name: String,
    #[serde(rename = "user_permissions")]
    pub user_permissions: Vec<WhiteboardPermissionMongoDBView>,
} // -- end struct WhiteboardMetadataMongoDBView

impl WhiteboardMetadataMongoDBView {
    pub fn to_whiteboard_metadata(&self) -> WhiteboardMetadata {
        let permissions_by_user_id = self
            .user_permissions
            .iter()
            .filter_map(|wb_perm| match wb_perm.permission_type {
                WhiteboardPermissionType::User { ref user, .. } => {
                    Some((user.clone(), wb_perm.permission))
                }
                _ => None,
            })
            .collect();
        WhiteboardMetadata::new(
            self.name.clone(),
            self.user_permissions.clone(),
            permissions_by_user_id,
        )
    } // -- end fn to_whiteboard_metadata
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct WhiteboardMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(flatten)]
    pub metadata: WhiteboardMetadataMongoDBView,
    pub root_canvas: ObjectId,
} // -- end struct WhiteboardMongoDBView

impl WhiteboardMongoDBView {
    pub fn to_whiteboard(&self, canvases: &[Canvas], edits: &[Edit]) -> Whiteboard {
        let mut edit_history_by_author = HashMap::<UserIdType, Vec<Edit>>::new();

        for edit in edits.iter() {
            if let Some(edits) = edit_history_by_author.get_mut(&edit.author) {
                edits.push(edit.clone());
            } else {
                edit_history_by_author.insert(edit.author.clone(), vec![ edit.clone() ]);
            }
        }// -- end for edit
         //
        Whiteboard {
            id: self.id,
            is_active: true,
            metadata: self.metadata.to_whiteboard_metadata(),
            canvases: canvases
                .iter()
                .map(|canvas| (canvas.id, canvas.clone()))
                .collect(),
            root_canvas: self.root_canvas,
            edit_history_by_author,
        }
    }
}

// === Edits =======================================================================================
//
// Define atomic, reversible edits to a whiteboard.
//
// Each edit contains:
//  - An author (user) id
//  - A whiteboard id
//  - A timestamp
//
// =================================================================================================

pub type EditIdType = ObjectId;

#[derive(Clone,Debug)]
pub struct CanvasObjectUpdate {
    old_fields: CanvasObjectModel,
    new_fields: CanvasObjectModel,
}

#[derive(Debug,Clone)]
pub enum EditKind {
    CreateCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObject>,
    },
    UpdateCanvasObjects {
        updates: HashMap<CanvasObjectIdType, CanvasObjectUpdate>,
    },
    DeleteCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObject>,
    },
    CreateCanvas {
        canvas: Canvas,
    },
    DeleteCanvas {
        canvas: Canvas,
    },
    MergeCanvas {
        child_canvas: Canvas,
    },
}// -- end pub enum EditKind

#[derive(Debug,Clone)]
pub struct Edit {
    id: EditIdType,
    author: UserIdType,
    whiteboard: WhiteboardIdType,
    committed_at: chrono::DateTime<Utc>,
    edit: EditKind,
}// -- end pub struct Edit

impl Edit {
    // === pub fn new ==============================================================================
    //
    // Generates a new Edit at the current time (in UTC) with a unique object ID.
    //
    // =============================================================================================
    pub fn new(
        author: &UserIdType,
        whiteboard: &WhiteboardIdType,
        edit: EditKind,
    ) -> Self {
        Self {
            id: ObjectId::new(),
            author: author.clone(),
            whiteboard: whiteboard.clone(),
            committed_at: Utc::now(),
            edit,
        }
    }// -- end pub fn new
}// -- end impl Edit

// === EditClientView ==============================================================================
//
// An edit as provided to a client.
//
// The actual contents of each edit aren't provided vai the web socket server, only the metadata.
//
// Users will be able to see the results of applying/reversing each edit by instructing the web
// socket server to apply/reverse each edit.
//
// =================================================================================================
#[serde_as]
#[derive(Debug,Clone,Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditClientView {
    #[serde_as(as = "DisplayFromStr")]
    id: EditIdType,
    #[serde_as(as = "DisplayFromStr")]
    author: UserIdType,
    committed_at: bson::DateTime,
}// -- end pub struct Edit

impl EditClientView {
    pub fn from_edit(edit: &Edit) -> Self {
        use super::utils::dt_chrono_utc_to_bson;

        Self {
            id: edit.id.clone(),
            author: edit.author.clone(),
            committed_at: dt_chrono_utc_to_bson(&edit.committed_at),
        }
    }// -- end pub fn from_edit
}// -- end impl EditClientView

#[serde_as]
#[derive(Clone,Debug,Serialize,Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasObjectUpdateMongoDBView {
    old_fields: CanvasObjectModel,
    new_fields: CanvasObjectModel,
}

#[serde_as]
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum EditKindMongoDBView {
    CreateCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectMongoDBView>,
    },
    UpdateCanvasObjects {
        updates: HashMap<CanvasObjectIdType, CanvasObjectUpdateMongoDBView>,
    },
    DeleteCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectMongoDBView>,
    },
    CreateCanvas {
        canvas: CanvasMongoDBView,
    },
    DeleteCanvas {
        canvas: CanvasMongoDBView,
    },
    MergeCanvas {
        child_canvas: CanvasMongoDBView,
    },
}// -- end pub enum EditKindMongoDBView

impl EditKindMongoDBView {
    pub fn to_edit_kind(&self) -> EditKind {
        match self {
            EditKindMongoDBView::CreateCanvasObjects {
                canvas_objects,
            } => EditKind::CreateCanvasObjects {
                canvas_objects: canvas_objects.iter().map(
                    |(id, obj)| (id.clone(), obj.to_canvas_object())
                ).collect()
            },
            EditKindMongoDBView::UpdateCanvasObjects {
                updates,
            } => EditKind::UpdateCanvasObjects {
                updates: updates.iter().map(
                    |(id, update)| (id.clone(), CanvasObjectUpdate {
                        old_fields: update.old_fields.clone(),
                        new_fields: update.new_fields.clone(),
                })).collect()
            },
            EditKindMongoDBView::DeleteCanvasObjects {
                canvas_objects,
            } => EditKind::DeleteCanvasObjects {
                canvas_objects: canvas_objects.iter().map(
                    |(id, obj)| (id.clone(), obj.to_canvas_object())
                ).collect()
            },
            EditKindMongoDBView::CreateCanvas {
                canvas,
            } => EditKind::CreateCanvas {
                canvas: canvas.to_canvas()
            },
            EditKindMongoDBView::DeleteCanvas {
                canvas,
            } => EditKind::DeleteCanvas {
                canvas: canvas.to_canvas(),
            },
            EditKindMongoDBView::MergeCanvas {
                child_canvas,
            } => EditKind::MergeCanvas {
                child_canvas: child_canvas.to_canvas(),
            },
        }// -- end match self
    }// -- end pub fn to_edit_kind

    pub fn from_edit_kind(edit_kind: &EditKind) -> Self {
        match edit_kind {
            EditKind::CreateCanvasObjects {
                canvas_objects,
            } => EditKindMongoDBView::CreateCanvasObjects {
                canvas_objects: canvas_objects.iter()
                    .map(|(id, obj)| (id.clone(), CanvasObjectMongoDBView::from_canvas_object(obj)))
                    .collect()
            },
            EditKind::UpdateCanvasObjects {
                updates,
            } => EditKindMongoDBView::UpdateCanvasObjects {
                updates: updates.iter().map(
                    |(id, update)| (id.clone(), CanvasObjectUpdateMongoDBView {
                        old_fields: update.old_fields.clone(),
                        new_fields: update.new_fields.clone(),
                })).collect()
            },
            EditKind::DeleteCanvasObjects {
                canvas_objects,
            } => EditKindMongoDBView::DeleteCanvasObjects {
                canvas_objects: canvas_objects.iter()
                    .map(|(id, obj)| (id.clone(), CanvasObjectMongoDBView::from_canvas_object(obj)))
                    .collect()
            },
            EditKind::CreateCanvas {
                canvas,
            } => EditKindMongoDBView::CreateCanvas {
                canvas: CanvasMongoDBView::from_canvas(canvas),
            },
            EditKind::DeleteCanvas {
                canvas,
            } => EditKindMongoDBView::DeleteCanvas {
                canvas: CanvasMongoDBView::from_canvas(canvas),
            },
            EditKind::MergeCanvas {
                child_canvas,
            } => EditKindMongoDBView::MergeCanvas {
                child_canvas: CanvasMongoDBView::from_canvas(child_canvas),
            },
        }// -- end match self
    }// -- end pub fn from_edit_kind
}// -- end impl EditKindMongoDBView

#[serde_as]
#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditMongoDBView {
    #[serde_as(as = "DisplayFromStr")]
    id: EditIdType,
    #[serde_as(as = "DisplayFromStr")]
    author: UserIdType,
    #[serde_as(as = "DisplayFromStr")]
    whiteboard: WhiteboardIdType,
    committed_at: bson::DateTime,
    #[serde(flatten)]
    edit: EditKindMongoDBView,
}// -- end pub struct Edit

impl EditMongoDBView {
    pub fn to_edit(&self) -> Edit {
        use super::utils::dt_bson_to_chrono_utc;

        Edit {
            id: self.id.clone(),
            author: self.author.clone(),
            whiteboard: self.whiteboard.clone(),
            committed_at: dt_bson_to_chrono_utc(&self.committed_at),
            edit: self.edit.to_edit_kind(),
        }
    }// -- end pub fn to_edit

    pub fn from_edit(edit: &Edit) -> Self {
        use super::utils::dt_chrono_utc_to_bson;

        Self {
            id: edit.id.clone(),
            author: edit.author.clone(),
            whiteboard: edit.whiteboard.clone(),
            committed_at: dt_chrono_utc_to_bson(&edit.committed_at),
            edit: EditKindMongoDBView::from_edit_kind(&edit.edit),
        }
    }// -- end pub fn from_edit
}// -- end impl EditMongoDBView
