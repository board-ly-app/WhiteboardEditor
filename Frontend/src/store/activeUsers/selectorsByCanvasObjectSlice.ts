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

// -- One to many binding: Client => {CanvasObject}
interface SelectorsByCanvasObjectState {
  selectorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>;
  canvasObjectsBySelector: Record<ClientIdType, Record<CanvasObjectIdType, unknown>>;
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
        // -- Delete old mappings
        if (objId in selectorsByCanvasObject) {
          delete canvasObjectsBySelector[selectorsByCanvasObject[objId]][objId];
          delete selectorsByCanvasObject[objId];
        }

        selectorsByCanvasObject[objId] = clientId;

        if (! (clientId in canvasObjectsBySelector)) {
          canvasObjectsBySelector[clientId] = {
            [objId]: true,
          };
        } else {
          canvasObjectsBySelector[clientId][objId] = true;
        }
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
          delete canvasObjectsBySelector[selectorsByCanvasObject[objId]][objId];
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
          for (const objId of Object.keys(canvasObjectsBySelector[clientId])) {
            delete selectorsByCanvasObject[objId];
          }// -- end for (const objId of Object.keys(canvasObjectsBySelector))

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
