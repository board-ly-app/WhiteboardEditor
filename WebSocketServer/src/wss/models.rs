// === models.rs ===================================================================================
//
// Contains specifications of objects that the user manipulates via the whiteboard editor interface.
//
// =================================================================================================

use super::{db::WhiteboardDiff,protocol::{ServerSocketMessage,ServerSocketBroadcastMessage}};

use chrono::{self, Utc};
use mongodb::bson::{self, oid::ObjectId, serde_helpers::bson_datetime_as_rfc3339_string};
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
    pub id: CanvasObjectIdType,
    pub canvas_id: CanvasIdType,
    pub canvas_object: CanvasObjectModel,
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
    pub visibility: WhiteboardVisibilityEnum,
    #[serde_as(as = "HashMap<DisplayFromStr, _>")]
    pub permissions_by_user_id: HashMap<UserIdType, WhiteboardPermissionEnumClientView>,
    pub permissions_by_email: HashMap<String, WhiteboardPermissionEnumClientView>,
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
#[serde(rename_all = "snake_case")]
pub enum WhiteboardVisibilityEnum {
    Public,
    Private,
}

#[derive(Copy, Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(tag = "permission", rename_all = "camelCase")]
pub enum WhiteboardPermissionEnum {
    View,
    Edit,
    Own,
}

#[derive(Copy, Clone, PartialEq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WhiteboardPermissionEnumClientView {
    View,
    Edit,
    Own,
}

impl WhiteboardPermissionEnumClientView {
    pub fn from_permission_enum(perm: &WhiteboardPermissionEnum) -> Self {
        use WhiteboardPermissionEnum::*;

        match perm {
            View => Self::View,
            Edit => Self::Edit,
            Own => Self::Own,
        }// -- end match perm
    }// -- end pub fn from_permission_enum

    pub fn to_permission_enum(&self) -> WhiteboardPermissionEnum {
        use WhiteboardPermissionEnum::*;

        match self {
            Self::View => View,
            Self::Edit => Edit,
            Self::Own => Own,
        }// -- end match self
    }// -- end pub fn to_permission_enum
}// -- end impl WhiteboardPermissionEnumClientView

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
    visibility: WhiteboardVisibilityEnum,
    // For permissions attached to an existing account, index by user id, to enable faster
    // retrieval when users log in.
    permissions_by_user_id: HashMap<UserIdType, WhiteboardPermissionEnum>,
    // -- email address => permission
    permissions_by_email: HashMap<String, WhiteboardPermissionEnum>,
} // -- end WhiteboardMetadata

impl WhiteboardMetadata {
    pub fn new(
        name: String,
        visibility: WhiteboardVisibilityEnum,
        permissions: &[WhiteboardPermission],
    ) -> Self {
        let mut permissions_by_user_id = HashMap::<UserIdType, WhiteboardPermissionEnum>::new();
        let mut permissions_by_email = HashMap::<String, WhiteboardPermissionEnum>::new();

        for perm in permissions.iter() {
            match &perm.permission_type {
                WhiteboardPermissionType::User {
                    user: user_id, ..
                } => {
                    let _ = permissions_by_user_id.insert(user_id.clone(), perm.permission.clone());
                },
                WhiteboardPermissionType::Email {
                    email,
                } => {
                    let _ = permissions_by_email.insert(email.clone(), perm.permission.clone());
                },
            };// -- end match perm.permission_type
        }// -- end for perm

        Self {
            name,
            visibility,
            permissions_by_user_id,
            permissions_by_email,
        }
    }// -- end fn new

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn visibility(&self) -> WhiteboardVisibilityEnum {
        self.visibility
    }

    pub fn permissions_by_user_id(&self) -> &HashMap<UserIdType, WhiteboardPermissionEnum> {
        &self.permissions_by_user_id
    }// -- end pub fn permissions_by_user_id

    pub fn permissions_by_email(&self) -> &HashMap<String, WhiteboardPermissionEnum> {
        &self.permissions_by_email
    }// -- end pub fn permissions_by_email

