import {
  Router,
} from "express";
import rateLimit from "express-rate-limit";

// --- local imports
import {
  authenticateJWT,
  authenticateJWTOptional
} from '../middleware/auth';

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

const convertTempToPermLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 convert requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

const changeWhiteboardNameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 rename requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// -- Get user's own whiteboards
router.get("/own", authenticateJWT, handleGetOwnWhiteboards);

// -- Get whiteboard by id
router.get('/:whiteboardId', authenticateJWTOptional, handleGetWhiteboardById);

// -- all routes authenticated
router.use(authenticateJWT);

// -- Create a new permanent whiteboard
router.post("/", handleCreateWhiteboard);

// -- Create a new temp whiteboard
router.post("/temp", handleCreateTempWhiteboard);

// -- Convert a temp whiteboard to a permanent one
router.post('/:whiteboardId/convert_temp_to_perm', convertTempToPermLimiter, handleConvertTempToPerm);

// -- Rename a whiteboard
router.put('/:whiteboardId/newName', changeWhiteboardNameLimiter, handleChangeWhiteboardName);

// -- Delete a whiteboard identified by its ID
router.delete('/:whiteboardId', handleDeleteWhiteboard);

// -- Share whiteboard with other users
router.post("/:id/user_permissions", handleShareWhiteboard);

// -- Put thumbnail screenshot to database
router.put("/:whiteboardId/thumbnail", handlePutThumbnail);

export default router;

