// === init-db.js ==============================================================
//
// Initializes the database with test data.
//
// No volume should be mounted for the container to persist data between runs.
// This ensures that tests run with the same data each time.
//
// =============================================================================

db = db.getSiblingDB("testdb"); // create/use "testdb"

// --- Create Users ---
const users = [
  {
    _id: new ObjectId('68d5e8cf829da666aece0101'),
    username: "alice",
    email: "alice@example.com",
    // password: password123
    passwordHashed: "$2b$10$lE4PvWzGiI.hKlq98/EFW.9QSKDDkq.O/WHvMjeMvheUiDxE2pzgW",
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0102'),
    username: "bob",
    email: "bob@example.com",
    // password: password456
    passwordHashed: "$2b$10$uLkhrYaddxeki7BymA4MdeqLtWgIRKjcQvgJvSbNhx1FQrWTJO8/2",
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0103'),
    username: "carol",
    email: "carol@example.com",
    // password: password789
    passwordHashed: "$2b$10$DQXE2KyaqWw3xS6wf.tdn.BRh0s7MXrhpHhibzFZ0fUqsnowBYcGq",
    },
  {
    _id: new ObjectId('68d5e8d4829da666aece0104'),
    username: "dave",
    email: "dave@example.com",
    // password: password101
    passwordHashed: "$2b$10$cGyV5HrtmrLGBr/6tU32/OsfmIFbPu28EzV6td0C9aRHfVCNs5d2e",
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0105'),
    username: "eve",
    email: "eve@example.com",
    // password: weakpassword
    passwordHashed: "$2b$10$ihPYYk6dgK/OwTMkBOnlXe9UDcSHNvYSWQe5N0oM11TPwle7EJrH2",
  },
];

db.users.insertMany(users);

const insertedUsers = db.users.find().toArray();

// --- Create Canvases ---
const canvases = [
  {
    _id: new ObjectId('68d5e8d4829da666aece0200'),
    width: 3000,
    height: 3000,
    name: "Canvas Alpha",
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0201'),
    width: 1024,
    height: 1024,
    name: "Canvas Beta",
    time_created: new Date("2025-08-02T12:20:00.000Z"),
    time_last_modified: new Date("2025-08-03T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  // -- children of first two canvases
  {
    _id: new ObjectId('68d5e8d4829da666aece0202'),
    width: 200,
    height: 200,
    name: "Canvas Alpha - One",
    parent_canvas: {
      // Canvas Alpha
      canvas_id: new ObjectId('68d5e8d4829da666aece0200'),
      origin_x: 100,
      origin_y: 100,
    },
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0203'),
    width: 600,
    height: 200,
    name: "Canvas Alpha - Two",
    parent_canvas: {
      // Canvas Alpha
      canvas_id: new ObjectId('68d5e8d4829da666aece0200'),
      origin_x: 300,
      origin_y: 300,
    },
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0204'),
    width: 100,
    height: 100,
    name: "Canvas Alpha - Three",
    parent_canvas: {
      // Canvas Alpha - One
      canvas_id: new ObjectId('68d5e8d4829da666aece0202'),
      origin_x: 50,
      origin_y: 50,
    },
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0205'),
    width: 800,
    height: 600,
    name: "Canvas Beta - One",
    parent_canvas: {
      // Canvas Beta
      canvas_id: new ObjectId('68d5e8d4829da666aece0201'),
      origin_x: 100,
      origin_y: 100,
    },
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0206'),
    width: 3000,
    height: 3000,
    name: "Canvas Gamma",
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0207'),
    width: 3000,
    height: 3000,
    name: "Canvas Delta",
    time_created: new Date("2025-08-01T12:10:00.000Z"),
    time_last_modified: new Date("2025-08-10T12:10:00.000Z"),
    // null allowed_users = all users allowed
    // allowed_users: [],
  },
];

db.canvases.insertMany(canvases);

const insertedCanvases = db.canvases.find().toArray();

// --- Create shapes/canvas objects ---
const shapes = [
  {
    _id: new ObjectId('68d5e8d4829da666aece0300'),
    // Canvas Alpha - Three
    canvas_id: new ObjectId('68d5e8d4829da666aece0204'),
    type: 'rect',
    width: 10,
    height: 10,
    x: 20,
    y: 20,
    rotation: 0,
    fillColor: "red",
    strokeColor: "black",
    strokeWidth: 1.0,
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0301'),
    // Canvas Beta - One
    canvas_id: new ObjectId('68d5e8d4829da666aece0205'),
    type: 'rect',
    width: 10,
    height: 10,
    x: 20,
    y: 20,
    rotation: 0,
    fillColor: "red",
    strokeColor: "black",
    strokeWidth: 1.0,
  },
];

db.shapes.insertMany(shapes);

const insertedShapes = db.shapes.find().toArray();

// --- Create Whiteboards ---
const whiteboards = [
  {
    _id: new ObjectId('68d5e8d4829da666aece0400'),
    name: "Project Alpha",
    time_created: new Date("2025-08-01T12:00:00.000Z"),
    root_canvas: insertedCanvases[0]._id,
    user_permissions: [
      {
        type: 'user',
        user: new ObjectId('68d5e8cf829da666aece0101'),  // Alice
        permission: 'own',
      }
    ],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0401'),
    name: "Project Beta",
    time_created: new Date("2025-08-02T12:10:00.000Z"),
    root_canvas: insertedCanvases[1]._id,
    user_permissions: [
      {
        type: 'user',
        user: new ObjectId('68d5e8d4829da666aece0102'), // Bob
        permission: 'own',
      }
    ],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0402'),
    name: "Project Gamma",
    time_created: new Date("2025-08-02T12:10:00.000Z"),
    root_canvas: new ObjectId('68d5e8d4829da666aece0206'),
    user_permissions: [
      {
        type: 'user',
        user: new ObjectId('68d5e8d4829da666aece0103'), // Carol
        permission: 'own',
      },
      {
        type: 'user',
        user: new ObjectId('68d5e8cf829da666aece0101'),  // Alice
        permission: 'edit',
      },
    ],
  },
  {
    _id: new ObjectId('68d5e8d4829da666aece0403'),
    name: "Project Delta",
    time_created: new Date("2025-08-02T12:10:00.000Z"),
    root_canvas: new ObjectId('68d5e8d4829da666aece0207'),
    user_permissions: [
      {
        type: 'user',
        user: new ObjectId('68d5e8d4829da666aece0103'), // Carol
        permission: 'own',
      },
      {
        type: 'user',
        user: new ObjectId('68d5e8cf829da666aece01ff'),  // Non-existent user
        permission: 'edit',
      },
    ],
  },
];

db.whiteboards.insertMany(whiteboards);

const insertedWhiteboards = db.whiteboards.find().toArray();

print("Database initialized with test users and whiteboards.");
