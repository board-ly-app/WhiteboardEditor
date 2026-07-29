import request from "supertest";
import mongoose, {
  Types,
} from 'mongoose';
import jwt from "jsonwebtoken";

// -- imports from models
import app from "../src/app";
import {
  ACCESS_TOKEN_COOKIE_ID,
} from '../src/app.config';

import {
  type IUser,
} from '../src/models/User';

import {
  type IWhiteboard,
  type IWhiteboardAttribView,
  type IWhiteboardUserPermission,
  type IWhiteboardUserPermissionModel,
} from '../src/models/Whiteboard';

import {
  createSignedTempConversionPayload,
  verifySignedTempConversionPayload,
} from '../src/services/whiteboardService';

const MONGO_URI = 'mongodb://test_db:27017/testdb';

const {
  ACCESS_TOKEN_SECRET,
} = process.env;

if (! ACCESS_TOKEN_SECRET) {
  throw new Error('ACCESS_TOKEN_SECRET not defined in process environment');
}

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
const validateUser = (user: IUser, view: 'owner' | 'public', fieldValues: {} | any[]) => {
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('username');

  if (view === 'owner' && user.kind === 'permanent') {
    expect(user).toHaveProperty('email');
  } else if (user.kind === 'temp') {
    expect(user).toHaveProperty("createdAt");
  }

  expect(user).not.toHaveProperty('passwordHashed');

  if (fieldValues) {
    expect(user).toMatchObject(fieldValues);
  }
};

