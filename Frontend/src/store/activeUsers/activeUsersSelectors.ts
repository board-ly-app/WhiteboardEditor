import type {
  RootState
} from '@/store';

import {
  type ClientIdType,
  type WhiteboardIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  type ClientSummary,
  type CursorPosition,
} from '@/types/ClientSummary';

export const selectActiveUsersByWhiteboard = (
  state: RootState,
  wid: WhiteboardIdType
) : Record<ClientIdType, ClientSummary> => {
  return Object.fromEntries(
    Object.keys(state.activeUsersByWhiteboard.clientsByWhiteboard[wid] || {})
      .map(clientId => [clientId, state.activeUsers[clientId]])
  );
};

export const selectCurrentEditorByCanvas = (
  state: RootState,
  canvasId: CanvasIdType
): ClientSummary | null => {
  return state.activeUsers[state.currentEditorsByCanvas.currentEditorsByCanvas[canvasId]] || null;
};

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

export const selectCursorPositionsByClients = (
  state: RootState,
  clientIds: ClientIdType[],
): Record<ClientIdType, CursorPosition> => {
  const cursorPositionsByClient = state.cursorPositionsByClient;

  return Object.fromEntries(
    clientIds.map(clientId => clientId in cursorPositionsByClient ?
      [clientId, cursorPositionsByClient[clientId]]
      : null)
    .filter(entry => entry !== null)
  );
};