    pub fn permission_for_user(&self, user_id: &UserIdType) -> Option<WhiteboardPermissionEnum> {
        if self.visibility == WhiteboardVisibilityEnum::Public {
            return Some(WhiteboardPermissionEnum::Edit);
        }
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
    // -- A series of contiguous, chronologically-ordered edits applied to this edit by each author
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
            visibility: self.metadata.visibility(),
            permissions_by_user_id: self.metadata.permissions_by_user_id.iter()
                .map(|(uid, perm)|
                    (uid.clone(), WhiteboardPermissionEnumClientView::from_permission_enum(&perm))
                )
                .collect(),
            permissions_by_email: self.metadata.permissions_by_email.iter()
                .map(|(email, perm)|
                    (email.clone(), WhiteboardPermissionEnumClientView::from_permission_enum(&perm))
                )
                .collect(),
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

    pub fn set_permissions(&mut self, permissions: &[WhiteboardPermission]) {
        self.metadata.permissions_by_user_id.clear();
        self.metadata.permissions_by_email.clear();

        for perm in permissions.iter() {
            match &perm.permission_type {
                WhiteboardPermissionType::User {
                    user: user_id,
                    ..
                } => {
                    self.metadata.permissions_by_user_id.insert(
                        user_id.clone(), perm.permission.clone()
                    );
                },
                WhiteboardPermissionType::Email {
                    email,
                } => {
                    self.metadata.permissions_by_email.insert(
                        email.clone(), perm.permission.clone()
                    );
                },
            };// -- end match perm.permission_type
        }// -- end for perm
    }// -- end pub fn set_permissions

    pub fn push_edit(&mut self, edit: &Edit) {
        if let Some(author_edit_history) = self.edit_history_by_author.get_mut(&edit.author) {
            author_edit_history.push(edit.clone());
        } else {
            self.edit_history_by_author.insert(edit.author.clone(), vec![ edit.clone() ]);
        }
    }// -- end pub fn push_edit

    // === force_commit_edit =======================================================================
    //
    // Applies and pushes an edit without checking if it applies to the whiteboard. Should only be
    // performed if the caller knows the whiteboard state hasn't been modified since the edit was
    // generated.
    //
    // =============================================================================================
    pub fn force_commit_edit(&mut self, edit: &Edit) {
        self.apply_edit(edit);
        self.push_edit(edit);
    }// -- end pub fn force_commit_edit

    // === reverse_edit_by_author ==================================================================
    //
    // Reverses the latest edit by the given author, if such an edit exists and can be applied to
    // the whiteboard.
    //
    // =============================================================================================
    pub fn reverse_edit_by_author(&mut self, author_id: &UserIdType) -> Option<Edit> {
        let reverse_edit = if let Some(edit_history) = self.edit_history_by_author.get(author_id) {
            if let Some(last_edit) = edit_history.last() {
                let reverse_edit = last_edit.generate_reverse(author_id);

                if self.can_apply_edit(&reverse_edit) {
                    reverse_edit
                } else {
                    return None;
                }
            } else {
                return None;
            }
        } else {
            return None;
        };

        if self.can_apply_edit(&reverse_edit) {
            self.apply_edit(&reverse_edit);

            self.pop_edit_by_author(author_id)
        } else {
            None
        }
    }// -- end pub fn reverse_edit_by_author

    pub fn pop_edit_by_author(&mut self, author_id: &UserIdType) -> Option<Edit> {
        if let Some(author_edit_history) = self.edit_history_by_author.get_mut(author_id) {
            author_edit_history.pop()
        } else {
            None
        }
    }// -- end pub fn pop_edit_by_author

    pub fn clear_edits_by_author(&mut self, author_id: &UserIdType) {
        self.edit_history_by_author.remove(author_id);
    }// -- end pub fn clear_edits_by_author

    pub fn can_apply_edit(&self, edit: &Edit) -> bool {
        use EditKind::*;

        // -- Tolerance for difference between two f64 values, below which they will be treated as
        // equal
        const F64_MIN_DIFF : f64 = 1.0e-4;

        match &edit.edit {
            CreateCanvasObjects{ .. } => true, // -- always vacuously true
            UpdateCanvasObjects {
                canvas_id,
                updates,
            } => {
                // -- ensure old state of objects matches current state
                if let Some(canvas) = self.canvases().get(canvas_id) {
                    for (obj_id, update) in updates.iter() {
                        if let Some(curr_obj) = canvas.canvas_objects().get(obj_id) {
                            if update.old_fields != *curr_obj {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }// -- end for
                } else {
                    return false;
                }

                true
            },
            DeleteCanvasObjects {
                canvas_id,
                canvas_objects,
            } => {
                // -- ensure deleted objects exist and are in the same state
                if let Some(canvas) = self.canvases().get(canvas_id) {
                    for (obj_id, obj) in canvas_objects.iter() {
                        if let Some(curr_obj) = canvas.canvas_objects().get(obj_id) {
                            if *obj != *curr_obj {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }// -- end for
                } else {
                    return false;
                }

                true
            },
            CreateCanvases { .. } => true,  // -- always vacuously true
            DeleteCanvases {
                canvases,
            } => {
                // -- ensure canvas state matches given canvas state
                for (canvas_id, canvas) in canvases.iter() {
                    if let Some(curr_canvas) = self.canvases().get(canvas_id) {
                        // -- use time last modified as a proxy for equality
                        if curr_canvas.time_last_modified() != canvas.time_last_modified() {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }// -- end for

                true
            },
            MergeCanvas {
                child_canvas,
            } => {
                // -- ensure parent canvas exists and given child canvas state matches current canvas state
                if let Some(parent_ref) = child_canvas.parent_canvas() {
                    if ! self.canvases().contains_key(parent_ref.canvas_id()) {
                        return false;
                    }
                } else {
                    return false;
                };

                if let Some(curr_child_canvas) = self.canvases().get(child_canvas.id()) {
                    // -- use time last modified as proxy for equality
                    curr_child_canvas.time_last_modified() == child_canvas.time_last_modified()
                } else {
                    return false;
                }
            },
            SplitCanvas { .. } => false, // -- don't want to allow reversing canvas merge for now
            UpdateCanvasAllowedUsers {
                canvas_id,
                old_allowed_users,
                ..
            } => {
                // -- ensure canvas exists and old allowed users matches current allowed users
                if let Some(canvas) = self.canvases().get(&canvas_id) {
                    match (canvas.allowed_users(), old_allowed_users.as_ref()) {
                        (None, None) => true,
                        (Some(le), Some(ri)) => *le == *ri,
                        _ => false,
                    }// -- end match
                } else {
                    // -- canvas no longer exists
                    false
                }
            },
            UndoEdit { .. } => false,// -- can't apply this edit directly
            RedoEdit { .. } => false,// -- can't apply this edit directly
        }// -- end match &edit.edit
    }// -- end pub fn can_apply_edit

    // === fn apply_edit ===========================================================================
    //
    // Applies the effects of an edit to the whiteboard, without manipulating the edit history.
    //
    // Assumes the caller has already verified that the edit is valid (i.e. can be applied to the
    // whiteboard without corrupting the state).
    //
    // =============================================================================================
    fn apply_edit(&mut self, edit: &Edit) {
        use EditKind::*;

        match &edit.edit {
            CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => {
                if let Some(canvas) = self.canvases_mut().get_mut(canvas_id) {
                    for (obj_id, canvas_object) in canvas_objects.iter() {
                        canvas.canvas_objects.insert(obj_id.clone(), canvas_object.clone());
                    }// -- end for canvas_object in canvas_objects.values()
                }
            },
            UpdateCanvasObjects {
                canvas_id,
                updates,
            } => {
                if let Some(canvas) = self.canvases_mut().get_mut(canvas_id) {
                    for (obj_id, update) in updates.iter() {
                        if let Some(obj) = canvas.canvas_objects_mut().get_mut(obj_id) {
                            *obj = update.new_fields.clone();
                        }
                    }// -- end for (obj_id, update) in updates.iter()
                }
            },
            DeleteCanvasObjects {
                canvas_id,
                canvas_objects,
            } => {
                if let Some(canvas) = self.canvases_mut().get_mut(canvas_id) {
                    for obj_id in canvas_objects.keys() {
                        canvas.canvas_objects_mut().remove(obj_id);
                    }// -- end for (obj_id, update) in updates.iter()
                }
            },
            CreateCanvases {
                canvases,
            } => {
                for (canvas_id, canvas)  in canvases.iter() {
                    self.canvases_mut().insert(canvas_id.clone(), canvas.clone());
                }// -- end for (canvas_id, canvas)  in canvases.iter()
            },
            DeleteCanvases {
                canvases,
            } => {
                for canvas_id  in canvases.keys() {
                    let _ = self.canvases_mut().remove(canvas_id);
                }// -- end for (canvas_id, canvas)  in canvases.iter()
            },
            MergeCanvas {
                child_canvas,
            } => {
                if let Some(parent_ref) = child_canvas.parent_canvas() {
                    // -- Transfer canvases to parent canvas by switching parent ref
                    for canvas in self.canvases_mut().values_mut() {
                        if let Some(ref mut target_parent_ref) = canvas.parent_canvas_mut()
                            && *target_parent_ref.canvas_id() == *child_canvas.id() {
                                *target_parent_ref.canvas_id_mut() = *parent_ref.canvas_id();
                                *target_parent_ref.origin_x_mut() += parent_ref.origin_x();
                                *target_parent_ref.origin_y_mut() += parent_ref.origin_y();
                            }
                    } // -- end for canvas

                    // -- Transfer child canvas objects 
                    let parent_canvas = self.canvases_mut().get_mut(&parent_ref.canvas_id).unwrap();
                    let parent_canvas_objects = parent_canvas.canvas_objects_mut();

                    for (obj_id, canvas_object) in child_canvas.canvas_objects().iter() {
                        use CanvasObjectModel::*;

                        let mut transferred_canvas_object = canvas_object.clone();

                        match transferred_canvas_object {
                            Vector { ref mut points, .. } => {
                                for i_coord in (0..points.len()).step_by(2) {
                                    points[i_coord] += parent_ref.origin_x();
                                    points[i_coord + 1] += parent_ref.origin_y();
                                }// -- end for i_coord
                            },
                            Rect { ref mut x, ref mut y, .. }
                            | Ellipse { ref mut x, ref mut y, .. }
                            | Text { ref mut x, ref mut y, .. } => {
                                *x += parent_ref.origin_x();
                                *y += parent_ref.origin_y();
                            },
                        };// -- end match &mut transferred_canvas_object

                        parent_canvas_objects.insert(obj_id.clone(), transferred_canvas_object);
                    }// -- end for (obj_id, canvas_object)

                    // -- Delete old child canvas
                    let _ = self.canvases_mut().remove(child_canvas.id());
                }
            },
            SplitCanvas {
                child_canvas: restored_canvas,
            } => {
                // -- Identify child canvases that fall within the new child canvas and transfer
                // them by parent ref.
                if let Some(parent_ref) = restored_canvas.parent_canvas() {
                    let offset_x = parent_ref.origin_x();
                    let offset_y = parent_ref.origin_y();
                    let width = restored_canvas.width();
                    let height = restored_canvas.height();

                    for canvas in self.canvases_mut().values_mut() {
                        let child_width = canvas.width();
                        let child_height = canvas.height();

                        if let Some(ref mut child_parent_ref) = canvas.parent_canvas_mut() {
                            let origin_x = child_parent_ref.origin_x();
                            let origin_y = child_parent_ref.origin_y();

                            if *child_parent_ref.canvas_id() == *parent_ref.canvas_id()
                                && origin_x >= offset_x
                                && origin_x + child_width <= offset_x + width 
                                && origin_y >= offset_y
                                && origin_y + child_height <= offset_y + height 
                            {
                                child_parent_ref.canvas_id = restored_canvas.id().clone();
                                child_parent_ref.origin_x -= offset_x;
                                child_parent_ref.origin_y -= offset_y;
                            }
                        }
                    }// -- end for canvas

                    // -- Restore child canvas
                    self.canvases_mut().insert(restored_canvas.id().clone(), restored_canvas.clone());

                    // -- Remove duplicate canvas objects from parent canvas
                    let parent_canvas = self.canvases_mut()
                        .get_mut(parent_ref.canvas_id())
                        .unwrap();
                    let parent_canvas_objects = parent_canvas.canvas_objects_mut();

                    for obj_id in restored_canvas.canvas_objects().keys() {
                        parent_canvas_objects.remove(obj_id);
                    }// -- end for obj_id
                }
            },
            UpdateCanvasAllowedUsers {
                canvas_id,
                new_allowed_users,
                ..
            } => {
                if let Some(canvas) = self.canvases_mut().get_mut(canvas_id) {
                    canvas.set_allowed_users(new_allowed_users.as_ref());
                }
            },
            UndoEdit { .. } => panic!("Can't apply UndoEdit directly"),// -- don't apply this edit directly
            RedoEdit { .. } => panic!("Can't apply RedoEdit directly"),// -- don't apply this edit directly
        };// -- end match &edit.edit
    }// -- end fn apply_edit
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
    #[serde(default,skip_serializing)]
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
    pub visibility: WhiteboardVisibilityEnum,
    #[serde(rename = "user_permissions")]
    pub user_permissions: Vec<WhiteboardPermissionMongoDBView>,
} // -- end struct WhiteboardMetadataMongoDBView

impl WhiteboardMetadataMongoDBView {
    pub fn to_whiteboard_metadata(&self) -> WhiteboardMetadata {
        WhiteboardMetadata::new(
            self.name.clone(),
            self.visibility,
            self.user_permissions.as_slice(),
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
    pub old_fields: CanvasObjectModel,
    pub new_fields: CanvasObjectModel,
}

#[derive(Debug,Clone)]
pub enum EditKind {
    CreateCanvasObjects {
        canvas_id: CanvasIdType,
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
    },
    UpdateCanvasObjects {
        canvas_id: CanvasIdType,
        updates: HashMap<CanvasObjectIdType, CanvasObjectUpdate>,
    },
    DeleteCanvasObjects {
        canvas_id: CanvasIdType,
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
    },
    CreateCanvases {
        canvases: HashMap<CanvasIdType, Canvas>,
    },
    DeleteCanvases {
        canvases: HashMap<CanvasIdType, Canvas>,
    },
    MergeCanvas {
        child_canvas: Canvas,
    },
    SplitCanvas {
        child_canvas: Canvas,
    },
    UpdateCanvasAllowedUsers {
        canvas_id: CanvasIdType,
        old_allowed_users: Option<HashSet<UserIdType>>,
        new_allowed_users: Option<HashSet<UserIdType>>,
    },
    UndoEdit {
        target_edit_id: EditIdType,
    },
    RedoEdit {
        target_edit_id: EditIdType,
    },
}// -- end pub enum EditKind

impl EditKind {
    // === pub fn generate_reverse =================================================================
    //
    // Generates an EditKind which reverses the effects of the given EditKind.
    //
    // =============================================================================================
    pub fn generate_reverse(&self) -> Self {
        use EditKind::*;

        match self {
            CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => DeleteCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.clone(),
            },
            UpdateCanvasObjects {
                canvas_id,
                updates,
            } => UpdateCanvasObjects {
                canvas_id: canvas_id.clone(),
                updates: updates.iter()
                    .map(|(id, update)| (id.clone(), CanvasObjectUpdate {
                        old_fields: update.new_fields.clone(),
                        new_fields: update.old_fields.clone(),
                    }))
                    .collect()
            },
            DeleteCanvasObjects {
                canvas_id,
                canvas_objects,
            } => CreateCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.clone(),
            },
            CreateCanvases {
                canvases,
            } => DeleteCanvases {
                canvases: canvases.clone(),
            },
            DeleteCanvases {
                canvases,
            } => CreateCanvases {
                canvases: canvases.clone(),
            },
            MergeCanvas {
                child_canvas,
            } => SplitCanvas {
                child_canvas: child_canvas.clone(),
            },
            SplitCanvas {
                child_canvas,
            } => MergeCanvas {
                child_canvas: child_canvas.clone(),
            },
            UpdateCanvasAllowedUsers {
                canvas_id,
                old_allowed_users,
                new_allowed_users,
            } => UpdateCanvasAllowedUsers {
                canvas_id: canvas_id.clone(),
                old_allowed_users: new_allowed_users.clone(),
                new_allowed_users: old_allowed_users.clone(),
            },
            UndoEdit {
                target_edit_id,
            } => RedoEdit {
                target_edit_id: target_edit_id.clone(),
            },
            RedoEdit {
                target_edit_id,
            } => UndoEdit {
                target_edit_id: target_edit_id.clone(),
            },
        }// -- end match self
    }// -- end pub fn generate_reverse
}// -- end impl EditKind

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

    pub fn id(&self) -> &EditIdType {
        &self.id
    }// -- end pub fn id

    pub fn generate_server_messages(&self, author_client_id: &ClientIdType) -> Vec<ServerSocketMessage> {
        use EditKind::*;

        match &self.edit {
            CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::CreateCanvasObjects {
                        client_id: author_client_id.clone(),
                        canvas_id: canvas_id.clone(),
                        canvas_objects: canvas_objects.clone(),
                    },
                }]
            },
            UpdateCanvasObjects {
                canvas_id,
                updates,
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::UpdateCanvasObjects {
                        client_id: author_client_id.clone(),
                        canvas_id: canvas_id.clone(),
                        canvas_objects: updates.iter()
                            .map(|(obj_id, update)| (obj_id.clone(), update.new_fields.clone()))
                            .collect()
                    },
                }]
            },
            DeleteCanvasObjects {
                canvas_objects,
                ..
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::DeleteCanvasObjects {
                        client_id: author_client_id.clone(),
                        canvas_object_ids: canvas_objects.keys().cloned().collect(),
                    }
                }]
            },
            CreateCanvases {
                canvases,
            } => {
                canvases.values()
                    .map(|canvas| {
                        ServerSocketMessage::Broadcast {
                            msg: ServerSocketBroadcastMessage::CreateCanvas {
                                client_id: author_client_id.clone(),
                                canvas: canvas.to_client_view(),
                            },
                        }
                    })
                    .collect()
            },
            DeleteCanvases {
                canvases,
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::DeleteCanvases {
                        client_id: author_client_id.clone(),
                        canvas_ids: canvases.keys().cloned().collect(),
                    },
                }]
            },
            MergeCanvas {
                child_canvas,
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::MergeCanvas {
                        client_id: author_client_id.clone(),
                        canvas_id: child_canvas.id().clone(),
                    },
                }]
            },
            SplitCanvas { .. } => vec![],// -- currently not supported
            UpdateCanvasAllowedUsers {
                canvas_id,
                new_allowed_users,
                ..
            } => {
                vec![ServerSocketMessage::Broadcast {
                    msg: ServerSocketBroadcastMessage::UpdateCanvasAllowedUsers {
                        client_id: author_client_id.clone(),
                        canvas_id: canvas_id.clone(),
                        allowed_users: new_allowed_users
                            .clone()
                            .map(|user_id_set| user_id_set.iter().cloned().collect())
                            .unwrap_or(vec![]),
                    },
                }]
            },
            UndoEdit { .. } => vec![],// -- nothing to send to clients
            RedoEdit { .. } => vec![],// -- nothing to send to clients
        }// -- end match &self.edit
    }// -- end pub fn generate_server_messages

    pub fn get_whiteboard_diffs(&self) -> Vec<WhiteboardDiff> {
        use EditKind::*;

        match &self.edit {
            CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => vec![WhiteboardDiff::CreateCanvasObjects {
                canvas_objects: canvas_objects.iter()
                    .map(|(obj_id, obj)| (obj_id.clone(), CanvasObject {
                        id: obj_id.clone(),
                        canvas_id: canvas_id.clone(),
                        canvas_object: obj.clone(),
                    }))
                    .collect(),
            }],
            UpdateCanvasObjects {
                canvas_id,
                updates,
            } => vec![
                WhiteboardDiff::UpdateCanvasObjects {
                    canvas_objects: updates.iter()
                        .map(|(obj_id, update)| {
                            (obj_id.clone(), CanvasObject {
                                id: obj_id.clone(),
                                canvas_id: canvas_id.clone(),
                                canvas_object: update.new_fields.clone(),
                            })
                        })
                        .collect()
                }
            ],
            DeleteCanvasObjects {
                canvas_objects,
                ..
            } => vec![WhiteboardDiff::DeleteCanvasObjects {
                canvas_object_ids: canvas_objects.keys().copied().collect()
            }],
            CreateCanvases {
                canvases,
            } => canvases.values()
                .map(|canvas| WhiteboardDiff::CreateCanvas {
                    canvas: canvas.clone(),
                })
                .collect(),
            DeleteCanvases {
                canvases,
            } => vec![WhiteboardDiff::DeleteCanvases {
                canvas_ids: canvases.keys().copied().collect(),
            }],
            MergeCanvas {
                child_canvas,
            } => {
                let parent_canvas = child_canvas.parent_canvas().unwrap();

                Vec::from([
                    // -- transfer objects
                    WhiteboardDiff::TransferCanvasObjects {
                        old_canvas_id: child_canvas.id().clone(),
                        new_canvas_id: parent_canvas.canvas_id().clone(),
                        translate_x: parent_canvas.origin_x(),
                        translate_y: parent_canvas.origin_y(),
                    },
                    // -- transfer child canvases
                    WhiteboardDiff::TransferChildCanvases {
                        old_parent_id: child_canvas.id().clone(),
                        new_parent_id: parent_canvas.canvas_id().clone(),
                        translate_x: parent_canvas.origin_x(),
                        translate_y: parent_canvas.origin_y(),
                    },
                    // -- delete old canvas
                    WhiteboardDiff::DeleteCanvases {
                        canvas_ids: vec![child_canvas.id().clone()],
                    },
                ])
            },
            SplitCanvas {
                child_canvas,
            } => {
                let parent_canvas = child_canvas.parent_canvas().unwrap();

                Vec::from([
                    // -- restore old canvas
                    WhiteboardDiff::CreateCanvas {
                        canvas: child_canvas.clone(),
                    },
                    // -- transfer child canvases back to child
                    WhiteboardDiff::TransferChildCanvases {
                        old_parent_id: parent_canvas.canvas_id().clone(),
                        new_parent_id: child_canvas.id().clone(),
                        translate_x: -parent_canvas.origin_x(),
                        translate_y: -parent_canvas.origin_y(),
                    },
                    // -- transfer objects
                    WhiteboardDiff::TransferCanvasObjects {
                        old_canvas_id: parent_canvas.canvas_id().clone(),
                        new_canvas_id: child_canvas.id().clone(),
                        translate_x: -parent_canvas.origin_x(),
                        translate_y: -parent_canvas.origin_y(),
                    },
                ])
            },
            UpdateCanvasAllowedUsers {
                canvas_id,
                new_allowed_users,
                ..
            } => vec![WhiteboardDiff::UpdateCanvasAllowedUsers {
                canvas_id: canvas_id.clone(),
                allowed_users: new_allowed_users.clone()
                    .map(|users_set| users_set.iter().copied().collect())
                    .unwrap_or(vec![]),
            }],
            UndoEdit {
                target_edit_id,
            } => vec![WhiteboardDiff::UndoEdit {
                target_edit_id: target_edit_id.clone(),
            }],
            RedoEdit {
                target_edit_id,
            } => vec![WhiteboardDiff::RedoEdit {
                target_edit_id: target_edit_id.clone(),
            }],
        }// -- end match self.edit
    }// -- end pub fn get_whiteboard_diffs

    pub fn generate_reverse(&self, author_id: &UserIdType) -> Self {
        Self {
            id: ObjectId::new(),
            author: author_id.clone(),
            whiteboard: self.whiteboard.clone(),
            committed_at: Utc::now(),
            edit: self.edit.generate_reverse(),
        }
    }// -- end pub fn generate_reverse
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
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
    },
    UpdateCanvasObjects {
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        updates: HashMap<CanvasObjectIdType, CanvasObjectUpdateMongoDBView>,
    },
    DeleteCanvasObjects {
        canvas_id: CanvasIdType,
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObjectModel>,
    },
    CreateCanvases {
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        canvases: HashMap<CanvasIdType, CanvasMongoDBView>,
    },
    DeleteCanvases {
        #[serde_as(as = "HashMap<DisplayFromStr, _>")]
        canvases: HashMap<CanvasIdType, CanvasMongoDBView>,
    },
    MergeCanvas {
        child_canvas: CanvasMongoDBView,
    },
    SplitCanvas {
        child_canvas: CanvasMongoDBView,
    },
}// -- end pub enum EditKindMongoDBView

