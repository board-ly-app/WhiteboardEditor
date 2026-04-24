import request from "supertest";
import app from "../src/app";
import mongoose from 'mongoose';

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
});
