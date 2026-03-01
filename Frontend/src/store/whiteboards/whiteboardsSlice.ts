import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import type {
  WhiteboardIdType,
  WhiteboardAttribs
} from '@/types/WebSocketProtocol';

const whiteboardsSlice = createSlice({
  name: 'whiteboards',
  initialState: {} as Record<WhiteboardIdType, WhiteboardAttribs>,
  reducers: {
    setWhiteboards(state, action: PayloadAction<Record<WhiteboardIdType, WhiteboardAttribs>>) {
      return {
        ...state,
        ...action.payload
      };
    },
    removeWhiteboards(state, action: PayloadAction<WhiteboardIdType[]>) {
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
    selectWhiteboards: (state) => Object.values(state)
  }
});

export const {
  setWhiteboards,
  removeWhiteboards,
} = whiteboardsSlice.actions;

export type WhiteboardsActions =
  | ReturnType<typeof setWhiteboards>
  | ReturnType<typeof removeWhiteboards>
;

export const {
  selectWhiteboards,
} = whiteboardsSlice.selectors;

export default whiteboardsSlice.reducer;