impl EditKindMongoDBView {
    pub fn to_edit_kind(&self) -> EditKind {
        match self {
            EditKindMongoDBView::CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => EditKind::CreateCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.iter().map(
                    |(id, obj)| (id.clone(), obj.clone())
                ).collect()
            },
            EditKindMongoDBView::UpdateCanvasObjects {
                canvas_id,
                updates,
            } => EditKind::UpdateCanvasObjects {
                canvas_id: canvas_id.clone(),
                updates: updates.iter().map(
                    |(id, update)| (id.clone(), CanvasObjectUpdate {
                        old_fields: update.old_fields.clone(),
                        new_fields: update.new_fields.clone(),
                })).collect()
            },
            EditKindMongoDBView::DeleteCanvasObjects {
                canvas_id,
                canvas_objects,
            } => EditKind::DeleteCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.iter().map(
                    |(id, obj)| (id.clone(), obj.clone())
                ).collect()
            },
            EditKindMongoDBView::CreateCanvases {
                canvases,
            } => EditKind::CreateCanvases {
                canvases: canvases.iter()
                    .map(|(id, canvas)| (id.clone(), canvas.to_canvas()))
                    .collect()
            },
            EditKindMongoDBView::DeleteCanvases {
                canvases,
            } => EditKind::DeleteCanvases {
                canvases: canvases.iter().map(
                    |(id, canvas)| (id.clone(), canvas.to_canvas())
                ).collect()
            },
            EditKindMongoDBView::MergeCanvas {
                child_canvas,
            } => EditKind::MergeCanvas {
                child_canvas: child_canvas.to_canvas(),
            },
            EditKindMongoDBView::SplitCanvas {
                child_canvas,
            } => EditKind::SplitCanvas {
                child_canvas: child_canvas.to_canvas(),
            },
        }// -- end match self
    }// -- end pub fn to_edit_kind

    pub fn from_edit_kind(edit_kind: &EditKind) -> Option<Self> {
        match edit_kind {
            EditKind::CreateCanvasObjects {
                canvas_id,
                canvas_objects,
            } => Some(EditKindMongoDBView::CreateCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.iter()
                    .map(|(id, obj)| (id.clone(), obj.clone()))
                    .collect()
            }),
            EditKind::UpdateCanvasObjects {
                canvas_id,
                updates,
            } => Some(EditKindMongoDBView::UpdateCanvasObjects {
                canvas_id: canvas_id.clone(),
                updates: updates.iter().map(
                    |(id, update)| (id.clone(), CanvasObjectUpdateMongoDBView {
                        old_fields: update.old_fields.clone(),
                        new_fields: update.new_fields.clone(),
                })).collect()
            }),
            EditKind::DeleteCanvasObjects {
                canvas_id,
                canvas_objects,
            } => Some(EditKindMongoDBView::DeleteCanvasObjects {
                canvas_id: canvas_id.clone(),
                canvas_objects: canvas_objects.iter()
                    .map(|(id, obj)| (id.clone(), obj.clone()))
                    .collect()
            }),
            EditKind::CreateCanvases {
                canvases,
            } => Some(EditKindMongoDBView::CreateCanvases {
                canvases: canvases.iter()
                    .map(|(id, canvas)| (id.clone(), CanvasMongoDBView::from_canvas(canvas)))
                    .collect()
            }),
            EditKind::DeleteCanvases {
                canvases,
            } => Some(EditKindMongoDBView::DeleteCanvases {
                canvases: canvases.iter().map(
                    |(id, canvas)| (id.clone(), CanvasMongoDBView::from_canvas(canvas))
                ).collect(),
            }),
            EditKind::MergeCanvas {
               child_canvas,
            } => Some(EditKindMongoDBView::MergeCanvas {
                child_canvas: CanvasMongoDBView::from_canvas(child_canvas),
            }),
            EditKind::SplitCanvas {
                child_canvas,
            } => Some(EditKindMongoDBView::SplitCanvas {
                child_canvas: CanvasMongoDBView::from_canvas(child_canvas),
            }),
            EditKind::UpdateCanvasAllowedUsers { .. } => None,
            EditKind::UndoEdit { .. } => None,
            EditKind::RedoEdit { .. } => None,
        }// -- end match self
    }// -- end pub fn from_edit_kind
}// -- end impl EditKindMongoDBView

