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

      for (const [whiteboardId, clientIds] of Object.entries(action.payload)) {
        clientsByWhiteboard[whiteboardId] = Object.fromEntries(clientIds.map(clientId => [clientId, clientId]));

        for (const clientId of clientIds) {
          whiteboardsByClient[clientId] = whiteboardId;
        }// -- end for clientId
      }// -- end for whiteboardId, clientIds

      return {
        clientsByWhiteboard,
        whiteboardsByClient,
      };
    },
    addActiveUsersByWhiteboard(state: ActiveUsersByWhiteboardState, action: PayloadAction<Record<WhiteboardIdType, ClientIdType[]>>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const [whiteboardId, clientIds] of Object.entries(action.payload)) {
        if (whiteboardId in clientsByWhiteboard) {
          for (const clientId of clientIds) {
            clientsByWhiteboard[whiteboardId][clientId] = clientId;
            whiteboardsByClient[clientId] = whiteboardId;
          }// -- end for clientId
        } else {
          clientsByWhiteboard[whiteboardId] = Object.fromEntries(clientIds.map(clientId => [clientId, clientId]));

          for (const clientId of clientIds) {
            whiteboardsByClient[clientId] = whiteboardId;
          }// -- end for clientId
        }
      }// -- end for whiteboardId, userSummariesByWhiteboardId

      return state;
    },
    removeActiveUsers(state: ActiveUsersByWhiteboardState, action: PayloadAction<ClientIdType[]>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
      } = state;

      for (const clientId of action.payload) {
        if (clientId in whiteboardsByClient) {
          delete clientsByWhiteboard[whiteboardsByClient[clientId]][clientId];
          delete whiteboardsByClient[clientId];
        }
      }// -- end for clientId

      return {
        clientsByWhiteboard,
        whiteboardsByClient,
      };
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

      return {
        clientsByWhiteboard,
        whiteboardsByClient,
      };
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

      return {
        clientsByWhiteboard,
        whiteboardsByClient,
      };
    });
  },
});// -- end activeUsersByWhiteboardSlice

export const {
  setActiveUsersByWhiteboard,
  addActiveUsersByWhiteboard,
  removeActiveUsers,
  removeWhiteboards,
} = activeUsersByWhiteboardSlice.actions;

export default activeUsersByWhiteboardSlice.reducer;
