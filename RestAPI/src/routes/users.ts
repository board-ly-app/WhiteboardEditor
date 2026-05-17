// -- std imports
import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";

// -- local imports
import {
  handleGetUserById,
  handleCreateUser,
  handlePatchOwnUser,
  handleDeleteOwnUser,
  handleGetSharedWhiteboardsByUser,
  handleCreateTempUser,
  handleConvertTempUser,
} from "../controllers/users";

import {
  authenticateJWT
} from '../middleware/auth';

import type {
  CreatePermanentUserRequest,
} from "../models/User";

const router = Router();

const convertTempRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit convert attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/", async (
  req: Request<{}, {}, CreatePermanentUserRequest>,
  res: Response
) => {
    await handleCreateUser(req, res);
});

// === POST /users/temp ========================================================
//
// Create a temporary user account for trial whiteboard use.
//
// =============================================================================
router.post("/temp", handleCreateTempUser);

// --- Routes below are authenticated
router.use(authenticateJWT);

// === POST /users/convert_temp ================================================
//
// Converts a temporary user account to a permanent one.
//
// =============================================================================
router.post("/convert_temp", convertTempRateLimiter, handleConvertTempUser);

// === GET /users/:userId ======================================================
//
// Fetch the authenticated user's data.
//
// =============================================================================
router.get("/:userId", handleGetUserById);

// === PATCH /users/me =========================================================
//
// Update one or more fields in the authenticated user's data.
//
// =============================================================================
router.patch("/me", handlePatchOwnUser);

// === DELETE /users/me ========================================================
//
// Deletes the user's own account.
// 
// =============================================================================
router.delete('/me', handleDeleteOwnUser);

// === GET /users/:userId:/shared_whiteboards ==================================
//
// Get summaries (attribute views) of all whiteboards shared with a given user.
// If passed "me" as the userId, fetches for the authenticated user.
// By default, spans all permissions.
//
// TODO: implement queries to filter by permission type.
//
// =============================================================================
router.get('/:userId/shared_whiteboards', handleGetSharedWhiteboardsByUser);

export default router;