#[derive(Debug,Clone,Serialize,Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditMongoDBView {
    #[serde(rename = "_id")]
    id: EditIdType,
    author: UserIdType,
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

    pub fn from_edit(edit: &Edit) -> Option<Self> {
        use super::utils::dt_chrono_utc_to_bson;

        EditKindMongoDBView::from_edit_kind(&edit.edit).map(
            |edit_kind| 
                Self {
                    id: edit.id.clone(),
                    author: edit.author.clone(),
                    whiteboard: edit.whiteboard.clone(),
                    committed_at: dt_chrono_utc_to_bson(&edit.committed_at),
                    edit: edit_kind,
                }
        )
    }// -- end pub fn from_edit
}// -- end impl EditMongoDBView

// === Notifications ==============================================================================
//
// Notifications served to users within their notifications list.
//
// ================================================================================================
pub type NotificationIdType = ObjectId;

#[derive(Clone, Debug)]
pub enum NotificationKind {
    RequestCanvasEditPermission {
        whiteboard_id: WhiteboardIdType,
        canvas_id: CanvasIdType,
        grantee: UserIdType,
    },
}// -- end pub enum NotificationKind

#[derive(Clone, Debug)]
pub struct Notification {
    pub id: NotificationIdType,
    pub recipient: UserIdType,
    pub created_at: chrono::DateTime<Utc>,
    pub is_sent: bool,
    pub kind: NotificationKind,
}// -- end pub struct Notification

