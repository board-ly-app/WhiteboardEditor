import {
  type RootState,
} from '@/store';

import {
  type NotificationIdType,
  type Notification,
} from '@/types/Notification';

export const selectNotifications = (
  state: RootState,
): Record<NotificationIdType, Notification> => {
  // -- just return entire state verbatim
  return state.notifications;
};// -- end selectNotifications

export const selectNotificationById = (
  state: RootState,
  notifId: NotificationIdType,
): Notification | undefined => {
  return state.notifications[notifId];
};// -- end selectNotificationById
