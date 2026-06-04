// === db.rs =======================================================================================
//
// Contains functions needed to interface with the MongoDB database. Includes MongoDBStore, which
// implements the UserStore and WhiteboardMetadataStore traits from store.rs.
//
// =================================================================================================

use super::{models::*, store::*};

use mongodb::{Collection, Database, bson::doc};

use futures::TryStreamExt;

use std::collections::HashMap;

pub async fn connect_mongodb(uri: &str) -> mongodb::error::Result<mongodb::Client> {
    use mongodb::{
        Client,
        bson::doc,
        options::{ClientOptions, ServerApi, ServerApiVersion},
    };

    // Replace the placeholder with your Atlas connection string
    let mut client_options = ClientOptions::parse(uri).await?;

    // Set the server_api field of the client_options object to Stable API version 1
    let server_api = ServerApi::builder().version(ServerApiVersion::V1).build();
    client_options.server_api = Some(server_api);

    // Create a new client and connect to the server
    let client = Client::with_options(client_options)?;

    // Send a ping to confirm a successful connection
    client
        .database("admin")
        .run_command(doc! { "ping": 1 })
        .await?;
    println!("Pinged your deployment. You successfully connected to MongoDB!");

    Ok(client)
} // end connect_mongodb

// === MongoDBStore ===============================================================================
//
// Interface for fetching objects from the MongoDB database, by id.
//
// ================================================================================================
#[derive(Debug)]
pub struct MongoDBStore {
    user_collection: Collection<UserMongoDBView>,
    whiteboard_metadata_collection: Collection<WhiteboardMetadataMongoDBView>,
} // -- end MongoDBStore

impl MongoDBStore {
    pub fn new(
        user_coll: &Collection<UserMongoDBView>,
        whiteboard_metadata_coll: &Collection<WhiteboardMetadataMongoDBView>,
    ) -> Self {
        Self {
            user_collection: user_coll.clone(),
            whiteboard_metadata_collection: whiteboard_metadata_coll.clone(),
        }
    } // -- end fn new(coll: &Collection<UserMongoDBView>) -> Self
} // -- end impl MongoDBStore

impl UserStore for MongoDBStore {
    async fn get_user_by_id(
        &self,
        user_id: &UserIdType,
    ) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
        match self
            .user_collection
            .find_one(doc! { "_id": *user_id })
            .await?
        {
            Some(user_view) => Ok(Some(user_view.to_user())),
            None => Ok(None),
        } // -- end match self.user_collection.find_one(doc! { "_id": user_id.clone() }).await
    }
}

impl WhiteboardMetadataStore for MongoDBStore {
    async fn get_whiteboard_metadata_by_id(
        &self,
        whiteboard_id: &WhiteboardIdType,
    ) -> Result<Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>> {
        match self
            .whiteboard_metadata_collection
            .find_one(doc! { "_id": *whiteboard_id })
            .await?
        {
            Some(metadata_view) => Ok(Some(metadata_view.to_whiteboard_metadata())),
            None => Ok(None),
        } // -- end match self.whiteboard_metadata_collection.find_one(doc! { "_id": whiteboard_metadata_id.clone() }).await
    }
}

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
    CreateCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObject>,
    },
    UpdateCanvasObjects {
        canvas_objects: HashMap<CanvasObjectIdType, CanvasObject>,
    },
    DeleteCanvasObjects {
        canvas_object_ids: Vec<CanvasObjectIdType>,
    },
    UpdateCanvasAllowedUsers {
        canvas_id: CanvasIdType,
        allowed_users: Vec<UserIdType>,
    },
    TransferChildCanvases {
        old_parent_id: CanvasIdType,
        new_parent_id: CanvasIdType,
        translate_x: f64,
        translate_y: f64,
    },
    TransferCanvasObjects {
        old_canvas_id: CanvasIdType,
        new_canvas_id: CanvasIdType,
        translate_x: f64,
        translate_y: f64,
    },
    UndoEdit {
        target_edit_id: EditIdType,
    },
    RedoEdit {
        target_edit_id: EditIdType,
    },
} // -- end enum WhiteboardDiff

