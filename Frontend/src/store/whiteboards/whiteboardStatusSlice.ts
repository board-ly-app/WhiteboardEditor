// === whiteboardStatusSlice.ts ================================================
//
// Tracks whether a given whiteboard in the whiteboards slice is currently
// active, in the process of being deleted, or already deleted.
//
// =============================================================================

// -- std imports
import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

export type WhiteboardStatusEnum = 
  | 'active'
  | 'deleting'
  | 'deleted'
;

export interface WhiteboardStatusState {
  statusesByWhiteboard: Record<WhiteboardIdType, WhiteboardStatusEnum>;
}// -- end interface WhiteboardStatusState

const whiteboardStatusSlice = createSlice({
  name: 'whiteboardStatus',
  initialState: {
    statusesByWhiteboard: {},
  } as WhiteboardStatusState,
  reducers: {
    setWhiteboardStatuses(state, action: PayloadAction<Record<WhiteboardIdType, WhiteboardStatusEnum>>) {
      return {
        statusesByWhiteboard: {
          ...state.statusesByWhiteboard,
          ...action.payload
        },
      };
    },
    removeWhiteboardStatuses(state, action: PayloadAction<WhiteboardIdType[]>) {
      const {
        statusesByWhiteboard,
      } = state;

      for (const wid of action.payload) {
        delete statusesByWhiteboard[wid];
      }// -- end for wid

      return state;
    },
  },
});// -- end whiteboardStatusSlice

export const {
  setWhiteboardStatuses,
  removeWhiteboardStatuses,
} = whiteboardStatusSlice.actions;

export default whiteboardStatusSlice.reducer;
