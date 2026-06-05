import {
  type AppDispatch,
} from '@/store';

import {
  type NotificationIdType,
  type Notification,
} from '@/types/Notification';

import {
  setNotifications as setNotificationsReducer,
  patchNotifications as patchNotificationsReducer,
} from '@/store/notifications/notificationsSlice';

export const setNotifications = (
  dispatch: AppDispatch,
  notifications: Record<NotificationIdType, Notification>
) => {
  dispatch(setNotificationsReducer(notifications));
};// -- end setNotifications

export const setNotificationsRead = (
  dispatch: AppDispatch,
  notificationIds: NotificationIdType[]
) => {
  const update = Object.fromEntries(notificationIds.map(
    notifId => [notifId, { isRead: true }]
  ));

  dispatch(patchNotificationsReducer(update));
};// -- end setNotificationsRead
