import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

// -- local imports
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

const canvasObjectsSlice = createSlice({
  name: 'canvasObjects',
  // Will store data in a <whiteboard_id, canvas_id, object_id> => CanvasObjectModel format
  initialState: {} as Record<CanvasObjectIdType, CanvasObjectModel>,
  reducers: {
    setCanvasObjects(state, action: PayloadAction<Record<CanvasObjectIdType, CanvasObjectModel>>) {

      return ({
        ...state,
        ...action.payload
      });
    },
    removeCanvasObjects(state, action: PayloadAction<CanvasObjectIdType[]>) {
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
    selectCanvasObjects: (state) => Object.values(state)
  }
});

export const {
  setCanvasObjects,
  removeCanvasObjects,
} = canvasObjectsSlice.actions;

export type CanvasObjectsActions =
  | ReturnType<typeof setCanvasObjects>
  | ReturnType<typeof removeCanvasObjects>
;

export const {
  selectCanvasObjects,
} = canvasObjectsSlice.selectors;

export default canvasObjectsSlice.reducer;
