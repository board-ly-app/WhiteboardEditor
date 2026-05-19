// === activeUsersSlice ========================================================
//
// Stores user summaries indexed by client IDs.
//
// =============================================================================

// -- std imports
import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

type ActiveUsersSliceState = Record<ClientIdType, ClientSummary>;

const initialState : ActiveUsersSliceState = {};

const activeUsersSlice = createSlice({
  name: 'activeUsers',
  initialState,
  reducers: {
    setActiveUsers(state, action: PayloadAction<ClientSummary[]>) {
      return {
        ...state,
        ...Object.fromEntries(action.payload.map(clientSummary => [
          clientSummary.clientId, clientSummary
        ]))
      };
    },
    removeActiveUsers(state, action: PayloadAction<ClientIdType[]>) {
      const newState = { ...state };
      const clientIds : ClientIdType[] = action.payload;

      for (const clientId of clientIds) {
        delete newState[clientId];
      }// -- end for clientId

      return newState;
    },
    setClientCursorPos(state, action: PayloadAction<Record<ClientIdType, { x: number; y: number; }>>) {
      for (const [clientId, cursorPos] of Object.entries(action.payload)) {
        if (clientId in state) {
          state[clientId].cursorPos = cursorPos;
        }
      }// -- end for clientId, cursorPos

      return state;
    },
    unsetClientCursorPos(state, action: PayloadAction<ClientIdType[]>) {
      for (const clientId of action.payload) {
        delete state[clientId];
      }// -- end for clientId

      return state;
    },
  },
});// -- end activeUsersSlice

export const {
  setActiveUsers,
  removeActiveUsers,
  setClientCursorPos,
  unsetClientCursorPos,
} = activeUsersSlice.actions;

export type ActiveUsersActions =
  | ReturnType<typeof setActiveUsers>
  | ReturnType<typeof removeActiveUsers>
  | ReturnType<typeof setClientCursorPos>
  | ReturnType<typeof unsetClientCursorPos>
;

export default activeUsersSlice.reducer;
