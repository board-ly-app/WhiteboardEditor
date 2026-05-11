import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

import {
  DEFAULT_CLIENT_COLORS,
} from '@/app.config';

import {
  type ClientIdType,
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  removeWhiteboards as removeWhiteboardsReducer,
} from '@/store/whiteboards/whiteboardsSlice';

interface AvailableColorsState {
  // -- array of currently available colors
  colors: string[];
  // -- numbers used to procedurally generate rgb colors
  proceduralRGB: [number, number, number];
}

// -- stores extra information that comes along with whiteboard => activeUser
// relation
interface ClientRelation {
  clientId: ClientIdType;
  color: string;
}

type AvailableColorsByWhiteboardState = Record<WhiteboardIdType, AvailableColorsState>;

interface ActiveUsersByWhiteboardState {
  clientsByWhiteboard: Record<WhiteboardIdType, Record<ClientIdType, ClientRelation>>;
  whiteboardsByClient: Record<ClientIdType, WhiteboardIdType>;
  // -- used to allocate unique colors to clients per-whiteboard
  availableColorsByWhiteboard: AvailableColorsByWhiteboardState;
};

const initialState : ActiveUsersByWhiteboardState = {
  clientsByWhiteboard: {},
  whiteboardsByClient: {},
  availableColorsByWhiteboard: {},
};

const popAvailableClientColor = (
  availableColorsByWhiteboard: AvailableColorsByWhiteboardState,
  whiteboardId: WhiteboardIdType
): string => {
  if (! (whiteboardId in availableColorsByWhiteboard)) {
    // -- initialize new entry for whiteboard
    const [poppedColor, ...colors] = DEFAULT_CLIENT_COLORS;

    availableColorsByWhiteboard[whiteboardId] = {
      colors,
      proceduralRGB: [256, 256, 0],
    };

    return poppedColor;
  } else {
    // -- Get next color from existing entry
    const availableColorsEntry = availableColorsByWhiteboard[whiteboardId];

    if (availableColorsEntry.colors) {
      const [poppedColor, ...colors] = availableColorsEntry.colors;

      availableColorsByWhiteboard[whiteboardId].colors = colors;

      return poppedColor;
    } else {
      // -- Generate a new color by rotating proceduralRGB and toning down
      // the first value
      const [r, g, b] = availableColorsEntry.proceduralRGB;

      availableColorsByWhiteboard[whiteboardId].proceduralRGB = [b * 0.8, r, g];

      return `rgb(${r},${g},${b})`;
    }
  }
};// -- end popAvailableClientColor

const pushAvailableClientColor = (
  availableColorsByWhiteboard: AvailableColorsByWhiteboardState,
  whiteboardId: WhiteboardIdType,
  color: string
) => {
  if (whiteboardId in availableColorsByWhiteboard) {
    const availableColorsEntry = availableColorsByWhiteboard[whiteboardId];

    availableColorsEntry.colors = [color, ...availableColorsEntry.colors];
  }
};// -- end pushAvailableClientColor

export const activeUsersByWhiteboardSlice = createSlice({
  name: 'activeUsersByWhiteboard',
  initialState,
  reducers: {
    setActiveUsersByWhiteboard(state: ActiveUsersByWhiteboardState, action: PayloadAction<Record<WhiteboardIdType, ClientIdType[]>>) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
        availableColorsByWhiteboard,
      } = state;

      for (const [whiteboardId, clientIds] of Object.entries(action.payload)) {
        clientsByWhiteboard[whiteboardId] = Object.fromEntries(clientIds.map(clientId => {
          // -- allocate a unique color for each client
          const color = popAvailableClientColor(availableColorsByWhiteboard, whiteboardId);

          return [clientId, { clientId, color }];
        }));

        for (const clientId of clientIds) {
          whiteboardsByClient[clientId] = whiteboardId;
        }// -- end for clientId
      }// -- end for whiteboardId, clientIds

      return state;
    },
    addActiveUsersByWhiteboard(
      state: ActiveUsersByWhiteboardState,
      action: PayloadAction<Record<WhiteboardIdType, ClientIdType[]>>
    ) {
      const {
        clientsByWhiteboard,
        whiteboardsByClient,
        availableColorsByWhiteboard,
      } = state;

      for (const [whiteboardId, clientIds] of Object.entries(action.payload)) {
        if (whiteboardId in clientsByWhiteboard) {
          for (const clientId of clientIds) {
            // -- allocate a unique color for each client
            const color = popAvailableClientColor(availableColorsByWhiteboard, whiteboardId);

            clientsByWhiteboard[whiteboardId][clientId] = { clientId, color };
            whiteboardsByClient[clientId] = whiteboardId;
          }// -- end for clientId
        } else {
          clientsByWhiteboard[whiteboardId] = Object.fromEntries(clientIds.map(clientId => {
            // -- allocate a unique color for each client
            const color = popAvailableClientColor(availableColorsByWhiteboard, whiteboardId);

            return [clientId, { clientId, color }];
          }));

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
        availableColorsByWhiteboard,
      } = state;

      for (const clientId of action.payload) {
        if (clientId in whiteboardsByClient) {
          // Push colors back onto available colors stack
          const whiteboardId = whiteboardsByClient[clientId];

          pushAvailableClientColor(
            availableColorsByWhiteboard,
            clientId,
            clientsByWhiteboard[whiteboardId][clientId].color
          );
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
        availableColorsByWhiteboard,
      } = state;

      for (const whiteboardId of action.payload) {
        if (whiteboardId in clientsByWhiteboard) {
          delete availableColorsByWhiteboard[whiteboardId];

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
