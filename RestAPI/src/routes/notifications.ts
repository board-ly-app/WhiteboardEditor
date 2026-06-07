import {
  Router,
} from "express";

import rateLimit from "express-rate-limit";

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

// -- rate limiters
const getMethodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteMethodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// -- all routes authenticated
router.use(authenticateJWT);

// -- Get all notifications
router.get('/', getMethodLimiter, handleGetAllNotifications);

// -- Get one notification
router.get('/id/:notificationId', getMethodLimiter, handleGetNotification);

// -- Delete a notification
router.delete('/', deleteMethodLimiter, handleDeleteNotification);

export default router;
