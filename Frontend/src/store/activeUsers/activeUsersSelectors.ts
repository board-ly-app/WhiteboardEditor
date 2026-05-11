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

export const selectCurrentEditorByCanvasObject = (
  state: RootState,
  canvasObjectId: CanvasObjectIdType
): ClientSummary | null => {
  const clientId = state
    .currentEditorsByCanvasObject
    .currentEditorsByCanvasObject[canvasObjectId];

  if (! clientId) {
    return null;
  } else {
    const userSummary = state.activeUsers[clientId];
    const canvasId = state.canvasObjectsByCanvas.canvasesByCanvasObjects[canvasObjectId];
    const whiteboardId = state.canvasesByWhiteboard.whiteboardsByCanvas[canvasId];
    const color = state.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId][clientId].color;

    return {
      ...userSummary,
      color
    };
  }
};// -- end selectCurrentEditorByCanvasObject
