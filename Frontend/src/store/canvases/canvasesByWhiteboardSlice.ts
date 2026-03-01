import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

// -- local imports
import type {
  WhiteboardIdType,
  CanvasIdType,
} from '@/types/WebSocketProtocol';

export interface CanvasesByWhiteboardState {
  canvasesByWhiteboard: Record<WhiteboardIdType, Record<CanvasIdType, boolean>>;
  whiteboardsByCanvas: Record<CanvasIdType, WhiteboardIdType>;
}

const canvasesByWhiteboardSlice = createSlice({
  name: 'canvasesByWhiteboard',
  initialState: {
    canvasesByWhiteboard: {},
    whiteboardsByCanvas: {},
  } as CanvasesByWhiteboardState,
  reducers: {
    setCanvasesByWhiteboard(state, action: PayloadAction<Record<WhiteboardIdType, CanvasIdType[]>>) {
      const {
        canvasesByWhiteboard,
        whiteboardsByCanvas,
      } = state;

      for (const [whiteboardId, canvasIds] of Object.entries(action.payload)) {
        if (whiteboardId in canvasesByWhiteboard) {
          // remove old canvas => whiteboard mappings
          for (const canvasId of Object.keys(canvasesByWhiteboard[whiteboardId])) {
            delete whiteboardsByCanvas[canvasId];
          }// -- end for canvasId
        }

        canvasesByWhiteboard[whiteboardId] = Object.fromEntries(
          canvasIds.map(canvasId => [canvasId, true])
        );

        for (const canvasId of canvasIds) {
          whiteboardsByCanvas[canvasId] = whiteboardId;
        }// -- end for canvasId
      }// -- end for whiteboardId, canvasIds

      return state;
    },
    addCanvasesByWhiteboard(state, action: PayloadAction<Record<WhiteboardIdType, CanvasIdType[]>>) {
      const {
        canvasesByWhiteboard,
        whiteboardsByCanvas,
      } = state;

      for (const [whiteboardId, canvasIds] of Object.entries(action.payload)) {
        for (const canvasId of canvasIds) {
          canvasesByWhiteboard[whiteboardId][canvasId] = true;
          whiteboardsByCanvas[canvasId] = whiteboardId;
        }// -- end for canvasId
      }// -- end for whiteboardId, canvasIds

      return state;
    },
    removeCanvasesByWhiteboard(state, action: PayloadAction<CanvasIdType[]>) {
      const {
        canvasesByWhiteboard,
        whiteboardsByCanvas,
      } = state;

      for (const canvasId of action.payload) {
        if (canvasId in whiteboardsByCanvas) {
          delete canvasesByWhiteboard[whiteboardsByCanvas[canvasId]][canvasId];
          delete whiteboardsByCanvas[canvasId];
        }
      }// -- end for canvasId
      
      return state;
    },
  },
  selectors: {
    // Entire state is mapping of object ids to objects
    // Canvases redundantly store their ids
    selectCanvasesByWhiteboard: (state, whiteboardId: WhiteboardIdType) => state.canvasesByWhiteboard[whiteboardId]
  }
});

export const {
  setCanvasesByWhiteboard,
  addCanvasesByWhiteboard,
  removeCanvasesByWhiteboard,
} = canvasesByWhiteboardSlice.actions;

export type CanvasesByWhiteboardActions =
  | ReturnType<typeof setCanvasesByWhiteboard>
  | ReturnType<typeof addCanvasesByWhiteboard>
  | ReturnType<typeof removeCanvasesByWhiteboard>
;

export const {
  selectCanvasesByWhiteboard,
} = canvasesByWhiteboardSlice.selectors;

export default canvasesByWhiteboardSlice.reducer;
