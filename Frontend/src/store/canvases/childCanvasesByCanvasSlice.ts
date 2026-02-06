// === childCanvasesByCanvasSlice.ts ===========================================
//
// Maps each canvas to its immediate children.
//
// =============================================================================

import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

export interface ChildCanvasesByCanvasSliceState {
  // Maps {parent canvas id} => Set{child canvas ids}
  childCanvasesByCanvas: Record<CanvasIdType, Record<CanvasIdType, CanvasIdType>>;
  // Maps {child canvas id} => {parent canvas id}
  parentCanvasesByCanvas: Record<CanvasIdType, CanvasIdType>;
}

const childCanvasesByCanvasSlice = createSlice({
  name: 'childCanvasesByCanvasSlice',
  initialState: {
    childCanvasesByCanvas: {},
    parentCanvasesByCanvas: {},
  } as ChildCanvasesByCanvasSliceState,
  reducers: {
    // -- Sets all child canvases for each parent canvas
    setChildCanvasesByCanvas(state, action: PayloadAction<Record<CanvasIdType, CanvasIdType[]>>) {
      const {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      } = state;

      for (const [parentCanvasId, childCanvasIds] of Object.entries(action.payload)) {
        // unset old {child canvas} => {parent canvas} mappings
        if (parentCanvasId in state.childCanvasesByCanvas) {
          for (const childCanvasId of Object.keys(state.childCanvasesByCanvas[parentCanvasId])) {
            delete state.parentCanvasesByCanvas[childCanvasId];
          }// -- end for childCanvasId
        }

        for (const childCanvasId of childCanvasIds) {
          if (childCanvasId in parentCanvasesByCanvas) {
            delete childCanvasesByCanvas[parentCanvasesByCanvas[childCanvasId]][childCanvasId];
          }
        }// -- end for childCanvasId

        // set new {parent canvas id} => Set{child canvas id} mapping
        childCanvasesByCanvas[parentCanvasId] = Object.fromEntries(childCanvasIds.map(
          childCanvasId => [childCanvasId, childCanvasId]
        ));

        // set new {child canvas id} => {parent canvas id} back-mapping
        for (const childCanvasId of childCanvasIds) {
          parentCanvasesByCanvas[childCanvasId] = parentCanvasId;
        }// -- end for childCanvasId
      }// -- end for parentCanvasId, childCanvasIdSet

      return state;
    },
    // -- Adds new child canvases for parent canvases
    addChildCanvasesByCanvas(state, action: PayloadAction<Record<CanvasIdType, CanvasIdType[]>>) {
      const {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      } = state;

      for (const [parentCanvasId, childCanvasIds] of Object.entries(action.payload)) {
        // add new {parent canvas id} => Set{child canvas id} mappings
        for (const childCanvasId of childCanvasIds) {
          if (childCanvasId in parentCanvasesByCanvas) {
            delete childCanvasesByCanvas[parentCanvasesByCanvas[childCanvasId]][childCanvasId];
          }

          childCanvasesByCanvas[parentCanvasId][childCanvasId] = childCanvasId;
        }// -- end for childCanvasId

        // set new {child canvas id} => {parent canvas id} back-mapping
        for (const childCanvasId of childCanvasIds) {
          parentCanvasesByCanvas[childCanvasId] = parentCanvasId;
        }// -- end for childCanvasId
      }// -- end for parentCanvasId, childCanvasIdSet

      return {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      };
    },
    // removes given canvases as both children and parents
    removeCanvases(state, action: PayloadAction<CanvasIdType[]>) {
      const {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      } = state;

      // remove canvasId as child
      for (const canvasId of action.payload) {
        if (canvasId in parentCanvasesByCanvas) {
          delete childCanvasesByCanvas[parentCanvasesByCanvas[canvasId]][canvasId];
          delete parentCanvasesByCanvas[canvasId];
        }
      }// -- end for canvasId

      // remove canvasId as parent
      for (const canvasId of action.payload) {
        if (canvasId in childCanvasesByCanvas) {
          delete childCanvasesByCanvas[canvasId];
        }
      }// -- end for canvasId

      return {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      };
    },
    // remove given canvases as children
    removeChildCanvases(state, action: PayloadAction<CanvasIdType[]>) {
      const {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      } = state;

      for (const childCanvasId of action.payload) {
        delete childCanvasesByCanvas[parentCanvasesByCanvas[childCanvasId]][childCanvasId];
        delete parentCanvasesByCanvas[childCanvasId];
      }// -- end for childCanvasId

      return {
        childCanvasesByCanvas,
        parentCanvasesByCanvas,
      };
    },
  },
  selectors: {
    // Entire state is mapping of object ids to objects
    // Canvases redundantly store their ids
    selectChildCanvasesByCanvas: (state, canvasId: CanvasIdType) => state.childCanvasesByCanvas[canvasId]
  }
});

export const {
  setChildCanvasesByCanvas,
  addChildCanvasesByCanvas,
  removeCanvases,
} = childCanvasesByCanvasSlice.actions;

export const {
  selectChildCanvasesByCanvas,
} = childCanvasesByCanvasSlice.selectors;

export default childCanvasesByCanvasSlice.reducer;