impl Notification {
    pub fn new(recipient: &UserIdType, kind: NotificationKind) -> Self {
        Self {
            id: ObjectId::new(),
            recipient: recipient.clone(),
            created_at: Utc::now(),
            is_sent: false,
            kind,
        }
    }// -- end pub fn new
}// -- end impl Notification

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum NotificationKindMongoDBView {
    RequestCanvasEditPermission {
        whiteboard_id: WhiteboardIdType,
        canvas_id: CanvasIdType,
        grantee: UserIdType,
    },
}// -- end pub struct NotificationKindMongoDBView

impl NotificationKindMongoDBView {
    pub fn from_notification_kind(nk: &NotificationKind) -> Self {
        use NotificationKind::*;

        match nk {
            RequestCanvasEditPermission {
                whiteboard_id,
                canvas_id,
                grantee,
            } => Self::RequestCanvasEditPermission {
                whiteboard_id: whiteboard_id.clone(),
                canvas_id: canvas_id.clone(),
                grantee: grantee.clone(),
            },
        }// -- end match nk
    }// -- end fn from_notification_kind

    pub fn to_notification_kind(&self) -> NotificationKind {
        use NotificationKind::*;

        match self {
            Self::RequestCanvasEditPermission {
                whiteboard_id,
                canvas_id,
                grantee,
            } => RequestCanvasEditPermission {
                whiteboard_id: whiteboard_id.clone(),
                canvas_id: canvas_id.clone(),
                grantee: grantee.clone(),
            },
        }// -- end match self
    }// -- end fn to_notification_kind
}// -- end impl NotificationKindMongoDBView

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationMongoDBView {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub recipient: UserIdType,
    pub created_at: bson::DateTime,
    pub is_sent: bool,
    #[serde(flatten)]
    pub kind: NotificationKindMongoDBView,
}// -- end pub struct NotificationMongoDBView

