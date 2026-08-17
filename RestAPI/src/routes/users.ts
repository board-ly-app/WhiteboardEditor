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

// -- The following routes are free from signup-specific rate limiting

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

// -- Apply signup-specific limiting for routes below
router.use(signupRateLimiter);

router.post("/", handleCreateUser);
router.post("/confirm_account_creation", handleConfirmUser);

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
router.post("/convert_temp", handleConvertTempUser);

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

export default router;
