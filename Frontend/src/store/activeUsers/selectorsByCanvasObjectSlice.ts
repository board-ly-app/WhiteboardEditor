import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

interface SelectorsByCanvasObjectState {
  selectorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>;
  canvasObjectsBySelector: Record<ClientIdType, CanvasObjectIdType>;
}

const initialState: SelectorsByCanvasObjectState = {
  selectorsByCanvasObject: {},
  canvasObjectsBySelector: {},
};

export const selectorsByCanvasObjectSlice = createSlice({
  name: 'selectorsByCanvasObject',
  initialState,
  reducers: {
    setSelectorsByCanvasObject(state, action: PayloadAction<Record<CanvasObjectIdType, ClientIdType>>) {
      const {
        selectorsByCanvasObject,
        canvasObjectsBySelector,
      } = state;

      for (const [objId, clientId] of Object.entries(action.payload)) {
        // -- Delete old mapping
        delete canvasObjectsBySelector[selectorsByCanvasObject[objId]];
        delete selectorsByCanvasObject[canvasObjectsBySelector[clientId]];

        selectorsByCanvasObject[objId] = clientId;
        canvasObjectsBySelector[clientId] = objId;
      }// -- end for objId, clientId

      return state;
    },
    removeSelectorsByCanvasObject(state, action: PayloadAction<CanvasObjectIdType[]>) {
      const {
        selectorsByCanvasObject,
        canvasObjectsBySelector,
      } = state;

      for (const objId of action.payload) {
        if (objId in selectorsByCanvasObject) {
          delete canvasObjectsBySelector[selectorsByCanvasObject[objId]];
          delete selectorsByCanvasObject[objId];
        }
      }// -- end for objId

      return state;
    },
    removeCanvasObjectsBySelector(state, action: PayloadAction<ClientIdType[]>) {
      const {
        selectorsByCanvasObject,
        canvasObjectsBySelector,
      } = state;

      for (const clientId of action.payload) {
        if (clientId in canvasObjectsBySelector) {
          delete selectorsByCanvasObject[canvasObjectsBySelector[clientId]];
          delete canvasObjectsBySelector[clientId];
        }
      }// -- end for clientId

      return state;
    },
  },
});// -- end selectorsByCanvasObjectSlice

export const {
    setSelectorsByCanvasObject,
    removeSelectorsByCanvasObject,
    removeCanvasObjectsBySelector,
} = selectorsByCanvasObjectSlice.actions;

export type SelectorsByCanvasObjectActions =
  | ReturnType<typeof setSelectorsByCanvasObject>
  | ReturnType<typeof removeSelectorsByCanvasObject>
  | ReturnType<typeof removeCanvasObjectsBySelector>
;

export default selectorsByCanvasObjectSlice.reducer;
