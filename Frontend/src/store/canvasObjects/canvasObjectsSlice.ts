import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

// -- local imports
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

const initialState : Record<CanvasObjectIdType, CanvasObjectModel> = {};

const canvasObjectsSlice = createSlice({
  name: 'canvasObjects',
  // Will store data in a <whiteboard_id, canvas_id, object_id> => CanvasObjectModel format
  initialState,
  reducers: {
    setCanvasObjects(state, action: PayloadAction<Record<CanvasObjectIdType, CanvasObjectModel>>) {
      return {
        ...state,
        ...action.payload,
      };
    },
    removeCanvasObjects(state, action: PayloadAction<CanvasObjectIdType[]>) {
      for (const objId of action.payload) {
        delete state[objId];
      }

      return state;
    }
  },
});

export const {
  setCanvasObjects,
  removeCanvasObjects,
} = canvasObjectsSlice.actions;

export type CanvasObjectsActions =
  | ReturnType<typeof setCanvasObjects>
  | ReturnType<typeof removeCanvasObjects>
;

export default canvasObjectsSlice.reducer;
