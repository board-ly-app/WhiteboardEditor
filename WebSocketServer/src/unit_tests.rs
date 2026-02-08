// === tests.rs ===================================================================================
//
// COntains all unit tests for the crate.
//
// ================================================================================================

#[cfg(test)]
mod unit_tests {
    use crate::*;
    use std::collections::{
        HashMap,
    };

    #[tokio::test]
    async fn handle_invalid_client_message() {
        // not even valid json
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let client_msg_s = "This is not valid json";
        let test_canvas_id = ObjectId::new();

        // -- initialize client state
        let whiteboard = Whiteboard {
            id: ObjectId::new(),
            metadata: WhiteboardMetadata {
                name: String::from("Test"),
                user_permissions: vec![],
                permissions_by_user_id: HashMap::new(),
            },
            root_canvas: test_canvas_id,
            canvases: HashMap::new(),
        };

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary{
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

        let resp = handle_authenticated_client_message(
            &client_state,
            client_msg_s
        ).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            Some(server_msg) => match server_msg {
                ServerSocketMessage::IndividualError { client_id, .. } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else {
                        // success
                    }
                },
                _ => panic!("Expected ServerSocketMessage::IndividualError, got {:?}", server_msg)
            }
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_create_shapes() {
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
        let client_msg_s = format!(r##"
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
        "##, canvas_a_id);

        let whiteboard = Whiteboard {
            id: ObjectId::new(),
            metadata: WhiteboardMetadata {
                name: String::from("Test"),
                user_permissions: vec![],
                permissions_by_user_id: HashMap::new(),
            },
            root_canvas: canvas_a_id,
            canvases: HashMap::from([
                (
                    canvas_a_id.clone(),
                    Canvas {
                        id: canvas_a_id.clone(),
                        width: 512.0,
                        height: 512.0,
                        name: String::from("Canvas A"),
                        time_created: Utc::now(),
                        time_last_modified: Utc::now(),
                        parent_canvas: None,
                        shapes: HashMap::new(),
                        allowed_users: None, // None = open to all
                    }
                )
            ]),
        };

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary{
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(
                Some(WhiteboardPermissionEnum::Own)
            ),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(
            &client_state,
            &client_msg_s
        ).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            // CreateShapes { client_id: ClientIdType, canvas_id: CanvasIdType, shapes: HashMap<CanvasObjectIdType, ShapeModel> },
            Some(server_msg) => match server_msg {
                ServerSocketMessage::CreateShapes { client_id, canvas_id, shapes } => {
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
                        let mut shapes_entries : Vec<(&String, &ShapeModel)> = shapes.iter()
                            .collect();

                        shapes_entries.sort_by_key(|(obj_id, _)| (*obj_id).clone());

                        for (ref shape_entry, ref shape_expected) in shapes_entries.iter().zip(shapes_expected.iter()) {
                            let (_, shape) = shape_entry;

                            match (shape, shape_expected) {
                                (
                                    ShapeModel::Rect { x, y, width, height, stroke_width, stroke_color, fill_color, rotation },
                                    ShapeModel::Rect { x: x_exp, y: y_exp, width: width_exp, height: height_exp, stroke_width: stroke_width_exp, stroke_color: stroke_color_exp, fill_color: fill_color_exp, rotation: rotation_exp }
                                ) => {
                                    if (x - x_exp).abs() > f64_prec {
                                        panic!("Expected shape x = {}; got {}", x, x_exp);
                                    }
                                    if (y - y_exp).abs() > f64_prec {
                                        panic!("Expected shape y = {}; got {}", y, y_exp);
                                    }
                                    if (width - width_exp).abs() > f64_prec {
                                        panic!("Expected shape width = {}; got {}", width, width_exp);
                                    }
                                    if (height - height_exp).abs() > f64_prec {
                                        panic!("Expected shape height = {}; got {}", height, height_exp);
                                    }
                                    if (stroke_width - stroke_width_exp).abs() > f64_prec {
                                        panic!("Expected shape stroke_width = {}; got {}", stroke_width, stroke_width_exp);
                                    }
                                    if stroke_color != stroke_color_exp {
                                        panic!("Expected shape stroke_color = {}; got {}", stroke_color, stroke_color_exp);
                                    }
                                    if fill_color != fill_color_exp {
                                        panic!("Expected shape fill_color = {}; got {}", fill_color, fill_color_exp);
                                    }
                                    if (rotation - rotation_exp).abs() > f64_prec {
                                        panic!("Expected shape rotation = {}; got {}", rotation, rotation_exp);
                                    }
                                },
                                (_, _) => panic!("Expected Rect; got {:?}", shape)
                            };

                            // success
                        }
                    }
                },
                _ => panic!("Expected ServerSocketMessage::IndividualError, got {:?}", server_msg)
            }
        };
    }

    #[tokio::test]
    async fn handle_authenticated_client_message_delete_canvas_objects() {
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
                }
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
                }
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
                }
            ),
        ];
        let canvas_objects_final_kv = Vec::from(&canvas_objects_initial_kv[1..]);
        let canvas_objects_initial = HashMap::<ObjectId, ShapeModel>::from_iter(canvas_objects_initial_kv.into_iter());
        let canvas_objects_final_expected = HashMap::<ObjectId, ShapeModel>::from_iter(canvas_objects_final_kv.into_iter());
        let canvas_obj_ids_expected = vec![ object_a_id.to_string() ];
        let client_msg_s = format!(r##"
        {{
            "type": "delete_canvas_objects",
            "canvasObjectIds": [
                "{}"
            ]
        }}
        "##, object_a_id.to_string());

        let whiteboard = Whiteboard {
            id: ObjectId::new(),
            metadata: WhiteboardMetadata {
                name: String::from("Test"),
                user_permissions: vec![],
                permissions_by_user_id: HashMap::new(),
            },
            root_canvas: canvas_a_id,
            canvases: HashMap::from([
                (
                    canvas_a_id.clone(),
                    Canvas {
                        id: canvas_a_id.clone(),
                        width: 512.0,
                        height: 512.0,
                        name: String::from("Canvas A"),
                        time_created: Utc::now(),
                        time_last_modified: Utc::now(),
                        parent_canvas: None,
                        shapes: canvas_objects_initial.clone(),
                        allowed_users: None, // None = open to all
                    }
                )
            ]),
        };

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary{
                client_id: test_client_id.clone(),
                user_id: String::from("68d5e8cf829da666aece0101"),
                username: String::from("Alice"),
            })),
            jwt_secret: String::from("abcd"),
            user_whiteboard_permission: Mutex::new(
                Some(WhiteboardPermissionEnum::Own)
            ),
            whiteboard_ref: Arc::new(Mutex::new(whiteboard.clone())),
            active_clients: Arc::new(Mutex::new(HashMap::new())),
            diffs: Arc::new(Mutex::new(Vec::new())),
        };

        let resp = handle_authenticated_client_message(
            &client_state,
            &client_msg_s
        ).await;

        match resp {
            None => panic!("Expected some client message, got None"),
            // CreateShapes { client_id: ClientIdType, canvas_id: CanvasIdType, shapes: HashMap<CanvasObjectIdType, ShapeModel> },
            Some(server_msg) => match server_msg {
                ServerSocketMessage::DeleteCanvasObjects { client_id, canvas_object_ids } => {
                    if client_id != test_client_id {
                        panic!("Expected client_id = {}; got {}", test_client_id, client_id);
                    } else if canvas_object_ids != canvas_obj_ids_expected {
                        panic!("Expected canvas_object_ids = {:?}; got {:?}", canvas_obj_ids_expected, canvas_object_ids);
                    } else {
                        let whiteboard = client_state.whiteboard_ref.lock().await;

                        // Ensure the correct canvas objects remain in the store of canvas objects
                        if let Some(canvas_a) = whiteboard.canvases.get(&canvas_a_id) {
                            if canvas_a.shapes != canvas_objects_final_expected {
                                panic!(
                                    "Expected final canvas objects to be {:?}; got {:?}",
                                    canvas_objects_final_expected, canvas_a.shapes
                                );
                            }
                        } else {
                            panic!("ERROR: could not find canvas {} in final whiteboard", canvas_a_id);
                        }
                    }
                },
                _ => panic!("Expected ServerSocketMessage::DeleteCanvasObjects, got {:?}", server_msg)
            }
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
        use crate::bson::{
            oid::ObjectId,
        };
        use crate::chrono::{
            TimeZone,
            MappedLocalTime,
            Utc,
        };

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

        let whiteboard = get_whiteboard_by_id(&db, &whiteboard_id).await.unwrap().unwrap();

        println!("Whiteboard Received: {:?}", whiteboard);

        assert!(whiteboard.id == whiteboard_id);
        assert!(whiteboard.metadata.name == "Project Alpha");
        assert!(whiteboard.metadata.user_permissions.len() == 1);
        assert!(whiteboard.root_canvas == root_canvas_id);
        assert!(whiteboard.canvases.len() == 4);
        assert!(whiteboard.canvases.contains_key(&root_canvas_id));

        // -- ensure all expected canvases are present
        for canvas_id in &canvas_ids {
            assert!(whiteboard.canvases.contains_key(canvas_id));
        }// -- end for canvas_id in &canvas_ids

        // -- check contents of root canvas
        let canvas = whiteboard.canvases.get(&root_canvas_id).unwrap();

        assert!(canvas.id == root_canvas_id);
        assert!(f64::abs(canvas.width - 3000.0) < 1.0e-16);
        assert!(f64::abs(canvas.height - 3000.0) < 1.0e-16);
        assert!(canvas.name.as_str() == "Canvas Alpha");

        let exp_time_created = match Utc.timestamp_opt(1754050200, 0) {
            MappedLocalTime::Single(val) => val,
            bad_val => {
                panic!("Got {:?} from expected time created timestamp", bad_val);
            },
        };

        let exp_time_last_modified = match Utc.timestamp_opt(1754827800, 0) {
            MappedLocalTime::Single(val) => val,
            bad_val => {
                panic!("Got {:?} from expected time last modified timestamp", bad_val);
            },
        };

        assert!(canvas.time_created == exp_time_created);
        assert!(canvas.time_last_modified == exp_time_last_modified);
        assert!(canvas.shapes.len() == 0);
        assert!(canvas.allowed_users.is_none());
    }// -- end fn fetch_whiteboard_from_mongodb()

    // === MockStore ==============================================================================
    //
    // Instead of pulling data from database, contains pre-cached user values.
    //
    // ============================================================================================
    struct MockStore {
        users_by_id: HashMap<UserIdType, User>,
        whiteboards_by_id: HashMap<WhiteboardIdType, Whiteboard>,
    }// -- end struct MockStore

    impl UserStore for MockStore {
        async fn get_user_by_id(&self, user_id: &UserIdType) -> Result<Option<User>, Box<dyn std::error::Error + Send + Sync>> {
            match self.users_by_id.get(user_id) {
                Some(user) => Ok(Some(user.clone())),
                None => Ok(None),
            }
        }// -- end get_user_by_id
    }

    impl WhiteboardMetadataStore for MockStore {
        async fn get_whiteboard_metadata_by_id(&self, whiteboard_id: &WhiteboardIdType) -> Result<
            Option<WhiteboardMetadata>, Box<dyn std::error::Error + Send + Sync>
        > {
            match self.whiteboards_by_id.get(whiteboard_id) {
                Some(whiteboard) => Ok(Some(whiteboard.metadata.clone())),
                None => Ok(None),
            }
        }// -- end get_whiteboard_metadata_by_id
    }

    // === handle_valid_login_attempt =============================================================
    //
    // Ensure that handle_unauthenticated_client_message correctly handles a valid login attempt.
    //
    // ============================================================================================
    #[tokio::test]
    async fn handle_valid_login_attempt() {
        use mongodb::{
            bson::{
                oid::ObjectId,
            },
        };
        use hmac::{Hmac, Mac};
        use jwt::SignWithKey;
        use sha2::Sha256;

        let jwt_secret = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
        let target_uid_s = "68d5e8d4829da666aece5f48";
        let target_uid = ObjectId::parse_str(target_uid_s).expect("UID to be valid");

        // -- pre-generate jwt with desired uid
        let key : Hmac<Sha256> = Hmac::new_from_slice(jwt_secret.as_bytes())
            .expect("Valid key to be generated");
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
            users_by_id: HashMap::from([
                (target_uid, User {
                    id: ObjectId::parse_str(target_uid_s).unwrap(),
                    username: String::from("bob"),
                    email: String::from("bob@example.com"),
                }),
            ]),
            whiteboards_by_id: HashMap::new(),  // not needed here
        };

        // -- initialize mock client state
        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);

        let whiteboard = Whiteboard {
            id: ObjectId::new(),
            metadata: WhiteboardMetadata {
                name: String::from("Test"),
                user_permissions: vec![
                    WhiteboardPermission {
                        permission_type: WhiteboardPermissionType::User {
                            user: target_uid,
                        },
                        permission: WhiteboardPermissionEnum::Edit,
                    },
                ],
                permissions_by_user_id: HashMap::from([
                    (String::from(target_uid_s), WhiteboardPermissionEnum::Edit),
                ]),
            },
            root_canvas: ObjectId::new(),
            canvases: HashMap::new(),
        };
        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary{
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
        let client_login_msg_s = format!(
            r#"{{ "type": "login", "jwt": "{}" }}"#, 
            token_s
        );

        // -- attempt login
        let resp = handle_unauthenticated_client_message(
            &client_state,
            &user_store,
            client_login_msg_s.as_str()
        ).await.expect("Response to client login message");

        match resp {
            ServerSocketMessage::InitClient { client_id, whiteboard: whiteboard_view, active_clients } => {
                let user_perm = client_state.user_whiteboard_permission.lock().await;

                assert_eq!(client_id, test_client_id);
                assert_eq!(whiteboard_view, whiteboard.to_client_view());
                assert_eq!(*user_perm, Some(WhiteboardPermissionEnum::Edit));
                assert_eq!(active_clients, HashMap::from([
                    (test_client_id.clone(), UserSummary {
                        client_id: test_client_id.clone(),
                        user_id: String::from(target_uid_s),
                        username: String::from("bob"),
                    })
                ]));
            },
            bad_resp => {
                panic!("Expected InitClient message, got {:?}", bad_resp);
            },
        };
    }// -- end fn fetch_user_from_mongodb_user_store

    // === fetch_user_from_mongodb_user_store =====================================================
    //
    // Tests instantiating a MongoDBStore and using it to fetch a user account from the test
    // database.
    //
    // See TestDatabase/init-db.js for the sample data.
    //
    // ============================================================================================
    #[tokio::test]
    async fn fetch_user_from_mongodb_user_store() {
        use mongodb::{
            Collection,
            bson::{
                oid::{
                    ObjectId,
                },
            },
        };

        // -- initialize database connection
        let mongo_uri = "mongodb://test_db:27017/testdb";
        let mongo_client = connect_mongodb(&mongo_uri).await
            .expect("Mongo client to establish connection to database");
        let db = mongo_client.default_database()
            .expect("The mongo uri to point to a default database");
        let user_coll: Collection<UserMongoDBView> = db.collection::<UserMongoDBView>(
            "users"
        );
        let whiteboard_metadata_coll: Collection<WhiteboardMetadataMongoDBView> = db.collection::<WhiteboardMetadataMongoDBView>(
            "whiteboards"
        );

        // -- "alice"
        let uid = ObjectId::parse_str("68d5e8cf829da666aece0101")
            .expect("The provided string is a valid ObjectId");

        // -- instantiate MongoDBStore
        let user_store = MongoDBStore::new(&user_coll, &whiteboard_metadata_coll);

        // -- fetch the user from the database
        let user_opt = user_store.get_user_by_id(&uid).await
            .expect("The user store to return a user with the given ID");
        let user = user_opt.expect("User to be non-null");

        // -- ensure fetched user matches expected value
        assert!(user.id == uid);
        assert!(user.username.as_str() == "alice");
        assert!(user.email.as_str() == "alice@example.com");
    }// -- end fn fetch_user_from_mongodb_user_store()

    // === test_create_shapes_nonexistent_canvas_id ===============================================
    //
    // Ensure that an IndividualError is returned when provided 
    //
    // ============================================================================================
    #[tokio::test]
    async fn test_create_shapes_nonexistent_canvas_id() {
        use ServerSocketMessage::*;

        let test_client_id = generate_unique_client_id(ObjectId::new(), 0);
        let test_user_id = ObjectId::new();
        let invalid_canvas_id = ObjectId::new();
        let client_msg_s = format!(r#"{{
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
        }}"#, invalid_canvas_id.to_string());

        // -- initialize client state
        let whiteboard = Whiteboard {
            id: ObjectId::new(),
            metadata: WhiteboardMetadata {
                name: String::from("Test"),
                user_permissions: vec![
                    WhiteboardPermission {
                        permission_type: WhiteboardPermissionType::User {
                            user: test_user_id,
                        },
                        permission: WhiteboardPermissionEnum::Edit,
                    },
                ],
                permissions_by_user_id: HashMap::from([
                    (test_user_id.to_string(), WhiteboardPermissionEnum::Edit),
                ]),
            },
            // no canvases
            root_canvas: ObjectId::new(),
            canvases: HashMap::new(),
        };

        let client_state = ClientState {
            client_id: test_client_id.clone(),
            user_summary: Mutex::new(Some(UserSummary{
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

        let resp = handle_authenticated_client_message(
            &client_state,
            client_msg_s.as_str()
        ).await;

        match resp {
            Some(IndividualError { client_id, error }) => {
                assert_eq!(client_id, test_client_id);

                match error {
                    ClientError::CanvasNotFound{ canvas_id } => {
                        assert_eq!(canvas_id, invalid_canvas_id.to_string());
                    },
                    bad_err => {
                        panic!("expected CanvasNotFound, got {:?}", bad_err);
                    },
                };
            },
            bad_resp => {
                panic!("expected IndividualError in response, got {:?}", bad_resp);
            },
        };
    }// -- end test_create_shapes_nonexistent_canvas_id
}
