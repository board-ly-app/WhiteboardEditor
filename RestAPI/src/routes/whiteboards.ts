import {
  Router,
} from "express";

// --- local imports
import {
  authenticateJWT,
  authenticateJWTOptional
} from '../middleware/auth';

import {
  globalRateLimiter,
} from '../middleware/rateLimit';

import {
  handleGetOwnWhiteboards,
  handleGetWhiteboardById,
  handleCreateWhiteboard,
  handleDeleteWhiteboard,
  handleShareWhiteboard,
  handlePutThumbnail,
  handleCreateTempWhiteboard,
  handleConvertTempToPerm,
  handleChangeWhiteboardName,
} from "../controllers/whiteboards";

const router = Router();

// -- apply rate limiting
router.use(globalRateLimiter);

// -- Get whiteboard by id
router.get('/id/:whiteboardId', authenticateJWTOptional, handleGetWhiteboardById);

// -- all routes authenticated
router.use(authenticateJWT);

// -- Create a new permanent whiteboard
router.post("/", handleCreateWhiteboard);

// -- Create a new temp whiteboard
router.post("/temp", handleCreateTempWhiteboard);

// -- Get user's own whiteboards
router.get("/own", handleGetOwnWhiteboards);

// -- Convert a temp whiteboard to a permanent one
router.post('/:whiteboardId/convert_temp_to_perm', handleConvertTempToPerm);

// -- Rename a whiteboard
router.put('/:whiteboardId/newName', handleChangeWhiteboardName);

// -- Delete a whiteboard identified by its ID
router.delete('/:whiteboardId', handleDeleteWhiteboard);

// -- Share whiteboard with other users
router.post("/:id/user_permissions", handleShareWhiteboard);

// -- Put thumbnail screenshot to database
router.put("/:whiteboardId/thumbnail", handlePutThumbnail);

export default router;

