// === Notification.ts =========================================================
//
// Extends the Notification type defined in the web socket protocol to include
// all state that encompasses a notification, including the read status.
//
// =============================================================================

import {
  type NotificationIdType as NotificationIdTypeBase,
  type Notification as NotificationBase,
  type NotificationRequestCanvasEditPermission as NotificationRequestCanvasEditPermissionBase,
} from '@/types/WebSocketProtocol';

// -- Re-export NotificationIdType
export type NotificationIdType = NotificationIdTypeBase;

// -- Re-exports
export type NotificationRequestCanvasEditPermission = NotificationRequestCanvasEditPermissionBase;

export interface Notification extends NotificationBase {
  isRead: boolean;
}
