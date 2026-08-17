import {
  Router,
} from "express";

// --- local imports
import {
  authenticateJWT,
} from '../middleware/auth';

import {
  handleGetAllNotifications,
  handleGetNotification,
  handleDeleteNotification,
} from '../controllers/notifications';

const router = Router();

// -- all routes authenticated
router.use(authenticateJWT);

// -- Get all notifications
router.get('/', handleGetAllNotifications);

// -- Get one notification
router.get('/id/:notificationId', handleGetNotification);

// -- Delete a notification
router.delete('/', handleDeleteNotification);

export default router;
