// === currentEditorsByCanvasObjectSlice =======================================
//
// Tracks which active user is currently editing each canvas object.
//
// This is an optional one-to-one relationship: each canvas object has at most one
// current editor, and each client is currently editing at most one canvas
// object. As such, two dictionaries must be maintained to ensure the mapping is
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
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  removeActiveUsers,
} from '@/store/activeUsers/activeUsersSlice';

import {
  removeCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSlice';

// -- type definitions
interface CurrentEditorsByCanvasObjectSliceState {
  currentEditorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>;
  canvasObjectsByCurrentEditor: Record<ClientIdType, CanvasObjectIdType>;
}

const currentEditorsByCanvasObjectSlice = createSlice({
  name: 'currentEditorsByCanvasObject',
  initialState: {
    currentEditorsByCanvasObject: {},
    canvasObjectsByCurrentEditor: {},
  } as CurrentEditorsByCanvasObjectSliceState,
  reducers: {
    setCurrentEditorsByCanvasObject(state, action: PayloadAction<Record<CanvasObjectIdType, ClientIdType>>) {
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };

      for (const [canvasObjectId, clientId] of Object.entries(action.payload)) {
        // -- ensure no many-to-one mappings of canvasObjects to client ids
        if (clientId in newCanvasObjectsByCurrentEditor) {
          delete newCurrentEditorsByCanvasObject[newCanvasObjectsByCurrentEditor[clientId]];
        }

        newCurrentEditorsByCanvasObject[canvasObjectId] = clientId;
        newCanvasObjectsByCurrentEditor[clientId] = canvasObjectId;
      }// -- end for canvasObjectId, clientId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    },
    unsetCurrentEditorsByCanvasObject(state, action: PayloadAction<CanvasObjectIdType[]>) {
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };

      for (const canvasObjectId of action.payload) {
        delete newCanvasObjectsByCurrentEditor[newCurrentEditorsByCanvasObject[canvasObjectId]];
        delete newCurrentEditorsByCanvasObject[canvasObjectId];
      }// -- end for canvasObjectId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    },
    removeCurrentEditors(state, action: PayloadAction<ClientIdType[]>) {
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };

      for (const clientId of action.payload) {
        delete newCurrentEditorsByCanvasObject[newCanvasObjectsByCurrentEditor[clientId]];
        delete newCanvasObjectsByCurrentEditor[clientId];
      }// -- end for canvasObjectId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    },
    removeCurrentEditorsByCanvasObject(state, action: PayloadAction<CanvasObjectIdType[]>) {
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };

      for (const canvasObjectId of action.payload) {
        delete newCanvasObjectsByCurrentEditor[newCurrentEditorsByCanvasObject[canvasObjectId]];
        delete newCurrentEditorsByCanvasObject[canvasObjectId];
      }// -- end for canvasObjectId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    },
  },
  extraReducers: (builder) => {
    // -- ensure current editor relation is removed if active user is removed
    builder.addCase(removeActiveUsers, (state, action: PayloadAction<ClientIdType[]>) => {
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };
      const clientIds : ClientIdType[] = action.payload;

      for (const clientId of clientIds) {
        if (clientId in state.canvasObjectsByCurrentEditor) {
          delete newCurrentEditorsByCanvasObject[newCanvasObjectsByCurrentEditor[clientId]];
          delete newCanvasObjectsByCurrentEditor[clientId];
        }
      }// -- end for clientId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    });

    // -- ensure current editor relations are removed when canvasObjects are removed
    builder.addCase(removeCanvasObjects, (state, action: PayloadAction<CanvasObjectIdType[]>) => {
      const canvasObjectIds : CanvasObjectIdType[] = action.payload;
      const newCurrentEditorsByCanvasObject = { ...state.currentEditorsByCanvasObject };
      const newCanvasObjectsByCurrentEditor = { ...state.canvasObjectsByCurrentEditor };

      for (const canvasObjectId of canvasObjectIds) {
        if (canvasObjectId in newCurrentEditorsByCanvasObject) {

          delete newCanvasObjectsByCurrentEditor[newCurrentEditorsByCanvasObject[canvasObjectId]];
          delete newCurrentEditorsByCanvasObject[canvasObjectId];
        }
      }// -- end for canvasObjectId

      return {
        currentEditorsByCanvasObject: newCurrentEditorsByCanvasObject,
        canvasObjectsByCurrentEditor: newCanvasObjectsByCurrentEditor,
      };
    });
  },
});// -- end currentEditorsByCanvasObjectSlice

export const {
  setCurrentEditorsByCanvasObject,
  unsetCurrentEditorsByCanvasObject,
  removeCurrentEditors,
  removeCurrentEditorsByCanvasObject,
} = currentEditorsByCanvasObjectSlice.actions;

export type CurrentEditorsByCanvasObjectActions =
  | ReturnType<typeof setCurrentEditorsByCanvasObject>
  | ReturnType<typeof unsetCurrentEditorsByCanvasObject>
  | ReturnType<typeof removeCurrentEditors>
  | ReturnType<typeof removeCurrentEditorsByCanvasObject>
;

export default currentEditorsByCanvasObjectSlice.reducer;
