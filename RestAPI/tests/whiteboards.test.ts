import request from "supertest";
import app from "../src/app";
import mongoose from 'mongoose';
import jwt from "jsonwebtoken";

// -- imports from models
import type {
  IUser,
} from '../src/models/User';

import type {
  IWhiteboardAttribView,
  IWhiteboardUserPermission,
  IWhiteboardUserPermissionModel,
} from '../src/models/Whiteboard';

const MONGO_URI = 'mongodb://test_db:27017/testdb';

// handle database connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI)
  } catch (err) {
    console.error('FAILED TO CONNECT TO DATABASE:', err);
    process.exit(1);
  }
};

const disconnectFromDatabase = async () => {
  await mongoose.disconnect();
};

beforeAll(connectToDatabase);

afterAll(disconnectFromDatabase);

// === standard utilities for validating certain objects =======================
//
// =============================================================================

// === validateUser ============================================================
//
// Ensures that the user object is a valid public view of a user. Should include
// id, email, and username, but exclude the hashed password.
//
// =============================================================================
const validateUser = (user: IUser, fieldValues: {} | any[]) => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('email');
  expect(user).toHaveProperty('username');
  expect(user).not.toHaveProperty('passwordHashed');

  if (fieldValues) {
    expect(user).toMatchObject(fieldValues);
  }
};

const validateWhiteboardAttribView = (
  whiteboard: IWhiteboardAttribView,
  fieldValues: Record<string, any> | any[]
) => {
  expect(whiteboard).toHaveProperty('id');
  expect(whiteboard).not.toHaveProperty('_id');
  expect(whiteboard).toHaveProperty('name');
  expect(whiteboard).toHaveProperty('time_created');
  // NOTE: no canvases

  // -- root canvas
  expect(whiteboard).toHaveProperty('root_canvas');

  // -- shared users
  expect(whiteboard).toHaveProperty('user_permissions');
  expect(Array.isArray(whiteboard.user_permissions)).toBe(true);
  for (const perm of whiteboard.user_permissions) {
    switch (perm.type) {
      case 'user':
        expect(perm).toHaveProperty('user');
        validateUser(perm.user as unknown as IUser, {});
        break;
      case 'email':
        expect(perm).toHaveProperty('email');
        expect(typeof perm.email).toEqual('string');
        break;
      default:
        console.error('Unrecognized permission type:', perm);
        throw new Error(`Unrecognized permission type: ${perm}`);
    }
  }

  if (fieldValues) {
    let expectedValues = fieldValues;

    if ('user_permissions' in fieldValues) {
      const {
        user_permissions,
        ...expectedFieldValues
      } = fieldValues;
      const sharedUsers = user_permissions as IWhiteboardUserPermission<any>[];

      expectedValues = expectedFieldValues;

      if (user_permissions) {
        expect(Array.isArray(whiteboard.user_permissions)).toBe(true);
        expect(whiteboard.user_permissions.length).toBe(sharedUsers.length);

        for (let idx = 0; idx < sharedUsers.length; ++idx) {
          expect(whiteboard.user_permissions[idx]).toMatchObject(sharedUsers[idx]);
        }
      }
    }

    expect(whiteboard).toMatchObject(expectedValues);
  }
};