pub async fn get_whiteboard_metadata_by_id(
    db: &Database,
    wid: &WhiteboardIdType,
) -> Result<Option<WhiteboardMetadata>, mongodb::error::Error> {
    let metadata_coll = db.collection::<WhiteboardMetadataMongoDBView>("whiteboards");

    match metadata_coll.find_one(doc! { "_id": *wid }).await? {
        None => {
            Ok(None)
        }
        Some(metadata) => Ok(Some(metadata.to_whiteboard_metadata())),
    }
} // -- end get_whiteboard_metadata_by_id

pub async fn get_whiteboard_by_id(
    db: &Database,
    wid: &WhiteboardIdType,
) -> Result<Option<Whiteboard>, mongodb::error::Error> {
    let whiteboard_coll = db.collection::<WhiteboardMongoDBView>("whiteboards");
    let canvas_coll = db.collection::<CanvasMongoDBView>("canvases");
    let edit_coll = db.collection::<EditMongoDBView>("edits");

    let whiteboard_view = match whiteboard_coll
        .find_one(doc! { "_id": *wid })
        .await?
    {
        None => {
            return Ok(None);
        }
        Some(wb) => wb,
    };

    // -- Sort edits ascending by commit time
    let edit_views : Vec<EditMongoDBView> = edit_coll
        .find(doc! { "whiteboard": { "$eq": *wid }})
        .sort(doc! { "committedAt": 1 })
        .await?
        .try_collect()
        .await?;

    // -- TODO: renamed "shapes" collection to "canvas_objects" for consistency
    let canvas_cursor = canvas_coll
        .aggregate([
            // -- locate root canvas
            doc! {
                "$match": {
                    "_id": whiteboard_view.root_canvas
                }
            },
            // -- add canvas_objects to root canvas
            doc! {
                "$lookup" : {
                    "from" : "shapes",
                    "localField" : "_id",
                    "foreignField" : "canvas_id",
                    "as" : "canvas_objects",
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
            // -- unwind to allow adding canvas_objects to each descendant canvas
            doc! {
                "$unwind": {
                    "path": "$canvas_hierarchy",
                    "preserveNullAndEmptyArrays": true
                }
            },
            // -- look up canvas_objects for each descendant canvas
            doc! {
                "$lookup" : {
                    "from" : "shapes",
                    "localField" : "canvas_hierarchy._id",
                    "foreignField" : "canvas_id",
                    "as" : "canvas_hierarchy.canvas_objects",
                }
            },
            // -- exclude empty canvas hierarchy containing only canvas_objects from previous stage
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
    let canvas_views: Vec<CanvasMongoDBView> = canvas_cursor.try_collect().await?;
    let root_canvas_view = canvas_views.first().ok_or_else(|| {
        mongodb::error::Error::custom(format!(
            "Could not find root canvas with id {}",
            whiteboard_view.root_canvas
        ))
    })?;
    let mut canvases = vec![root_canvas_view.to_canvas()];

    if let Some(canvas_views) = &root_canvas_view.canvas_hierarchy {
        for canvas_view in canvas_views {
            canvases.push(canvas_view.to_canvas());
        } // -- end for canvas_view in canvas_views
    }

    let edits : Vec<Edit> = edit_views.iter().map(|view| view.to_edit()).collect();

    Ok(Some(whiteboard_view.to_whiteboard(
        canvases.as_slice(),
        edits.as_slice(),
    )))
} // -- end fn get_whiteboard_by_id

pub struct MongoDBInterface {
    whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView>,
    canvas_coll: Collection<CanvasMongoDBView>,
    canvas_object_coll: Collection<CanvasObjectMongoDBView>,
    user_coll: Collection<UserMongoDBView>,
    edit_coll: Collection<EditMongoDBView>,
    notification_coll: Collection<NotificationMongoDBView>,
}// -- end pub struct MongoDBInterface

impl MongoDBInterface {
    pub fn new(db: &Database) -> Self {
        Self {
            whiteboard_metadata_coll: db.collection::<WhiteboardMetadataMongoDBView>("whiteboards"),
            canvas_coll: db.collection::<CanvasMongoDBView>("canvases"),
            canvas_object_coll: db.collection::<CanvasObjectMongoDBView>("shapes"),
            user_coll: db.collection::<UserMongoDBView>("users"),
            edit_coll: db.collection::<EditMongoDBView>("edits"),
            notification_coll: db.collection::<NotificationMongoDBView>("notifications"),
        }
    }// -- end pub fn new

    pub async fn process_diff(&self, diff: &WhiteboardDiff) {
        match diff {
            WhiteboardDiff::CreateCanvas { canvas } => {
                println!(
                    "Creating canvas \"{}\" in database ...",
                    canvas.name()
                );

                // TODO: make method of Canvas struct
                let canvas_doc =
                    CanvasMongoDBView::from_canvas(canvas);
                let create_canvas_res =
                    self.canvas_coll.insert_one(&canvas_doc).await;

                match create_canvas_res {
                    Err(e) => {
                        eprintln!("CreateCanvas insert failed: {}", e);
                    }
                    Ok(insert) => {
                        eprintln!(
                            "CreateCanvas new document id: {}",
                            insert.inserted_id
                        );
                    }
                };
            }
            WhiteboardDiff::DeleteCanvases { canvas_ids } => {
                println!(
                    "Deleting canvases from database: {:?} ...",
                    canvas_ids
                );

                // first delete contained canvas objects
                let delete_objects_res = self.canvas_object_coll
                    .delete_many(doc! {
                        "canvas_id": {
                            "$in": canvas_ids.clone()
                        }
                    })
                    .await;

                match delete_objects_res {
                    Err(e) => {
                        eprintln!(
                            "DeleteCanvases object deletion failed: {}",
                            e
                        );
                    }
                    Ok(delete_result) => {
                        eprintln!(
                            "DeleteCanvases object deletion count {}",
                            delete_result.deleted_count
                        );
                    }
                };

                // then, delete canvas itself
                let delete_canvas_res = self.canvas_coll
                    .delete_many(doc! {
                        "_id": {
                            "$in": canvas_ids.clone()
                        }
                    })
                    .await;

                match delete_canvas_res {
                    Err(e) => {
                        eprintln!(
                            "DeleteCanvases canvas deletion failed: {}",
                            e
                        );
                    }
                    Ok(delete_result) => {
                        eprintln!(
                            "DeleteCanvases canvas deletion count {}",
                            delete_result.deleted_count
                        );
                    }
                };
            }
            WhiteboardDiff::CreateCanvasObjects { canvas_objects } => {
                println!(
                    "Creating canvas_objects in database ...",
                );

                let canvas_obj_docs: Vec<CanvasObjectMongoDBView> =
                    canvas_objects
                        .values()
                        .map(|obj| {
                            CanvasObjectMongoDBView::from_canvas_object(obj)
                        })
                        .collect();

                let create_canvas_objects_res =
                    self.canvas_object_coll.insert_many(&canvas_obj_docs).await;

                match create_canvas_objects_res {
                    Err(e) => {
                        eprintln!("CreateCanvasObjects insert failed: {}", e);
                    }
                    Ok(insert) => {
                        eprintln!(
                            "CreateCanvasObjects new document ids: {:?}",
                            insert.inserted_ids
                        );
                    }
                };
            }
            WhiteboardDiff::UpdateCanvasObjects { canvas_objects } => {
                println!(
                    "Updating canvas_objects in database ...",
                );

                for (obj_id, canvas_object) in canvas_objects.iter() {
                    let query_doc = doc! { "_id": *obj_id };
                    let canvas_obj_doc = CanvasObjectMongoDBView::from_canvas_object(
                        canvas_object
                    );

                    let replace_canvas_object_res = self.canvas_object_coll
                        .replace_one(query_doc, &canvas_obj_doc)
                        .await;

                    match replace_canvas_object_res {
                        Err(e) => {
                            eprintln!(
                                "UpdateCanvasObjects replace failed: {}",
                                e
                            );
                        }
                        Ok(update) => {
                            eprintln!(
                                "UpdateCanvasObjects matched_count: {}",
                                update.matched_count
                            );
                            eprintln!(
                                "UpdateCanvasObjects modified_count: {}",
                                update.modified_count
                            );
                            eprintln!(
                                "UpdateCanvasObjects upserted_id: {:?}",
                                update.upserted_id
                            );
                        }
                    };
                } // end for (obj_id, canvas_object) in canvas_objects.iter()
            }
            WhiteboardDiff::DeleteCanvasObjects {
                canvas_object_ids,
            } => {
                println!(
                    "Deleting canvas objects in database: {:?}",
                    canvas_object_ids
                );

                let filter = doc! {
                    "_id": {
                        "$in": canvas_object_ids.clone()
                    }
                };
                let delete_canvas_objects_res =
                    self.canvas_object_coll.delete_many(filter).await;

                match delete_canvas_objects_res {
                    Err(e) => {
                        eprintln!(
                            "UpdateCanvasAllowedUsers update failed: {}",
                            e
                        );
                    }
                    Ok(update) => {
                        eprintln!(
                            "UpdateCanvasAllowedUsers deleted: {}",
                            update.deleted_count
                        );
                    }
                };
            }
            WhiteboardDiff::UpdateCanvasAllowedUsers {
                canvas_id,
                allowed_users,
            } => {
                println!(
                    "Updating allowed users in database for canvas {} ...",
                    canvas_id
                );

                let query = doc! {
                    "_id": canvas_id,
                };

                let operator = doc! {
                    "$set": {
                        "allowed_users": allowed_users.clone()
                    }
                };

                let update_allowed_users_res =
                    self.canvas_coll.update_one(query, operator).await;

                match update_allowed_users_res {
                    Err(e) => {
                        eprintln!(
                            "UpdateCanvasAllowedUsers update failed: {}",
                            e
                        );
                    }
                    Ok(update) => {
                        eprintln!(
                            "UpdateCanvasAllowedUsers matched_count: {}",
                            update.matched_count
                        );
                        eprintln!(
                            "UpdateCanvasAllowedUsers modified_count: {}",
                            update.modified_count
                        );
                        eprintln!(
                            "UpdateCanvasAllowedUsers upserted_id: {:?}",
                            update.upserted_id
                        );
                    }
                };
            }
            WhiteboardDiff::TransferChildCanvases {
                old_parent_id,
                new_parent_id,
                translate_x,
                translate_y,
            } => {
                println!(
                    "Transfering child canvases from canvas {} to canvas {} ...",
                    old_parent_id, new_parent_id
                );

                let query = doc! {
                    "parent_canvas.canvas_id": old_parent_id,
                };

                let operator = doc! {
                    "$set": {
                        "parent_canvas.canvas_id": new_parent_id,
                    },
                    "$inc": {
                        "parent_canvas.origin_x": translate_x,
                        "parent_canvas.origin_y": translate_y,
                    },
                };

                let update_canvases_res =
                    self.canvas_coll.update_many(query, operator).await;

                match update_canvases_res {
                    Err(e) => {
                        eprintln!(
                            "TransferChildCanvases failed: {}",
                            e
                        );
                    }
                    Ok(update) => {
                        eprintln!(
                            "TransferChildCanvases matched_count: {}",
                            update.matched_count
                        );
                        eprintln!(
                            "TransferChildCanvases modified_count: {}",
                            update.modified_count
                        );
                        eprintln!(
                            "TransferChildCanvases upserted_id: {:?}",
                            update.upserted_id
                        );
                    }
                };
            }
            WhiteboardDiff::TransferCanvasObjects {
                old_canvas_id,
                new_canvas_id,
                translate_x,
                translate_y,
            } => {
                println!(
                    "Transfering canvas_objects from canvas {} to canvas {} ...",
                    old_canvas_id, new_canvas_id
                );

                // query for vectors
                let query_vec = doc! {
                    "canvas_id": old_canvas_id,
                    "type": "vector",
                };

                // operator for vectors
                let operator_vec = doc! {
                    "$set": {
                        "canvas_id": new_canvas_id,
                    },
                    "$inc": {
                        "points.0": translate_x,
                        "points.1": translate_y,
                        "points.2": translate_x,
                        "points.3": translate_y,
                    },
                };

                let update_vectors_res = self.canvas_object_coll
                    .update_many(query_vec, operator_vec)
                    .await;

                match update_vectors_res {
                    Err(e) => {
                        eprintln!(
                            "TransferChildCanvasObjects failed on vectors: {}",
                            e
                        );
                    }
                    Ok(update) => {
                        eprintln!(
                            "TransferChildCanvasObjects on vectors matched_count: {}",
                            update.matched_count
                        );
                        eprintln!(
                            "TransferChildCanvasObjects on vectors modified_count: {}",
                            update.modified_count
                        );
                        eprintln!(
                            "TransferChildCanvasObjects on vectors upserted_id: {:?}",
                            update.upserted_id
                        );
                    }
                };

                // query for other canvas objects
                let query = doc! {
                    "canvas_id": old_canvas_id,
                    "type": {
                        "$ne": "vector",
                    },
                };

                // operator for other canvas objects
                let operator = doc! {
                    "$set": {
                        "canvas_id": new_canvas_id,
                    },
                    "$inc": {
                        "x": translate_x,
                        "y": translate_y,
                    },
                };

                let update_objects_res =
                    self.canvas_object_coll.update_many(query, operator).await;

                match update_objects_res {
                    Err(e) => {
                        eprintln!(
                            "TransferChildCanvasObjects failed on non-vectors: {}",
                            e
                        );
                    }
                    Ok(update) => {
                        eprintln!(
                            "TransferChildCanvasObjects on non-vectors matched_count: {}",
                            update.matched_count
                        );
                        eprintln!(
                            "TransferChildCanvasObjects on non-vectors modified_count: {}",
                            update.modified_count
                        );
                        eprintln!(
                            "TransferChildCanvasObjects on non-vectors upserted_id: {:?}",
                            update.upserted_id
                        );
                    }
                };
            },
            WhiteboardDiff::UndoEdit {
                target_edit_id,
            } => {
                let res = self.edit_coll.delete_one(doc! { "_id" : { "$eq": target_edit_id.clone(), }}).await;

                if let Err(e) = res {
                    eprintln!("ERROR: could not delete edit: {:?}", e);
                }
            },
            WhiteboardDiff::RedoEdit {
                ..
            } => {
                // -- currently no way to handle this at the database level
            },
        }
    }// -- end pub async fn process_diff

    pub async fn process_edit(&self, edit: &Edit) {
        // -- Generate and process diffs
        let diffs = edit.get_whiteboard_diffs();

        for diff in diffs.iter() {
            self.process_diff(diff).await;
        }// -- end for diff

        // -- Save edit to database, if applicable
        if let Some(edit_view) = EditMongoDBView::from_edit(edit) {
            let _ = self.edit_coll.insert_one(edit_view).await;
        }
    }// -- end pub async fn process_edit

    pub async fn save_notification(&self, notif: &Notification) {
        let notif_view = NotificationMongoDBView::from_notification(&notif);
        let _ = self.notification_coll.insert_one(notif_view).await;
    }// -- end save_notification
}// -- end impl MongoDBInterface

impl UserStore for MongoDBInterface {
    async fn get_user_by_id(
        &self,
        user_id: &UserIdType,
    ) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
        match self
            .user_coll
            .find_one(doc! { "_id": *user_id })
            .await?
        {
            Some(user_view) => Ok(Some(user_view.to_user())),
            None => Ok(None),
        } // -- end match self.user_collection.find_one(doc! { "_id": user_id.clone() }).await
    }
}// -- end impl UserStore for MongoDBInterface

impl WhiteboardMetadataStore for MongoDBInterface {
    async fn get_whiteboard_metadata_by_id(
        &self,
        whiteboard_id: &WhiteboardIdType,
    ) -> Result<Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>> {
        match self
            .whiteboard_metadata_coll
            .find_one(doc! { "_id": *whiteboard_id })
            .await?
        {
            Some(metadata_view) => Ok(Some(metadata_view.to_whiteboard_metadata())),
            None => Ok(None),
        } // -- end match self.whiteboard_metadata_collection.find_one(doc! { "_id": whiteboard_metadata_id.clone() }).await
    }
}// -- end impl WhiteboardMetadataStore for MongoDBInterface
