import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import type {
  WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type WhiteboardState,
} from '@/types/Store';

const whiteboardsSlice = createSlice({
  name: 'whiteboards',
  initialState: {} as Record<WhiteboardIdType, WhiteboardState>,
  reducers: {
    setWhiteboards(state, action: PayloadAction<Record<WhiteboardIdType, WhiteboardState>>) {
      return {
        ...state,
        ...action.payload
      };
    },
    updateWhiteboardsById(
      state,
      action: PayloadAction<Record<WhiteboardIdType, Partial<WhiteboardState>>>
    ) {
      for (const [wid, attribs] of Object.entries(action.payload)) {
        if (wid in state) {
          state[wid] = {
            ...state[wid],
            ...attribs,
          };
        }
      }// -- end 

      return state;
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
