// === notificationService.ts ==================================================
//
// Manages user notifications.
//
// =============================================================================

import {
  Types,
} from 'mongoose';

import {
  type NotificationIdType,
  type INotification,
  Notification,
} from '../models/Notification';

import {
  type UserIdType,
} from '../models/User';

export type GetAllNotificationsRes =
  | { status: 'ok'; notifications: INotification <Types.ObjectId>[]; }
  | { status: 'database_error'; err: unknown; }
;

export const getAllNotifications = async (
  userId: UserIdType,
): Promise<GetAllNotificationsRes> => {
  try {
    const fetchRes = await Notification.find({
      'recipient': {
        '$eq': userId,
      },
    });

    return {
      status: 'ok',
      notifications: fetchRes,
    };
  } catch (err: unknown) {
    return {
      status: 'database_error',
      err,
    };
  }
};// -- end getAllNotifications

export type GetNotificationRes =
  | { status: 'ok'; notification: INotification <Types.ObjectId>; }
  | { status: 'not_found'; }
  | { status: 'database_error'; err: unknown; }
;

export const getNotification = async (
  notifId: NotificationIdType,
  userId: UserIdType,
): Promise<GetNotificationRes> => {
  try {
    const resp = await Notification.findOne({
      '_id': {
        '$eq': notifId,
      },
      'recipient': {
        '$eq': userId,
      },
    });

    if (! resp) {
      return { status: 'not_found' };
    } else {
      return {
        status: 'ok',
        notification: resp,
      };
    }
  } catch (err: unknown) {
    return {
      status: 'database_error',
      err,
    };
  }
};// -- end getNotification

export type DeleteNotificationRes =
  | { status: 'ok'; }
  | { status: 'unacknowledged'; }
  | { status: 'not_found'; }
  | { status: 'database_error'; err: unknown; }
;// -- end DeleteNotificationRes

export const deleteNotification = async (
  notifId: NotificationIdType,
  userId: UserIdType,
): Promise<DeleteNotificationRes> => {
  try {
    const deleteRes = await Notification.deleteOne({
      '_id': {
        '$eq': notifId,
      },
      'recipient': {
        '$eq': userId,
      },
    });

    if (! deleteRes.acknowledged) {
      return { status: 'unacknowledged' };
    } else if (deleteRes.deletedCount < 1) {
      return { status: 'not_found' };
    } else {
      return { status: 'ok' };
    }
  } catch (err: unknown) {
    return {
      status: 'database_error',
      err,
    };
  }
};// -- end deleteNotification
