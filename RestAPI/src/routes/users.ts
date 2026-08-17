// -- std imports
import {
  Router,
} from "express";

// -- local imports
import {
  handleGetUserById,
  handleCreateUser,
  handleConfirmUser,
  handlePatchOwnUser,
  handleDeleteOwnUser,
  handleGetSharedWhiteboardsByUser,
  handleCreateTempUser,
  handleConvertTempUser,
} from "../controllers/users";

import {
  authenticateJWT,
} from '../middleware/auth';

import {
  signupRateLimiter,
} from '../middleware/rateLimit';

const router = Router();

const rateLimitedPipeline = [signupRateLimiter];
const authedPipeline = [authenticateJWT];
const authedRateLimitedPipeline = [signupRateLimiter, authenticateJWT];

// -- Apply signup-specific limiting for routes below

router.post("/", rateLimitedPipeline, handleCreateUser);
router.post("/confirm_account_creation", rateLimitedPipeline, handleConfirmUser);

// === POST /users/temp ========================================================
//
// Create a temporary user account for trial whiteboard use.
//
// =============================================================================
router.post("/temp", rateLimitedPipeline, handleCreateTempUser);

// --- Routes below are authenticated

// === POST /users/convert_temp ================================================
//
// Converts a temporary user account to a permanent one.
//
// =============================================================================
router.post("/convert_temp", authedRateLimitedPipeline, handleConvertTempUser);

// === GET /users/:userId ======================================================
//
// Fetch the authenticated user's data.
//
// =============================================================================
router.get("/:userId", authedRateLimitedPipeline, handleGetUserById);

// === PATCH /users/me =========================================================
//
// Update one or more fields in the authenticated user's data.
//
// =============================================================================
router.patch("/me", authedRateLimitedPipeline, handlePatchOwnUser);

// === DELETE /users/me ========================================================
//
// Deletes the user's own account.
// 
// =============================================================================
router.delete('/me', authedRateLimitedPipeline, handleDeleteOwnUser);

// -- The following routes are exempt from signup-specific rate limiting

// === GET /users/:userId:/shared_whiteboards ==================================
//
// Get summaries (attribute views) of all whiteboards shared with a given user.
// If passed "me" as the userId, fetches for the authenticated user.
// By default, spans all permissions.
//
// TODO: implement queries to filter by permission type.
//
// =============================================================================
router.get('/:userId/shared_whiteboards', authedPipeline, handleGetSharedWhiteboardsByUser);

export default router;
