import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  type CursorPosition
} from '@/types/ClientSummary';

type CursorPositionsByClientState = Record<ClientIdType, CursorPosition>;

const initialState : CursorPositionsByClientState = {};

export const cursorPositionsByClientSlice = createSlice({
  name: 'cursorPositionsByClient',
  initialState,
  reducers: {
    setCursorPosByClient(state, action: PayloadAction<Record<ClientIdType, CursorPosition>>) {
      return {
        ...state,
        ...action.payload,
      };
    },
    unsetCursorPosByClient(state, action: PayloadAction<ClientIdType[]>) {
      for (const clientId of action.payload) {
        delete state[clientId];
      }// -- end for clientId

      return state;
    },
  },
});// -- end cursorPositionsByClientSlice

export const {
    setCursorPosByClient,
    unsetCursorPosByClient,
} = cursorPositionsByClientSlice.actions;

export type CursorPositionsByClientActions =
  | ReturnType<typeof setCursorPosByClient>
  | ReturnType<typeof unsetCursorPosByClient>
;

export default cursorPositionsByClientSlice.reducer;
