// === Notification.ts =========================================================
//
// Extends the Notification type defined in the web socket protocol to include
// all state that encompasses a notification, including the read status.
//
// =============================================================================

import {
  type NotificationIdType as NotificationIdTypeBase,
  type Notification as NotificationBase,
} from '@/types/WebSocketProtocol';

// -- Re-export NotificationIdType
export type NotificationIdType = NotificationIdTypeBase;

export interface Notification extends NotificationBase {
  isRead: boolean;
}
