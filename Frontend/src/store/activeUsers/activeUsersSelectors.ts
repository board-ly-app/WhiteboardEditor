import type {
  RootState
} from '@/store';

import {
  type ClientIdType,
  type UserSummary,
  type WhiteboardIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

export const selectActiveUsersByWhiteboard = (
  state: RootState,
  wid: WhiteboardIdType
) : Record<ClientIdType, ClientSummary> => {
  return Object.fromEntries(
    Object.values(state.activeUsersByWhiteboard.clientsByWhiteboard[wid] || {})
      .map(({ clientId, color }) => [
        clientId,
        {
          ...state.activeUsers[clientId],
          color
        },
    ])
  );
};

export const selectCurrentEditorByCanvas = (
  state: RootState,
  canvasId: CanvasIdType
): UserSummary | null => {
  return state.activeUsers[state.currentEditorsByCanvas.currentEditorsByCanvas[canvasId]] || null;
};

export const selectClientColorByWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType,
  clientId: ClientIdType | null,
): string | null => {
  if (! clientId) {
    return null;
  } else if (! (whiteboardId in state.activeUsersByWhiteboard.clientsByWhiteboard)) {
    return null;
  } else {
    const clientsById = state.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId];

    if (! (clientId in clientsById)) {
      return null;
    } else {
      return clientsById[clientId].color;
    }
  }
};// -- end selectClientColorByWhiteboard

export const selectSelectorByCanvasObject = (
  state: RootState,
  objId: CanvasObjectIdType,
): ClientSummary | null => {
  const clientId = state.selectorsByCanvasObject.selectorsByCanvasObject[objId];

  if (! clientId) {
    return null;
  } else {
    return state.activeUsers[clientId];
  }
};
