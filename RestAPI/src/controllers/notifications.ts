// === controllers/notifications.ts ============================================
//
// =============================================================================

import {
  type Request,
  type Response,
} from 'express';

import {
  Types,
} from 'mongoose';

import {
  type AuthorizedRequestBody,
} from '../models/Auth';

import {
  getAllNotifications,
  getNotification,
  deleteNotification,
} from '../services/notificationService';

export const handleGetAllNotifications = async (
  req: Request<{}, any, AuthorizedRequestBody>,
  res: Response,
) => {
  const {
    authUser,
  } = req.body;
  const {
    id: authUserId,
  } = authUser;

  const resp = await getAllNotifications(authUserId);

  switch (resp.status) {
    case 'database_error':
      return res.status(500).json({
        message: 'An unexpected error occurred',
      });
    case 'ok':
      const {
        notifications,
      } = resp;

      return res.status(200).json({
        notifications: notifications.map(notif => notif.toPublicView()),
      });
  }// -- end switch (resp.status)
};// -- end handleGetAllNotifications

export const handleGetNotification = async (
  req: Request<{ notificationId: string; }, any, AuthorizedRequestBody>,
  res: Response,
) => {
  const {
    authUser,
  } = req.body;
  const {
    id: authUserId,
  } = authUser;
  const {
    notificationId: notificationIdStr,
  } = req.params;

  if (! Types.ObjectId.isValid(notificationIdStr)) {
    return res.status(400).json({
      message: `Invalid notification id: ${notificationIdStr}`,
    });
  }

  const notificationId = new Types.ObjectId(notificationIdStr);

  const resp = await getNotification(notificationId, authUserId);

  switch (resp.status) {
    case 'database_error':
      return res.status(500).json({
        message: 'An unexpected error occurred',
      });
    case 'not_found':
      return res.status(404).json({
        message: `Notification ${notificationId} not found`,
      });
    case 'ok':
      const {
        notification,
      } = resp;

      await notification.populateFull();

      return res.status(200).json({
        notification: notification.toPublicView(),
      });
  }// -- end switch (resp.status)
};// -- end handleGetNotification

export const handleDeleteNotification = async (
  req: Request<{}, any, AuthorizedRequestBody & { notificationId: string; }>,
  res: Response,
) => {
  const {
    authUser,
    notificationId: notificationIdStr,
  } = req.body;
  const {
    id: authUserId,
  } = authUser;

  if (! Types.ObjectId.isValid(notificationIdStr)) {
    return res.status(400).json({
      message: `Invalid notification id: ${notificationIdStr}`,
    });
  }

  const notificationId = new Types.ObjectId(notificationIdStr);

  const resp = await deleteNotification(notificationId, authUserId);

  switch (resp.status) {
    case 'database_error':
    case 'unacknowledged':
      return res.status(500).json({
        message: 'An unexpected error occurred',
      });
    case 'not_found':
      return res.status(404).json({
        message: `Notification ${notificationId} not found`,
      });
    case 'ok':
      return res.status(200);
  }// -- end switch (resp.status)
};// -- end handleDeleteNotification