impl NotificationMongoDBView {
    pub fn from_notification(nt: &Notification) -> Self {
        use super::utils::dt_chrono_utc_to_bson;

        Self {
            id: nt.id.clone(),
            recipient: nt.recipient.clone(),
            created_at: dt_chrono_utc_to_bson(&nt.created_at),
            is_sent: nt.is_sent,
            kind: NotificationKindMongoDBView::from_notification_kind(&nt.kind),
        }
    }// -- end pub fn from_notification

    pub fn to_notification(&self) -> Notification {
        use super::utils::dt_bson_to_chrono_utc;

        Notification {
            id: self.id.clone(),
            recipient: self.recipient.clone(),
            created_at: dt_bson_to_chrono_utc(&self.created_at),
            is_sent: self.is_sent,
            kind: self.kind.to_notification_kind(),
        }
    }// -- end pub fn to_notification
}// -- end impl NotificationMongoDBView

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum NotificationKindClientView {
    RequestCanvasEditPermission {
        #[serde_as(as = "DisplayFromStr")]
        whiteboard_id: WhiteboardIdType,
        #[serde_as(as = "DisplayFromStr")]
        canvas_id: CanvasIdType,
        #[serde_as(as = "DisplayFromStr")]
        grantee: UserIdType,
    },
}// -- end pub struct NotificationKindClientView