const validateWhiteboardAttribView = (
  whiteboard: IWhiteboardAttribView,
  view: 'owner' | 'public',
  fieldValues: Record<string, any>
) => {
  expect(whiteboard).toHaveProperty('id');
  expect(whiteboard).toHaveProperty('kind');
  expect(whiteboard).toHaveProperty('name');
  expect(whiteboard).not.toHaveProperty('_id');
  // NOTE: no canvases

  // Verify the kind matches if specified in expectations
  if (fieldValues.kind) {
    expect(whiteboard.kind).toBe(fieldValues.kind);
  }

  // Handle specific fields based on kind
  if (whiteboard.kind === 'temp_whiteboard') {
    expect(whiteboard).toHaveProperty('createdAt');
  } else if (whiteboard.kind === 'permanent_whiteboard') {
    expect(whiteboard).toHaveProperty('time_created');
  }

  // -- root canvas
  expect(whiteboard).toHaveProperty('root_canvas');

  // -- shared users
  expect(whiteboard).toHaveProperty('user_permissions');
  expect(Array.isArray(whiteboard.user_permissions)).toBe(true);
  for (const perm of whiteboard.user_permissions) {
    switch (perm.type) {
      case 'user':
        expect(perm).toHaveProperty('user');
        validateUser(perm.user as unknown as IUser, view, {});
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
    const jwtSecret = ACCESS_TOKEN_SECRET;
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

    const targetUrl = `/api/v1/whiteboards/id/${whiteboard._id.toHexString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toHexString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Get whiteboard
    const wbRes = await request(app)
      .get(targetUrl)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'owner', {
      user_permissions: [
        {
          type: 'user',
          user: {
            id: owner._id.toString(),
            kind: 'permanent',
            username: 'alice',
            email: 'alice@example.com',
          },
          permission: 'own',
        },
      ],
    });
  });

  it("should fetch an authenticated user's own whiteboards at GET /whiteboards/own", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
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
      validateWhiteboardAttribView(wbRes.body[i_wb], 'owner', whiteboardsExpect[i_wb]);
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

  it("should create a new permanent whiteboard for an authenticated user", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        name: "Alice's Whiteboard",
        width: 3000,
        height: 3000,
      })
      .expect(201);

    // Verify response body
    validateWhiteboardAttribView(wbRes.body, 'owner', {
      name: "Alice's Whiteboard",
      kind: "permanent_whiteboard"
    });

    expect(wbRes.body).toHaveProperty('time_created');
    expect(wbRes.body).not.toHaveProperty('createdAt');
  });

  it("should create a new temp whiteboard for a temp user", async () => {
    const tempUser = await mongoose.connection.collection('users').findOne({ kind: 'temp' });
    
    const authToken = jwt.sign(
      { sub: tempUser!._id.toString(), isTemp: true },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post("/api/v1/whiteboards/temp")
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        name: "Temporary Session",
        width: 1920,
        height: 1080,
      })
      .expect(201);

    validateWhiteboardAttribView(res.body, 'owner', {
      name: "Temporary Session",
      kind: "temp_whiteboard"
    });
    
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).not.toHaveProperty('time_created');
  });

  it("should allow setting collaborator permissions when creating a new whiteboard", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        name: "Alice's Shared Whiteboard",
        width: 3000,
        height: 3000,
        collaboratorPermissions: collaboratorPermissionsReq,
      })
      .expect(201);

    // Verify response body
    validateWhiteboardAttribView(wbRes.body, 'owner', {
      name: "Alice's Shared Whiteboard",
      user_permissions: collaboratorPermissionsExpect,
    });
  });

  it("should allow an authenticated user to share their whiteboard", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
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

      validateWhiteboardAttribView(wbRes.body, 'owner', {
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
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
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
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
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
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
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
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'owner', {
      user_permissions: userPermissionsExpect,
    });
  });

  it("should convert a shared user email to a shared user id if an account exists for the given email", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'owner', {});

    // -- shared users
    expect(wbRes.body.user_permissions.length).toBe(userPermissionsExpect.length);

    for (const i in userPermissionsExpect) {
      expect(wbRes.body.user_permissions[i]).toMatchObject(userPermissionsExpect[i]);
    }// -- end for (const i in userPermissionsExpect)
  });

  it("should ensure that a request to change a whiteboard's shared users leaves at least one user with \"own\" permission", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        userPermissions: userPermissionsReq
      })
      .expect(400);
  });

  it("should ignore invalid user ids (i.e. from deleted users) in permissions when fetching a whiteboard", async () => {
    const jwtSecret = ACCESS_TOKEN_SECRET;
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

    const targetUrl = `/api/v1/whiteboards/id/${whiteboard._id.toString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      jwtSecret,
      { expiresIn: 999999999 }
    );

    // -- Get whiteboard
    const wbRes = await request(app)
      .get(targetUrl)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'owner', {
      user_permissions: [
        {
          type: 'user',
          user: {
            id: owner._id.toString(),
            username: 'carol',
            email: 'carol@example.com',
            kind: 'permanent',
          },
          permission: 'own',
        },
      ],
    });
  });

  it('should allow a user with "own" permission on a whiteboard to delete the whiteboard', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Delta"});
    const owner = await userCollection.findOne({ username: 'carol' });

    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! owner) || (! whiteboard)) {
      return;
    }

    const whiteboardId = whiteboard._id;
    const targetUrl = `/api/v1/whiteboards/${whiteboardId.toHexString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to delete whiteboard
    await request(app)
      .delete(targetUrl)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(200);

    // Ensure the deletion actually propagated to the database
    expect(await whiteboardCollection.findOne({ _id: whiteboardId })).toBeNull();
  });// -- end test case

  it('should not allow a user with "edit" permission on a whiteboard to delete the whiteboard', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma"});
    const nonOwner = await userCollection.findOne({ username: 'alice' });

    expect(nonOwner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! nonOwner) || (! whiteboard)) {
      return;
    }

    const whiteboardId = whiteboard._id;
    const targetUrl = `/api/v1/whiteboards/${whiteboardId.toHexString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: nonOwner._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to delete whiteboard
    await request(app)
      .delete(targetUrl)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(403);

    // Ensure the deletion didn't propagate to the database
    expect(await whiteboardCollection.findOne({ _id: whiteboardId })).not.toBeNull();
  });// -- end test case

  it('should not allow a user without any permissions on a whiteboard to delete the whiteboard', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma"});
    const nonMember = await userCollection.findOne({ username: 'bob' });

    expect(nonMember).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! nonMember) || (! whiteboard)) {
      return;
    }

    const whiteboardId = whiteboard._id;
    const targetUrl = `/api/v1/whiteboards/${whiteboardId.toHexString()}`;

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: nonMember._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to delete whiteboard
    await request(app)
      .delete(targetUrl)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(403);

    // Ensure the deletion didn't propagate to the database
    expect(await whiteboardCollection.findOne({ _id: whiteboardId })).not.toBeNull();
  });// -- end test case

  it(
    'should transform user-type permissions back into email-type permissions if the referenced user cannot be found in the database',
    async () => {
      const userCollection = mongoose.connection.collection('users');
      const whiteboardCollection = mongoose.connection.collection('whiteboards');

      const ownerName = 'eve';
      const owner = await userCollection.findOne({
        username: ownerName,
      });

      if (! owner) {
        throw new Error(`Could not find owner named "${ownerName}"`);
      }

      const whiteboardName = "Project Theta";
      const whiteboardOrig = await whiteboardCollection.findOne({
        name: whiteboardName,
      }) as IWhiteboard<Types.ObjectId, Types.ObjectId>;

      if (! whiteboardOrig) {
        throw new Error(`Could not find whiteboard "${whiteboardName}"`);
      }

      const deletedUserEmail = 'substitute@example.com';

      // ensure that we start with two user-type permissions
      expect(whiteboardOrig.user_permissions.filter(perm => perm.type === 'user').length)
        .toBe(2);

      // perform GET /whiteboards/:id

      // Generate signed JWT
      const authToken = jwt.sign(
        { sub: owner._id.toHexString() },   // sub = subject claim
        ACCESS_TOKEN_SECRET,
        { expiresIn: 999999999 }
      );

      const resp = await request(app)
        .get(`/api/v1/whiteboards/id/${whiteboardOrig._id.toHexString()}`)
        .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
        .send()
        .expect(200);

      // ensure permissions are set correctly in the response body
      expect(resp.body).toHaveProperty('user_permissions');
      expect(resp.body.user_permissions.length).toBe(2);
      expect(resp.body.user_permissions
        .filter((perm: IWhiteboardUserPermission<Types.ObjectId>) => perm.type === 'email').length)
        .toBe(1);

      // ensure permissions were properly written back to database
      const whiteboardUpdated = await whiteboardCollection.findOne({
        name: whiteboardName,
      }) as IWhiteboard<Types.ObjectId, Types.ObjectId>;

      if (! whiteboardUpdated) {
        throw new Error(`Could not find whiteboard "${whiteboardName}"`);
      }

      expect(whiteboardUpdated).toHaveProperty('user_permissions');
      expect(whiteboardUpdated.user_permissions.length).toBe(2);
      expect(whiteboardUpdated.user_permissions
        .filter((perm: IWhiteboardUserPermission<Types.ObjectId>) => perm.type === 'email').length)
        .toBe(1);
      expect(whiteboardUpdated.user_permissions
        .find((perm: IWhiteboardUserPermission<Types.ObjectId>) => perm.type === 'email'))
        .not.toBeNull();
      expect(whiteboardUpdated.user_permissions
        .find((perm: IWhiteboardUserPermission<Types.ObjectId>) => perm.type === 'email')?.email)
        .toBe(deletedUserEmail);
    }
  );

  it('should authorize conversion of a temporary whiteboard to a permanent whiteboard', async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');
    const userCollection = mongoose.connection.collection('users');

    let tempWhiteboard = await whiteboardCollection.findOne({ name: "Temp Whiteboard 1"});
    let user = await userCollection.findOne({ username: 'alice' });
    
    expect(tempWhiteboard).not.toBeNull();
    expect(user).not.toBeNull();
    
    if ((! tempWhiteboard) || (! user)) {
      return;
    }
    
    expect(tempWhiteboard).toHaveProperty('createdAt');
    expect(tempWhiteboard).not.toHaveProperty('time_created');
    expect(tempWhiteboard.kind).toBe('temp_whiteboard');

    // get the temp user that owns the temp whiteboard
    let tempUser = tempWhiteboard.user_permissions.find((perm: any) => perm.permission === 'own' && perm.type === 'user')?.user;

    const authToken = jwt.sign(
      { sub: tempUser._id.toHexString() },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post(`/api/v1/whiteboards/${tempWhiteboard._id}/auth_convert_temp_to_perm`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        permanentUserEmail: "alice@example.com",
      })
      .expect(201);

    if (! ('signedConversionRequest' in res.body)) {
      throw new Error('Response body missing field "signedConversionRequest"');
    }
    expect(verifySignedTempConversionPayload(res.body.signedConversionRequest))
      .not.toBeNull();
  });

  it('should convert a temporary whiteboard to a permanent whiteboard', async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');
    const userCollection = mongoose.connection.collection('users');

    let tempWhiteboard = await whiteboardCollection.findOne({ name: "Temp Whiteboard 1"});
    let user = await userCollection.findOne({ username: 'alice' });
    
    expect(tempWhiteboard).not.toBeNull();
    expect(user).not.toBeNull();
    
    if ((! tempWhiteboard) || (! user)) {
      return;
    }
    
    expect(tempWhiteboard).toHaveProperty('createdAt');
    expect(tempWhiteboard).not.toHaveProperty('time_created');
    expect(tempWhiteboard.kind).toBe('temp_whiteboard');

    // get the temp user that owns the temp whiteboard
    let tempUser = tempWhiteboard.user_permissions.find((perm: any) => perm.permission === 'own' && perm.type === 'user')?.user;

    const authToken = jwt.sign(
      { sub: user._id.toHexString() },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );
    const signedConversionRequest = createSignedTempConversionPayload({
      permanentUserEmail: 'alice@example.com',
      tempUserId: tempUser._id.toHexString(),
      whiteboardId: tempWhiteboard._id.toHexString(),
    });

    await request(app)
      .post(`/api/v1/whiteboards/${tempWhiteboard._id}/convert_temp_to_perm`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        signedConversionRequest,
      })
      .expect(201);

    const updatedBoard = await whiteboardCollection.findOne({ _id: tempWhiteboard._id });

    expect(updatedBoard).not.toBeNull();

    if (! updatedBoard) {
      return;
    }

    expect(updatedBoard).not.toHaveProperty('createdAt');
    expect(updatedBoard).toHaveProperty('time_created');
    expect(updatedBoard.kind).toBe('permanent_whiteboard');

    let ownerPerm = updatedBoard.user_permissions.find((perm: any) => perm.permission === 'own' && perm.type === 'user');
    
    expect(ownerPerm).not.toBeNull();
    expect(ownerPerm.user.toString()).toBe(user._id.toString());
  });
  
  // Also add check for different user than temp owner trying to convert
  it('should not allow a user that is not the temp owner to convert a temporary whiteboard to a permanent whiteboard', async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');
    const userCollection = mongoose.connection.collection('users');

    let tempWhiteboard = await whiteboardCollection.findOne({ name: "Temp Whiteboard 2"});
    const userA = await userCollection.findOne({ username: 'alice' });
    const userB = await userCollection.findOne({ username: 'bob' });
    
    expect(tempWhiteboard).not.toBeNull();
    expect(userA).not.toBeNull();
    expect(userB).not.toBeNull();
    
    if ((! tempWhiteboard) || (! userA) || (! userB)) {
      return;
    }

    expect(tempWhiteboard).toHaveProperty('createdAt');
    expect(tempWhiteboard).not.toHaveProperty('time_created');
    expect(tempWhiteboard.kind).toBe('temp_whiteboard');

    const authToken = jwt.sign(
      { sub: userB._id.toString() },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );
    const signedConversionRequest = createSignedTempConversionPayload({
      permanentUserEmail: 'bob@example.com',
      tempUserId: userA._id.toHexString(),
      whiteboardId: tempWhiteboard._id.toHexString(),
    });

    await request(app)
      .post(`/api/v1/whiteboards/${tempWhiteboard._id}/convert_temp_to_perm`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({
        signedConversionRequest,
      })
      .expect(403);

    let updatedWhiteboard = await whiteboardCollection.findOne({ _id: tempWhiteboard._id });

    expect(updatedWhiteboard).not.toBeNull();

    if (! updatedWhiteboard) {
      return;
    }

    expect(updatedWhiteboard).toHaveProperty('createdAt');
    expect(updatedWhiteboard).not.toHaveProperty('time_created');
    expect(updatedWhiteboard.kind).toBe('temp_whiteboard');
  });

  it('should allow an unauthed user to open a public whiteboard', async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Public" });

    expect(whiteboard).not.toBeNull();

    if (!whiteboard) {
      return;
    }

    const wbRes = await request(app)
      .get(`/api/v1/whiteboards/id/${whiteboard._id.toString()}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'public', {
      name: "Project Public",
      kind: "permanent_whiteboard",
    });
  });

  it("should allow an authed user to open a public whiteboard that they don't have permissions on", async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');
    const userCollection = mongoose.connection.collection('users');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Public" });
    const alice = await userCollection.findOne({ username: 'alice' });

    expect(whiteboard).not.toBeNull();
    expect(alice).not.toBeNull();

    if (!whiteboard || !alice) {
      return;
    }

    const authToken = jwt.sign(
      { sub: alice._id.toString() },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );

    const wbRes = await request(app)
      .get(`/api/v1/whiteboards/id/${whiteboard._id.toString()}`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(200);

    validateWhiteboardAttribView(wbRes.body, 'public', {
      name: "Project Public",
      kind: "permanent_whiteboard",
    });
  });

  it('should not allow an unauthed user to open a private whiteboard', async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Alpha" });

    expect(whiteboard).not.toBeNull();

    if (!whiteboard) {
      return;
    }

    await request(app)
      .get(`/api/v1/whiteboards/id/${whiteboard._id.toString()}`)
      .send()
      .expect(403);
  });

  it("should not allow an authed user without permissions to open a private whiteboard", async () => {
    const whiteboardCollection = mongoose.connection.collection('whiteboards');
    const userCollection = mongoose.connection.collection('users');

    // Project Beta is owned by Bob; alice has no permissions on it
    const whiteboard = await whiteboardCollection.findOne({ name: "Project Beta" });
    const alice = await userCollection.findOne({ username: 'alice' });

    expect(whiteboard).not.toBeNull();
    expect(alice).not.toBeNull();

    if (!whiteboard || !alice) {
      return;
    }

    const authToken = jwt.sign(
      { sub: alice._id.toString() },
      ACCESS_TOKEN_SECRET!,
      { expiresIn: '1h' }
    );

    await request(app)
      .get(`/api/v1/whiteboards/id/${whiteboard._id.toString()}`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send()
      .expect(403);
  });

  it('should allow a user with "own" permission to update a whiteboard thumbnail', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma" });
    const owner = await userCollection.findOne({ username: 'carol' });

    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! owner) || (! whiteboard)) {
      return;
    }

    const thumbnailUrl = 'data:image/jpeg;base64,b3duZXI=';

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Update thumbnail
    const wbRes = await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl })
      .expect(200);

    expect(wbRes.body.thumbnail_url).toBe(thumbnailUrl);

    // Ensure the update propagated to the database
    const whiteboardUpdated = await whiteboardCollection.findOne({ _id: whiteboard._id });
    expect(whiteboardUpdated?.thumbnail_url).toBe(thumbnailUrl);
  });// -- end test case

  it('should allow a user with explicit "edit" permission to update a whiteboard thumbnail', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma" });
    const editor = await userCollection.findOne({ username: 'alice' });

    expect(editor).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! editor) || (! whiteboard)) {
      return;
    }

    const thumbnailUrl = 'data:image/jpeg;base64,ZWRpdG9y';

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: editor._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Update thumbnail
    const wbRes = await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl })
      .expect(200);

    expect(wbRes.body.thumbnail_url).toBe(thumbnailUrl);
  });// -- end test case

  it('should not allow a user without permissions to update a whiteboard thumbnail', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    // Project Gamma is owned by Carol with Alice as editor; Bob has no permissions
    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma" });
    const nonMember = await userCollection.findOne({ username: 'bob' });

    expect(nonMember).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! nonMember) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: nonMember._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to update thumbnail
    await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl: 'data:image/jpeg;base64,YXR0YWNrZXI=' })
      .expect(403);

    // Ensure the thumbnail was not changed in the database
    const whiteboardUpdated = await whiteboardCollection.findOne({ _id: whiteboard._id });
    expect(whiteboardUpdated?.thumbnail_url).not.toBe('data:image/jpeg;base64,YXR0YWNrZXI=');
  });// -- end test case

  it('should not allow a user without explicit permissions to update the thumbnail of a public whiteboard', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    // Project Public is owned by Bob; Alice has no explicit permissions on it
    const whiteboard = await whiteboardCollection.findOne({ name: "Project Public" });
    const nonMember = await userCollection.findOne({ username: 'alice' });

    expect(nonMember).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! nonMember) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: nonMember._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to update thumbnail
    await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl: 'data:image/jpeg;base64,YXR0YWNrZXI=' })
      .expect(403);

    // Ensure the thumbnail was not changed in the database
    const whiteboardUpdated = await whiteboardCollection.findOne({ _id: whiteboard._id });
    expect(whiteboardUpdated?.thumbnail_url).not.toBe('data:image/jpeg;base64,YXR0YWNrZXI=');
  });// -- end test case

  it('should not allow a user with "view" permission to update a whiteboard thumbnail', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    // Project Eta is owned by Eve with Frank as viewer
    const whiteboard = await whiteboardCollection.findOne({ name: "Project Eta" });
    const viewer = await userCollection.findOne({ username: 'frank' });

    expect(viewer).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! viewer) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: viewer._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to update thumbnail
    await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl: 'data:image/jpeg;base64,dmlld2Vy' })
      .expect(403);
  });// -- end test case

  it('should reject a thumbnail update without a thumbnailUrl', async () => {
    const userCollection = mongoose.connection.collection('users');
    const whiteboardCollection = mongoose.connection.collection('whiteboards');

    const whiteboard = await whiteboardCollection.findOne({ name: "Project Gamma" });
    const owner = await userCollection.findOne({ username: 'carol' });

    expect(owner).not.toBeNull();
    expect(whiteboard).not.toBeNull();

    // to please TypeScript
    if ((! owner) || (! whiteboard)) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to update thumbnail with no thumbnailUrl
    await request(app)
      .put(`/api/v1/whiteboards/${whiteboard._id.toString()}/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({})
      .expect(400);
  });// -- end test case

  it('should reject a thumbnail update for a malformed whiteboard id', async () => {
    const userCollection = mongoose.connection.collection('users');

    const owner = await userCollection.findOne({ username: 'carol' });

    expect(owner).not.toBeNull();

    // to please TypeScript
    if (! owner) {
      return;
    }

    // Generate signed JWT
    const authToken = jwt.sign(
      { sub: owner._id.toString() },   // sub = subject claim
      ACCESS_TOKEN_SECRET,
      { expiresIn: 999999999 }
    );

    // -- Try to update thumbnail on a malformed whiteboard id
    await request(app)
      .put(`/api/v1/whiteboards/zzzzzzz/thumbnail`)
      .set("Cookie", `${ACCESS_TOKEN_COOKIE_ID}=${authToken}`)
      .send({ thumbnailUrl: 'data:image/jpeg;base64,dGVzdA==' })
      .expect(400);
  });// -- end test case
});

