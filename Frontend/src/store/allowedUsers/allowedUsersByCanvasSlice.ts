import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import {
  type UserIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

const allowedUsersByCanvasSlice = createSlice({
  name: 'allowedUsersByCanvas',
  initialState: {} as Record<CanvasIdType, UserIdType[]>,
  reducers: {
    setAllowedUsersByCanvas(state, action: PayloadAction<Record<CanvasIdType, UserIdType[]>>) {
      return {
        ...state,
        ...action.payload
      };
    },
    addAllowedUsersByCanvas(state, action: PayloadAction<Record<CanvasIdType, UserIdType[]>>) {
      const out = { ...state };

      Object.entries(action.payload).forEach(([id, users]) => {
        if (id in state) {
          out[id] = [...state[id], ...users];
        } else {
          out[id] = users;
        }
      });

      return out;
    },
    removeAllowedUsersByCanvas(state, action: PayloadAction<CanvasIdType[]>) {
      const out = { ...state };

      for (const id of action.payload) {
        delete out[id];
      }

      return out;
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