describe("Whiteboards API", () => {
  it("should allow an authenticated user to get their own whiteboard", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    const targetUrl = `/api/v1/whiteboards/${whiteboard._id.toString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Get whiteboard
    const wbRes = await request(app)
      .get(targetUrl)
      .set("Authorization", `Bearer ${authToken}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, {
      user_permissions: [
        {
          type: 'user',
          user: {
            id: owner._id.toString(),
            username: 'alice',
            email: 'alice@example.com',
          },
          permission: 'own',
        },
      ],
    });
  });

  it("should fetch an authenticated user's own whiteboards at GET /whiteboards/own", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');

    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner)) {
      return;
    }

    const targetUrl = '/api/v1/whiteboards/own';

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Get whiteboard
    const wbRes = await request(app)
      .get(targetUrl)
      .set("Authorization", `Bearer ${authToken}`)
      .send()
      .expect(200);

    expect(wbRes.body.length).toBe(1);

    const whiteboardsExpect = [
      {
        // -- Project Alpha
        id: '68d5e8d4829da666aece0400',
      }
    ];

    for (const i_wb in whiteboardsExpect) {
      validateWhiteboardAttribView(wbRes.body[i_wb], whiteboardsExpect[i_wb]);
    }// -- end for i_wb
  });

  it("should not create a new whiteboard for an unauthenticated user", async () => {
    await request(app)
      .post("/api/v1/whiteboards")
      .send({
        name: "Bad Whiteboard",
        width: 3000,
        height: 3000,
      })
      .expect(401);
  });

  it("should create a new whiteboard for an authenticated user", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');

    const user = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(user).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! user)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: user._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Create whiteboard
    const wbRes = await request(app)
      .post("/api/v1/whiteboards")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Alice's Whiteboard",
        width: 3000,
        height: 3000,
      })
      .expect(201);

    // Verify response body
    validateWhiteboardAttribView(wbRes.body, {
      name: "Alice's Whiteboard",
    });
  });

  it("should allow setting collaborator permissions when creating a new whiteboard", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');

    const creatingUser = await userCollection.findOne({ username: 'alice' });
    const sharedUser = await userCollection.findOne({ username: 'bob' });

    expect(jwtSecret).not.toBeNull();
    expect(creatingUser).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! creatingUser) || (! sharedUser)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: creatingUser._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    const collaboratorPermissionsReq = [
      {
        type: 'email',
        email: sharedUser.email,
        permission: 'edit',
      },
      {
        type: 'email',
        email: 'nobody@example.com',
        permission: 'view',
      },
    ];

    const collaboratorPermissionsExpect = [
      {
        type: 'user',
        user: { id: creatingUser._id.toString() },
        permission: 'own',
      },
      {
        type: 'user',
        user: { id: sharedUser._id.toString() },
        permission: 'edit',
      },
      {
        type: 'email',
        email: 'nobody@example.com',
        permission: 'view',
      },
    ];

    // -- Create whiteboard
    const wbRes = await request(app)
      .post("/api/v1/whiteboards")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Alice's Shared Whiteboard",
        width: 3000,
        height: 3000,
        collaboratorPermissions: collaboratorPermissionsReq,
      })
      .expect(201);

    // Verify response body
    validateWhiteboardAttribView(wbRes.body, {
      name: "Alice's Shared Whiteboard",
      user_permissions: collaboratorPermissionsExpect,
    });
  });

  it("should allow an authenticated user to share their whiteboard", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });
    const sharee = await userCollection.findOne({ username: 'bob' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(sharee).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! sharee) || (! whiteboard)) {
      return;
    }

    const targetUrl = `/api/v1/whiteboards/${whiteboard._id}/user_permissions`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Share whiteboard
    const wbRes = await request(app)
      .post(targetUrl)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        userPermissions: [
          {
            type: 'user',
            user: owner._id.toString(),
            permission: 'own'
          },
          {
            type: 'user',
            user: sharee._id.toString(),
            permission: 'view'
          }
        ]
      })
      .expect(200);

      validateWhiteboardAttribView(wbRes.body, {
        user_permissions: [
          {
            type: 'user',
            user: {
              id: owner._id.toString(),
              username: owner.username,
              email: owner.email,
            },
            permission: 'own'
          },
          {
            type: 'user',
            user: ({
              id: sharee._id.toString(),
              username: sharee.username,
              email: sharee.email,
            }),
            permission: 'view',
          }
        ]
      });
  });

  it("should not allow a user to share a whiteboard they don't own", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Beta"});
    const owner = await userCollection.findOne({ username: 'alice' });
    const sharee = await userCollection.findOne({ username: 'bob' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(sharee).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! sharee) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Share whiteboard
    await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        userPermissions: [{
          type: 'user',
          user: sharee._id.toString(),
          permission: 'view'
        }]
      })
      .expect(403);
  });

  it("should not allow a user to share a whiteboard with user with a malformed user ID", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Share whiteboard
    await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        // Not a real id
        userPermissions: [{
          type: 'user',
          user: 'zzzzzzz',
          permission: 'view'
        }]
      })
      .expect(400);
  });

  it("should not allow a user to share a whiteboard with a user that doesn't exist", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Share whiteboard
    await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        // With timestamp at beginning of unix epoch
        userPermissions: [{
          type: 'user',
          user: '000000018ab18fedd089b041',
          permission: 'view'
        }]
      })
      .expect(400);
  });

  it("should allow a user to share a whiteboard with a user email that doesn't correspond to an existing account", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    const userPermissionsReq: IWhiteboardUserPermissionModel<any>[] = [
      {
        type: 'user',
        // no corresponding user in Users collection
        user: owner._id,
        permission: 'own'
      },
      {
        type: 'email',
        // no corresponding user in Users collection
        email: 'noexist@example.com',
        permission: 'view'
      }
    ];

    const userPermissionsExpect: IWhiteboardUserPermissionModel<any>[] = [
      {
        type: 'user',
        // no corresponding user in Users collection
        user: {
          id: owner._id.toString(),
          username: owner.username,
          email: owner.email
        },
        permission: 'own'
      },
      {
        type: 'email',
        // no corresponding user in Users collection
        email: 'noexist@example.com',
        permission: 'view'
      }
    ];

    // -- Share whiteboard
    const wbRes = await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, {
      user_permissions: userPermissionsExpect,
    });
  });

  it("should convert a shared user email to a shared user id if an account exists for the given email", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    const targetUserEmail = 'carol@example.com';
    const targetUser = await userCollection.findOne({ email: targetUserEmail });

    expect(targetUser).not.toBeNull();

    // to please typescript
    if (! targetUser) {
      return;
    }

    const userPermissionsReq = [
      {
        type: 'user',
        user: owner._id,
        permission: 'own'
      },
      {
        type: 'email',
        email: targetUserEmail,
        permission: 'view'
      },
    ];

    const userPermissionsExpect = [
      {
        type: 'user',
        user: {
          id: owner._id.toString(),
          username: owner.username,
          email: owner.email,
        },
        permission: 'own'
      },
      {
        type: 'user',
        user: ({
          id: targetUser._id.toString(),
          username: targetUser.username,
          email: targetUser.email,
        }),
        permission: 'view'
      },
    ];

    // -- Share whiteboard
    const wbRes = await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, {});

    // -- shared users
    expect(wbRes.body.user_permissions.length).toBe(userPermissionsExpect.length);

    for (const i in userPermissionsExpect) {
      expect(wbRes.body.user_permissions[i]).toMatchObject(userPermissionsExpect[i]);
    }// -- end for (const i in userPermissionsExpect)
  });

  it("should ensure that a request to change a whiteboard's shared users leaves at least one user with \"own\" permission", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha"});
    const owner = await userCollection.findOne({ username: 'alice' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    const targetUserEmail = 'carol@example.com';

    // -- Eliminates owner from list of shared users
    const userPermissionsReq = [
      {
        type: 'email',
        email: targetUserEmail,
        permission: 'view'
      },
    ];

    // -- Attempt to reset shared users to exclude owner; should fail
    await request(app)
      .post(`/api/v1/whiteboards/${whiteboard._id}/user_permissions`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(400);
  });

  it("should ignore invalid user ids (i.e. from deleted users) in permissions when fetching a whiteboard", async () => {
    const jwtSecret = process.env.JWT_SECRET;
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Delta"});
    const owner = await userCollection.findOne({ username: 'carol' });

    expect(jwtSecret).not.toBeNull();
    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! jwtSecret) || (! owner) || (! whiteboard)) {
      return;
    }

    const targetUrl = `/api/v1/whiteboards/${whiteboard._id.toString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Get whiteboard
    const wbRes = await request(app)
      .get(targetUrl)
      .set("Authorization", `Bearer ${authToken}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, {
      user_permissions: [
        {
          type: 'user',
          user: {
            id: owner._id.toString(),
            username: 'carol',
            email: 'carol@example.com',
          },
          permission: 'own',
        },
      ],
    });
  });
});
