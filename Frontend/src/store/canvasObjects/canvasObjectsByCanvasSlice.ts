import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import type {
  CanvasIdType
} from '@/types/WebSocketProtocol';

import type {
  CanvasObjectIdType
} from '@/types/CanvasObjectModel';

export interface CanvasObjectsByCanvasState {
  canvasObjectsByCanvas: Record<CanvasIdType, Record<CanvasObjectIdType, CanvasObjectIdType>>;
  canvasesByCanvasObjects: Record<CanvasObjectIdType, CanvasIdType>;
}

const canvasObjectsByCanvasSlice = createSlice({
  name: 'canvasObjectsByCanvas',
  initialState: {} as CanvasObjectsByCanvasState,
  reducers: {
    setObjectsByCanvas(state, action: PayloadAction<Record<CanvasIdType, CanvasObjectIdType[]>>) {
      const out = {
        canvasObjectsByCanvas: {
          ...state.canvasObjectsByCanvas,
        },
        canvasesByCanvasObjects: {
          ...state.canvasesByCanvasObjects,
        },
      };

      for (const [canvasId, canvasObjectIds] of Object.entries(action.payload)) {
        out.canvasObjectsByCanvas[canvasId] = Object.fromEntries(canvasObjectIds.map(objId => [objId, objId]));

        for (const canvasObjectId of canvasObjectIds) {
          out.canvasesByCanvasObjects[canvasObjectId] = canvasId;
        }// -- end for canvasObjectId
      }// -- end for canvasId, canvasObjectIds

      return out;
    },
    addObjectsByCanvas(state, action: PayloadAction<Record<CanvasIdType, CanvasObjectIdType[]>>) {
      const out = {
        canvasObjectsByCanvas: {
          ...state.canvasObjectsByCanvas,
        },
        canvasesByCanvasObjects: {
          ...state.canvasesByCanvasObjects,
        },
      };

      for (const [canvasId, canvasObjectIds] of Object.entries(action.payload)) {
        if (canvasId in out.canvasObjectsByCanvas) {
          out.canvasObjectsByCanvas[canvasId] = {
            ...out.canvasObjectsByCanvas[canvasId],
            ...Object.fromEntries(canvasObjectIds.map(objId => [objId, objId]))
          };
        }

        for (const canvasObjectId of canvasObjectIds) {
          out.canvasesByCanvasObjects[canvasObjectId] = canvasId;
        }// -- end for canvasObjectId
      }// -- end for canvasId, canvasObjectIds

      return out;
    },
    removeCanvasObjectsByCanvas(state, action: PayloadAction<CanvasObjectIdType[]>) {
      const out = {
        canvasObjectsByCanvas: {
          ...state.canvasObjectsByCanvas,
        },
        canvasesByCanvasObjects: {
          ...state.canvasesByCanvasObjects,
        },
      };

      for (const id of action.payload) {
        delete out.canvasObjectsByCanvas[out.canvasesByCanvasObjects[id]][id];
        delete out.canvasesByCanvasObjects[id];
      }

      return out;
    },
  },
  selectors: {
    // Entire state is mapping of object ids to objects
    // Objects redundantly store their ids
    selectObjectsByCanvas: (state, canvasId: CanvasIdType) => Object.keys(state.canvasObjectsByCanvas[canvasId])
  }
});

export const {
  setObjectsByCanvas,
  addObjectsByCanvas,
  removeCanvasObjectsByCanvas,
} = canvasObjectsByCanvasSlice.actions;

export const {
  selectObjectsByCanvas
} = canvasObjectsByCanvasSlice.selectors;

export default canvasObjectsByCanvasSlice.reducer;
