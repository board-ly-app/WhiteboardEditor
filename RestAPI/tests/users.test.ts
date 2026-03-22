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
  // TODO: Update for permanent user kind
  it("should create a new user", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .send({
        username: "tester_beta",
        email: "tester_beta@example.com",
        password: "password123"
      })
      .expect(201);

    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).not.toHaveProperty("_id");
    expect(res.body.user).toHaveProperty("username");
    expect(res.body.user.username).toBe("tester_beta");
    expect(res.body.user.email).toBe("tester_beta@example.com");
    // sensitive field; should not be exposed
    expect(res.body.user).not.toHaveProperty("passwordHashed");

    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
  });

  // Attempt unauthenticated /api/v*/users/me call, which should be forbidden
  it("should not allow an unauthenticated user to view GET /users/me", async () => {
    await request(app)
      .get("/api/v1/users/me")
      .expect(401);
  });

  // Create a new temp user
  it("should create a new temp user", async () => {
    const expirationSecs = process.env.TEMP_USER_EXPIRATION_SECS;
    expect(expirationSecs).not.toBe(undefined);
    
    const res = await request(app)
      .post("/api/v1/users/temp")
      .send()
      .expect(201);
    
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.username).toBe(`TempUser${res.body.user.id}`);
    expect(res.body.user).toHaveProperty("createdAt");
  });
});
