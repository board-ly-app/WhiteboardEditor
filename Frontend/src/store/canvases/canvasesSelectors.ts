import {
  createSelector,
} from '@reduxjs/toolkit';

import {
  type RootState,
} from '@/store';

import {
  type UserIdType,
  type CanvasAttribs,
  type CanvasIdType,
  type WhiteboardIdType
} from '@/types/WebSocketProtocol';

export const selectCanvasById = (
  state: RootState,
  canvasId: CanvasIdType | null,
): CanvasAttribs | null => (
  canvasId && state.canvases[canvasId] || null
);

export const selectCanvasesByWhiteboardId = (state: RootState, whiteboardId: WhiteboardIdType): CanvasAttribs[] => {
  if (! (whiteboardId in state.canvasesByWhiteboard.canvasesByWhiteboard)) {
    return [];
  } else {
    return Object.keys(
      state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId])
        .map((canvasId: CanvasIdType) => state.canvases[canvasId]
    );
  }
};

export const selectObjectsForCanvas = (state: RootState, canvasId: CanvasIdType) => {
  if (canvasId in state.canvasObjectsByCanvas.canvasObjectsByCanvas) {
    return Object.keys(state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]).map(id => state.canvasObjects[id]);
  } else {
    return [];
  }
};

export const selectCanvasWithObjects = createSelector(
  [selectCanvasById, selectObjectsForCanvas],
  (canvas, objects) => canvas ? ({ ...canvas, canvasObjects: objects }) : null
);

export const selectSelectedCanvasByWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType
): CanvasIdType | undefined => {
  return state.selectedCanvasByWhiteboard.selectedCanvasByWhiteboard[whiteboardId];
};

export const selectChildCanvasIdsByCanvas = (
  state: RootState,
  canvasId: CanvasIdType,
): CanvasIdType[] | null  => {
  if (! (canvasId in state.childCanvasesByCanvas.childCanvasesByCanvas)) {
    return null;
  } else {
    return Object.keys(state.childCanvasesByCanvas.childCanvasesByCanvas[canvasId]);
  }
};// -- end selectChildCanvasIdsByCanvas

export const selectUserHasAccessToCanvas = (
  state: RootState,
  canvasId: CanvasIdType,
  userId: UserIdType,
): boolean => {
  if (! (canvasId in state.allowedUsersByCanvas)) {
    // -- If no explicit allowed users set, assume true
    return true;
  }

  const allowedUserIdSet = state.allowedUsersByCanvas[canvasId];

  return ((userId in allowedUserIdSet) || (Object.keys(allowedUserIdSet).length === 0));
};// -- end selectUserHasAccessToCanvas