impl NotificationKindClientView {
    pub fn from_notification_kind(nk: &NotificationKind) -> Self {
        use NotificationKind::*;

        match nk {
            RequestCanvasEditPermission {
                whiteboard_id,
                canvas_id,
                grantee,
            } => Self::RequestCanvasEditPermission {
                whiteboard_id: whiteboard_id.clone(),
                canvas_id: canvas_id.clone(),
                grantee: grantee.clone(),
            },
        }// -- end match nk
    }// -- end fn from_notification_kind

    pub fn to_notification_kind(&self) -> NotificationKind {
        use NotificationKind::*;

        match self {
            Self::RequestCanvasEditPermission {
                whiteboard_id,
                canvas_id,
                grantee,
            } => RequestCanvasEditPermission {
                whiteboard_id: whiteboard_id.clone(),
                canvas_id: canvas_id.clone(),
                grantee: grantee.clone(),
            },
        }// -- end match self
    }// -- end fn to_notification_kind
}// -- end impl NotificationKindClientView

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationClientView {
    #[serde_as(as = "DisplayFromStr")]
    id: ObjectId,
    #[serde(with = "bson_datetime_as_rfc3339_string")]
    created_at: bson::DateTime,
    #[serde(flatten)]
    kind: NotificationKindClientView,
}// -- end pub struct NotificationClientView

impl NotificationClientView {
    pub fn from_notification(nt: &Notification) -> Self {
        use super::utils::dt_chrono_utc_to_bson;

        Self {
            id: nt.id.clone(),
            created_at: dt_chrono_utc_to_bson(&nt.created_at),
            kind: NotificationKindClientView::from_notification_kind(&nt.kind),
        }
    }// -- end pub fn from_notification
}// -- end impl NotificationClientView

// === Tests =======================================================================================
//
// =================================================================================================

#[cfg(test)]
mod unit_tests {
    use super::*;

