// === currentEditorsByCanvasSlice =============================================
//
// Tracks which active user is currently editing each canvas.
//
// This is an optional one-to-one relationship: each canvas has at most one
// current editor, and each client is currently editing at most one canvas. As
// such, two dictionaries must be maintained to ensure the mapping is
// one-to-one.
//
// =============================================================================

// -- std imports
import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit'

// -- local imports
import {
  type ClientIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  removeActiveUsers,
} from '@/store/activeUsers/activeUsersSlice';

import {
  removeCanvases,
} from '@/store/canvases/canvasesSlice';

// -- type definitions
interface CurrentEditorsByCanvasSliceState {
  currentEditorsByCanvas: Record<CanvasIdType, ClientIdType>;
  canvasesByCurrentEditor: Record<ClientIdType, CanvasIdType>;
}

const currentEditorsByCanvasSlice = createSlice({
  name: 'currentEditorsByCanvas',
  initialState: {
    currentEditorsByCanvas: {},
    canvasesByCurrentEditor: {},
  } as CurrentEditorsByCanvasSliceState,
  reducers: {
    setCurrentEditorsByCanvas(state, action: PayloadAction<Record<CanvasIdType, ClientIdType>>) {
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };

      for (const [canvasId, clientId] of Object.entries(action.payload)) {
        // -- ensure no many-to-one mappings of canvases to client ids
        if (clientId in newCanvasesByCurrentEditor) {
          delete newCurrentEditorsByCanvas[newCanvasesByCurrentEditor[clientId]];
        }

        newCurrentEditorsByCanvas[canvasId] = clientId;
        newCanvasesByCurrentEditor[clientId] = canvasId;
      }// -- end for canvasId, clientId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    },
    unsetCurrentEditorsByCanvas(state, action: PayloadAction<CanvasIdType[]>) {
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };

      for (const canvasId of action.payload) {
        delete newCanvasesByCurrentEditor[newCurrentEditorsByCanvas[canvasId]];
        delete newCurrentEditorsByCanvas[canvasId];
      }// -- end for canvasId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    },
    removeCurrentEditors(state, action: PayloadAction<ClientIdType[]>) {
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };

      for (const clientId of action.payload) {
        delete newCurrentEditorsByCanvas[newCanvasesByCurrentEditor[clientId]];
        delete newCanvasesByCurrentEditor[clientId];
      }// -- end for canvasId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    },
    removeCurrentEditorsByCanvas(state, action: PayloadAction<CanvasIdType[]>) {
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };

      for (const canvasId of action.payload) {
        delete newCanvasesByCurrentEditor[newCurrentEditorsByCanvas[canvasId]];
        delete newCurrentEditorsByCanvas[canvasId];
      }// -- end for canvasId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    },
  },
  extraReducers: (builder) => {
    // -- ensure current editor relation is removed if active user is removed
    builder.addCase(removeActiveUsers, (state, action: PayloadAction<ClientIdType[]>) => {
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };
      const clientIds : ClientIdType[] = action.payload;

      for (const clientId of clientIds) {
        if (clientId in state.canvasesByCurrentEditor) {
          delete newCurrentEditorsByCanvas[newCanvasesByCurrentEditor[clientId]];
          delete newCanvasesByCurrentEditor[clientId];
        }
      }// -- end for clientId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    });

    // -- ensure current editor relations are removed when canvases are removed
    builder.addCase(removeCanvases, (state, action: PayloadAction<CanvasIdType[]>) => {
      const canvasIds : CanvasIdType[] = action.payload;
      const newCurrentEditorsByCanvas = { ...state.currentEditorsByCanvas };
      const newCanvasesByCurrentEditor = { ...state.canvasesByCurrentEditor };

      for (const canvasId of canvasIds) {
        if (canvasId in newCurrentEditorsByCanvas) {

          delete newCanvasesByCurrentEditor[newCurrentEditorsByCanvas[canvasId]];
          delete newCurrentEditorsByCanvas[canvasId];
        }
      }// -- end for canvasId

      return {
        currentEditorsByCanvas: newCurrentEditorsByCanvas,
        canvasesByCurrentEditor: newCanvasesByCurrentEditor,
      };
    });
  },
});// -- end currentEditorsByCanvasSlice

export const {
  setCurrentEditorsByCanvas,
  unsetCurrentEditorsByCanvas,
  removeCurrentEditors,
  removeCurrentEditorsByCanvas,
} = currentEditorsByCanvasSlice.actions;

export type CurrentEditorsByCanvasActions =
  | ReturnType<typeof setCurrentEditorsByCanvas>
  | ReturnType<typeof unsetCurrentEditorsByCanvas>
  | ReturnType<typeof removeCurrentEditors>
  | ReturnType<typeof removeCurrentEditorsByCanvas>
;

export default currentEditorsByCanvasSlice.reducer;
