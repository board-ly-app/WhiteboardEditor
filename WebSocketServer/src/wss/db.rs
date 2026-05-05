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

    let whiteboard_view = match whiteboard_coll
        .find_one(doc! { "_id": *wid })
        .await?
    {
        None => {
            return Ok(None);
        }
        Some(wb) => wb,
    };

    eprintln!("!! whiteboard view: {:?}", whiteboard_view);
    let canvas_cursor = canvas_coll
        .aggregate([
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

    Ok(Some(whiteboard_view.to_whiteboard(canvases.as_slice())))
} // -- end fn get_whiteboard_by_id