    // === deserialize_whiteboard_client_view_basic ================================================
    //
    // Simple example of deserializing a serialized whiteboard client view from a JSON string into a
    // WhiteboardClientView struct.
    //
    // =============================================================================================
    #[test]
    fn deserialize_whiteboard_client_view_basic() {
        use serde_json;
        use mongodb::bson::{oid::ObjectId};

        const WB_ID_S : &str = "68d5e8d4829da666aece020d";
        const WB_NAME : &str = "Whiteboard Alpha";
        const WB_ROOT_CANVAS_ID_S : &str = "68d5e8d4829da666aece020e";
        const USER_A_ID_S : &str = "68d5e8d4829da666aece020f";
        const USER_B_ID_S : &str = "68d5e8d4829da666aece0210";
        const USER_C_ID_S : &str = "68d5e8d4829da666aece0211";
        const USER_C_EMAIL : &str = "user@example.com";

        // -- Values aren't consistent: merely meant to test serde deserialization
        let serialized_wb_s = format!(r#"{{
            "id": "{WB_ID_S}",
            "name": "{WB_NAME}",
            "canvases": [],
            "rootCanvas": "{WB_ROOT_CANVAS_ID_S}",
            "visibility": "public",
            "permissionsByUserId": {{
                "{USER_A_ID_S}": "view",
                "{USER_B_ID_S}": "edit",
                "{USER_C_ID_S}": "own"
            }},
            "permissionsByEmail": {{
                "{USER_C_EMAIL}": "view"
            }}
        }}"#);
        
        let wb_view = serde_json::from_str::<WhiteboardClientView>(serialized_wb_s.as_str())
            .expect("Serialized whiteboard string to deserialize into WhiteboardClientView");

        debug_assert_eq!(wb_view.id.unwrap().to_hex(), WB_ID_S);
        debug_assert_eq!(wb_view.name.as_str(), WB_NAME);
        debug_assert_eq!(wb_view.root_canvas.to_hex(), WB_ROOT_CANVAS_ID_S);
        debug_assert_eq!(wb_view.visibility, WhiteboardVisibilityEnum::Public);
        debug_assert_eq!(wb_view.permissions_by_user_id.len(), 3);
        debug_assert_eq!(
            wb_view.permissions_by_user_id.get(&ObjectId::parse_str(USER_A_ID_S).unwrap()).cloned(),
            Some(WhiteboardPermissionEnumClientView::View)
        );
        debug_assert_eq!(
            wb_view.permissions_by_user_id.get(&ObjectId::parse_str(USER_B_ID_S).unwrap()).cloned(),
            Some(WhiteboardPermissionEnumClientView::Edit)
        );
        debug_assert_eq!(
            wb_view.permissions_by_user_id.get(&ObjectId::parse_str(USER_C_ID_S).unwrap()).cloned(),
            Some(WhiteboardPermissionEnumClientView::Own)
        );
        debug_assert_eq!(wb_view.permissions_by_email.len(), 1);
        debug_assert_eq!(
            wb_view.permissions_by_email.get(USER_C_EMAIL).cloned(),
            Some(WhiteboardPermissionEnumClientView::View)
        );
    }// -- end fn deserialize_whiteboard_client_view_basic

    #[test]
    fn serialize_whiteboard_client_view_basic() {
        use serde_json;
        use mongodb::bson::{Bson,doc,oid::ObjectId};

        // -- Values aren't consistent: merely meant to test serde deserialization
        const WB_ID_S : &str = "68d5e8d4829da666aece020d";
        const WB_NAME : &str = "Whiteboard Alpha";
        const WB_ROOT_CANVAS_ID_S : &str = "68d5e8d4829da666aece020e";
        const USER_A_ID_S : &str = "68d5e8d4829da666aece020f";
        const USER_B_ID_S : &str = "68d5e8d4829da666aece0210";
        const USER_C_ID_S : &str = "68d5e8d4829da666aece0211";
        const USER_D_EMAIL : &str = "user@example.com";

        let wb_view = WhiteboardClientView {
            id: Some(ObjectId::parse_str(WB_ID_S).unwrap()),
            name: String::from(WB_NAME),
            canvases: vec![],
            root_canvas: ObjectId::parse_str(WB_ROOT_CANVAS_ID_S).unwrap(),
            visibility: WhiteboardVisibilityEnum::Public,
            permissions_by_user_id: HashMap::from([
                (ObjectId::parse_str(USER_A_ID_S).unwrap(), WhiteboardPermissionEnumClientView::View),
                (ObjectId::parse_str(USER_B_ID_S).unwrap(), WhiteboardPermissionEnumClientView::Edit),
                (ObjectId::parse_str(USER_C_ID_S).unwrap(), WhiteboardPermissionEnumClientView::Own),
            ]),
            permissions_by_email: HashMap::from([
                (String::from(USER_D_EMAIL), WhiteboardPermissionEnumClientView::View),
            ]),
        };

        let wb_view_serialized_s = serde_json::to_string(&wb_view)
            .expect("To serialize WhiteboardClientView to JSON string");
        
        // -- unserialize to a Bson object to inspect how the object will be presented to other
        // clients
        let wb_view_unserialized = serde_json::from_str::<Bson>(wb_view_serialized_s.as_str())
            .expect("To deserialize JSON string to Bson object");

        let expected = Bson::Document(doc! {
            "id": WB_ID_S,
            "name": WB_NAME,
            "canvases": [],
            "rootCanvas": WB_ROOT_CANVAS_ID_S,
            "visibility": "public",
            "permissionsByUserId": {
                USER_A_ID_S : "view",
                USER_B_ID_S : "edit",
                USER_C_ID_S : "own",
            },
            "permissionsByEmail": {
                USER_D_EMAIL : "view",
            },
        });// -- end let expected

        debug_assert_eq!(wb_view_unserialized, expected);
    }// -- end fn deserialize_whiteboard_client_view_basic
}// -- end mod unit_tests
