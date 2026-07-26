// === /api/v*/health ==========================================================
//
// Minimal endpoint meant to show to outside processes that the rest api service
// is functioning.
//
// =============================================================================
import request from "supertest";
import mongoose from 'mongoose';

import app from "../src/app";

const MONGO_URI = 'mongodb://test_db:27017/testdb';

if (! MONGO_URI) {
  console.error('ERROR: unset env var MONGO_URI');
  process.exit(1);
}

// handle database connection
const connectToDatabase = async () => {
  await mongoose.connect(MONGO_URI)
};

const disconnectFromDatabase = async () => {
  await mongoose.disconnect();
};

beforeAll(connectToDatabase);

afterAll(disconnectFromDatabase);

// --- ensure the health check works
describe("Health Check API", () => {
  it("should receive 200 (ok)", async () => {
    await request(app)
      .get("/api/v1/health")
      .expect(200);
  });
});
