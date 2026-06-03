import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import {
  type UserIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

type SliceState = Record<CanvasIdType, Record<UserIdType, unknown>>;

const initialState : SliceState = {};

const allowedUsersByCanvasSlice = createSlice({
  name: 'allowedUsersByCanvas',
  initialState,
  reducers: {
    setAllowedUsersByCanvas(state, action: PayloadAction<Record<CanvasIdType, UserIdType[]>>) {
      for (const [canvasId, userIds] of Object.entries(action.payload)) {
        state[canvasId] = Object.fromEntries(userIds.map((userId) => [userId, true]));
      }// -- end for

      return state;
    },
    addAllowedUsersByCanvas(state, action: PayloadAction<Record<CanvasIdType, UserIdType[]>>) {
      for (const [canvasId, userIds] of Object.entries(action.payload)) {
        for (const userId of userIds) {
          state[canvasId][userId] = true;
        }// -- end for userId
      }// -- end for

      return state;
    },
    removeAllowedUsersByCanvas(state, action: PayloadAction<CanvasIdType[]>) {
      for (const canvasId of action.payload) {
        delete state[canvasId];
      }// -- end for canvasId

      return state;
    }
  },
  selectors: {
    // Entire state is mapping of object ids to objects
    // Objects redundantly store their ids
    selectAllowedUsersByCanvas: (state, canvasId: CanvasIdType) => state[canvasId]
  }
});

export const {
  setAllowedUsersByCanvas,
  addAllowedUsersByCanvas,
  removeAllowedUsersByCanvas
} = allowedUsersByCanvasSlice.actions;

export type AllowedUsersByCanvasActions =
  | ReturnType<typeof setAllowedUsersByCanvas>
  | ReturnType<typeof addAllowedUsersByCanvas>
  | ReturnType<typeof removeAllowedUsersByCanvas>
;

export const {
  selectAllowedUsersByCanvas
} = allowedUsersByCanvasSlice.selectors;

export default allowedUsersByCanvasSlice.reducer;
