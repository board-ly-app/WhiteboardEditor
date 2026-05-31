import {
  createSelector,
} from '@reduxjs/toolkit';

import {
  type RootState,
} from '@/store';

import {
  type CanvasAttribs,
  type CanvasData,
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

export const selectCanvasesWithObjectsByWhiteboardId = (
  state: RootState,
  whiteboardId: WhiteboardIdType
): CanvasData[] => {
  if (! (whiteboardId in state.canvasesByWhiteboard.canvasesByWhiteboard)) {
    return [];
  } else {
    return Object.keys(state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId])
      .map((canvasId: CanvasIdType) => {
        const canvas = state.canvases[canvasId] || null;

        if (! canvas) {
          return null;
        } else {
          return ({
            ...canvas,
            canvasObjects: Object.fromEntries(Object.keys(state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId])
              .map(canvasObjectId => {
                if (! (canvasObjectId in state.canvasObjects)) {
                  return null;
                } else {
                  const canvasObjectRecord = state.canvasObjects[canvasObjectId];

                  return [canvasObjectId, canvasObjectRecord];
                }
              })
              .filter(entry => !!entry)
            ),
            allowedUsers: state.allowedUsersByCanvas[canvasId] || []
          });
        }
      })
      .filter((canvas: CanvasData | null) => !!canvas);
  }
};// -- end selectCanvasesWithObjectsByWhiteboardId

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
