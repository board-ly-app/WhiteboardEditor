import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import {
  type CanvasIdType,
  type CanvasAttribs,
} from '@/types/WebSocketProtocol';

const canvasesSlice = createSlice({
  name: 'canvases',
  initialState: {} as Record<CanvasIdType, CanvasAttribs>,
  reducers: {
    setCanvases(state, action: PayloadAction<Record<CanvasIdType, CanvasAttribs>>) {
      return ({
        ...state,
        ...action.payload
      });
    },
    removeCanvases(state, action: PayloadAction<CanvasIdType[]>) {
      for (const canvasId of action.payload) {
        delete state[canvasId];
      }
    },
  },
  selectors: {
    // Entire state is mapping of object ids to objects
    // Objects redundantly store their ids
    selectCanvases: (state) => Object.values(state)
  }
});

export const {
  setCanvases,
  removeCanvases,
} = canvasesSlice.actions;

export type CanvasesActions =
  | ReturnType<typeof setCanvases>
  | ReturnType<typeof removeCanvases>
;

export const {
  selectCanvases,
} = canvasesSlice.selectors;

export default canvasesSlice.reducer;
