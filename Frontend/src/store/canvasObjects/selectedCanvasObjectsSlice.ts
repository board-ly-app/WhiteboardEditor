import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

// -- local imports
import type {
  CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

const selectedCanvasObjectsSlice = createSlice({
  name: 'selectedCanvasObjects',
  initialState: {} as Record<CanvasObjectIdType, CanvasObjectIdType>,
  reducers: {
    setSelectedCanvasObjects(state, action: PayloadAction<CanvasObjectIdType[]>) {
      return ({
        ...state,
        ...Object.fromEntries(action.payload.map(objId => [objId, objId]))
      });
    },
    removeSelectedCanvasObjects(state, action: PayloadAction<CanvasObjectIdType[]>) {
      const removalSet : Record<CanvasObjectIdType, CanvasObjectIdType> = Object.fromEntries(
        action.payload.map(objId => [objId, objId])
      );

      return Object.fromEntries(Object.keys(state)
        .filter(objId => ! (objId in removalSet))
        .map(objId => [objId, objId])
      );
    },
  },
});// -- end selectedCanvasObjectsSlice

export const {
  setSelectedCanvasObjects,
  removeSelectedCanvasObjects,
} = selectedCanvasObjectsSlice.actions;

export default selectedCanvasObjectsSlice.reducer;
