import {
  Router,
} from "express";

// --- local imports
import {
  authenticateJWT
} from '../middleware/auth';

import {
  handleGetOwnWhiteboards,
  handleGetWhiteboardById,
  handleCreateWhiteboard,
  handleDeleteWhiteboard,
  handleShareWhiteboard,
  handlePutThumbnail,
  handleCreateTempWhiteboard,
} from "../controllers/whiteboards";

const router = Router();

// -- all routes authenticated
router.use(authenticateJWT);

// -- Create a new permanent whiteboard
router.post("/", handleCreateWhiteboard);

// -- Create a new temp whiteboard
router.post("/temp", handleCreateTempWhiteboard);

// -- Get user's own whiteboards
router.get("/own", handleGetOwnWhiteboards);

// -- Get whiteboard by id
router.get('/:whiteboardId', handleGetWhiteboardById);

// -- Delete a whiteboard identified by its ID
router.delete('/:whiteboardId', handleDeleteWhiteboard);

// -- Share whiteboard with other users
router.post("/:id/user_permissions", handleShareWhiteboard);

// -- Put thumbnail screenshot to database
router.put("/:whiteboardId/thumbnail", handlePutThumbnail);

export default router;

