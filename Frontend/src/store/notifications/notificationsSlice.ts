import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

// -- local imports
import {
  type NotificationIdType,
  type Notification,
} from '@/types/Notification';

const initialState : Record<NotificationIdType, Notification> = {};

const notificationsSlice = createSlice({
  name: 'notifications',
  // Will store data in a <whiteboard_id, canvas_id, object_id> => CanvasObjectModel format
  initialState,
  reducers: {
    setNotifications(state, action: PayloadAction<Record<NotificationIdType, Notification>>) {
      for (const [notifId, notif] of Object.entries(action.payload)) {
        state[notifId] = notif;
      }// -- end for notifId, notif

      return state;
    },
    patchNotifications(
      state,
      action: PayloadAction<Record<NotificationIdType, Partial<Notification>>>
    ) {
      for (const [notifId, notifPatch] of Object.entries(action.payload)) {
        if (notifId in state) {
          state[notifId] = {
            ...state[notifId],
            ...notifPatch
          };
        }
      }// -- end for notifId, notif

      return state;
    },
    removeNotifications(state, action: PayloadAction<NotificationIdType[]>) {
      for (const notifId of action.payload) {
        delete state[notifId];
      }// -- end for notifId

      return state;
    }
  },
});

export const {
  setNotifications,
  patchNotifications,
  removeNotifications,
} = notificationsSlice.actions;

export type NotificationsActions =
  | ReturnType<typeof setNotifications>
  | ReturnType<typeof patchNotifications>
  | ReturnType<typeof removeNotifications>
;

export default notificationsSlice.reducer;
