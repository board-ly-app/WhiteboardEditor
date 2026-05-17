import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import {
  type ClientIdType,
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  removeWhiteboards as removeWhiteboardsReducer,
} from '@/store/whiteboards/whiteboardsSlice';

interface ActiveUsersByWhiteboardState {
  clientsByWhiteboard: Record<WhiteboardIdType, Record<ClientIdType, ClientIdType>>;
  whiteboardsByClient: Record<ClientIdType, WhiteboardIdType>;
};

const initialState : ActiveUsersByWhiteboardState = {
  clientsByWhiteboard: {},
  whiteboardsByClient: {},
};

export const activeUsersByWhiteboardSlice = createSlice({
  name: 'activeUsersByWhiteboard',
  initialState,
  reducers: {
    setActiveUsersByWhiteboard(state: ActiveUsersByWhiteboardState, action: PayloadAction<Record<WhiteboardIdType, ClientIdType[]>>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const [wid, clientIds] of Object.entries(action.payload)) {
        clientsByWhiteboard[wid] = Object.fromEntries(clientIds.map(clientId => [
          clientId, clientId
        ]));

        for (const clientId of clientIds) {
          whiteboardsByClient[clientId] = wid;
        }// -- end for clientId
      }// -- end for wid, clientIds

      return state;
    },
    addActiveUsersByWhiteboard(
      state: ActiveUsersByWhiteboardState,
      action: PayloadAction<Record<WhiteboardIdType, ClientIdType[]>>
    ) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const [wid, clientIds] of Object.entries(action.payload)) {
        const newClientsSet = Object.fromEntries(clientIds.map(clientId => [
          clientId, clientId
        ]));

        if (wid in clientsByWhiteboard) {
          clientsByWhiteboard[wid] = {
            ...clientsByWhiteboard[wid],
            ...newClientsSet,
          };
        } else {
          clientsByWhiteboard[wid] = newClientsSet;
        }

        for (const clientId of clientIds) {
          whiteboardsByClient[clientId] = wid;
        }// -- end for clientId
      }// -- end for wid, clientIds

      return state;
    },
    removeActiveUsers(state: ActiveUsersByWhiteboardState, action: PayloadAction<ClientIdType[]>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const clientId of action.payload) {
        if (clientId in whiteboardsByClient) {
          // Push colors back onto available colors stack
          delete clientsByWhiteboard[whiteboardsByClient[clientId]][clientId];
          delete whiteboardsByClient[clientId];
        }
      }// -- end for clientId

      return state;
    },
    removeWhiteboards(state: ActiveUsersByWhiteboardState, action: PayloadAction<WhiteboardIdType[]>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const whiteboardId of action.payload) {
        if (whiteboardId in clientsByWhiteboard) {
          for (const clientId of Object.keys(clientsByWhiteboard[whiteboardId])) {
            delete whiteboardsByClient[clientId];
          }// -- end for clientId

          delete clientsByWhiteboard[whiteboardId];
        }
      }// -- end for whiteboardId

      return state;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(removeWhiteboardsReducer, (state, action: PayloadAction<WhiteboardIdType[]>) => {
      const whiteboardIds = action.payload;
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const whiteboardId of whiteboardIds) {
        if (whiteboardId in clientsByWhiteboard) {
          for (const clientId of Object.keys(clientsByWhiteboard[whiteboardId])) {
            delete whiteboardsByClient[clientId];
          }// -- end for clientId

          delete clientsByWhiteboard[whiteboardId];
        }
      }// -- end for whiteboardId

      return state;
    });
  },
});// -- end activeUsersByWhiteboardSlice

export const {
  setActiveUsersByWhiteboard,
  addActiveUsersByWhiteboard,
  removeActiveUsers,
  removeWhiteboards,
} = activeUsersByWhiteboardSlice.actions;

export type ActiveUsersByWhiteboardActions =
  | ReturnType<typeof setActiveUsersByWhiteboard>
  | ReturnType<typeof addActiveUsersByWhiteboard>
  | ReturnType<typeof removeActiveUsers>
  | ReturnType<typeof removeWhiteboards>
;

export default activeUsersByWhiteboardSlice.reducer;
