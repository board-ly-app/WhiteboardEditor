import request from "supertest";
import app from "../src/app";
import {
  type IWhiteboard,
} from '../src/models/Whiteboard';
import mongoose, {
  Types,
} from 'mongoose';
import jwt from "jsonwebtoken";

const MONGO_URI = 'mongodb://test_db:27017/testdb';

const {
  JWT_SECRET,
} = process.env;

if (! JWT_SECRET) {
  throw new Error('JWT_SECRET not defined in process environment');
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

describe("Users API", () => {
  // Permanent User Tests
  it("should create a new permanent user", async () => {
    const userData = {
      username: "tester_beta",
      email: "tester_beta@example.com",
      password: "password123"
    };

    const res = await request(app)
      .post("/api/v1/users")
      .send(userData)
      .expect(201);

    // Verify discriminator type
    expect(res.body.user.kind).toBe("permanent");
    
    // Verify common fields
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.username).toBe(userData.username);
    
    // Verify permanent-specific fields
    expect(res.body.user.email).toBe(userData.email);
    
    // Security check: Ensure internal fields are stripped
    expect(res.body.user).not.toHaveProperty("_id");
    expect(res.body.user).not.toHaveProperty("passwordHashed");

    // Verify Auth token is returned
    expect(res.body).toHaveProperty("token");
  });

  // Temp User Tests
  it("should create a new temp user", async () => {
    const expirationSecs = process.env.TEMP_USER_EXPIRATION_SECS;
    expect(expirationSecs).not.toBe(undefined);
    
    const res = await request(app)
      .post("/api/v1/users/temp")
      .send()
      .expect(201);

    // Verify discriminator type
    expect(res.body.user.kind).toBe("temp");
    
    // Verify common and temp-specific fields
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.username).toBe(`TempUser${res.body.user.id}`);
    expect(res.body.user).toHaveProperty("createdAt");

    // Temp users shouldn't have
    expect(res.body.user).not.toHaveProperty("email");
  });

  // Attempt unauthenticated /api/v*/users/me call, which should be forbidden
  it("should not allow an unauthenticated user to view GET /users/me", async () => {
    await request(app)
      .get("/api/v1/users/me")
      .expect(401);
  });

  // Update whiteboard permissions when a user's email is changed by a PATCH
  // request
  it(
    "should update the email address in a user's whiteboard permissions if their email address is updated by a PATCH request",
    async () => {
      const userCollection = mongoose.connection.collection('users');
      const whiteboardCollection = mongoose.connection.collection('whiteboards');

      const username = 'frank';
      const user = await userCollection.findOne({
        username,
      });

      // to please TypeScript
      if (! user) {
        throw new Error('Expected to fetch test user');
      }

      const whiteboardsOrigCursor = whiteboardCollection.find({
        'user_permissions.user': user._id
      });

      if (! whiteboardsOrigCursor) {
        throw new Error('No (unpatched) whiteboards could be fetched from database');
      }

      const whiteboardsOrig = await whiteboardsOrigCursor.toArray();

      if (whiteboardsOrig.length < 1) {
        throw new Error('No (unpatched) whiteboards were fetched from database');
      }

      // Generate signed JWT
      const authToken = jwt.sign(
        { sub: user._id.toHexString() },   // sub = subject claim
        JWT_SECRET,
        { expiresIn: 999999999 }
      );

      const targetUrl = `/api/v1/users/me`;
      const newEmail = "newfrank@example.edu";
      const patchData = {
        password: "weakpassword",
        email: newEmail,
      };

      // -- Perform patch
      const resp = await request(app)
        .patch(targetUrl)
        .set("Authorization", `Bearer ${authToken}`)
        .send(patchData)
        .expect(201);

      expect(resp.body).toHaveProperty('email');
      expect(resp.body.email).toBe(newEmail);

      // Ensure user was properly updated by patch
      const userPatched = await userCollection.findOne({
        username,
      });
      expect(userPatched).not.toBeNull();
      // to please TypeScript
      if (! userPatched) {
        throw new Error('Patched user expected to have email');
      }
      expect(userPatched.email).toBe(newEmail);

      // Ensure all the user's whiteboard permissions have had their permissions
      // updated
      const whiteboardsPatchedCursor = whiteboardCollection.find({
        'user_permissions.user': user._id
      });

      if (! whiteboardsPatchedCursor) {
        throw new Error('No (patched) whiteboards fetched from database');
      }

      const whiteboardsPatched = await whiteboardsPatchedCursor.toArray() as IWhiteboard<Types.ObjectId, Types.ObjectId>[];

      if (whiteboardsPatched.length < 1) {
        throw new Error('No (patched) whiteboards were fetched from database');
      }

      console.log('!! WHITEBOARDS ORIG:', JSON.stringify(whiteboardsOrig, null, 2));// TODO: remove debug
      console.log('!! WHITEBOARDS PATCHED:', JSON.stringify(whiteboardsPatched, null, 2));// TODO: remove debug
      expect(whiteboardsPatched.length).toBe(whiteboardsOrig.length);

      for (const whiteboard of whiteboardsPatched) {
        const userPerm = whiteboard.user_permissions.find(perm => perm.type === 'user' && perm.user.equals(user._id));

        if (! userPerm) {
          throw new Error(
            `Could not find user permission for user ${user._id} on whiteboard ${whiteboard._id}`
          );
        }

        expect(userPerm.email).toBe(newEmail);
      }// -- end for whiteboard
    }
  );
});
