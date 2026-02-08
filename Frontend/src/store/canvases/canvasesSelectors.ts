import { createSelector } from '@reduxjs/toolkit';

import type {
  RootState
} from '@/store';

import {
  type CanvasAttribs,
  type CanvasData,
  type CanvasIdType,
  type WhiteboardIdType
} from '@/types/WebSocketProtocol';

export const selectCanvasById = (state: RootState, canvasId: CanvasIdType): CanvasAttribs | null => (
  state.canvases[canvasId] || null
);

export const selectCanvasesByWhiteboardId = (state: RootState, whiteboardId: WhiteboardIdType): CanvasAttribs[] => (
  state.canvasesByWhiteboard[whiteboardId]?.map(canvasId => state.canvases[canvasId]) ?? []
);

export const selectObjectsForCanvas = (state: RootState, canvasId: CanvasIdType) => {
  if (canvasId in state.canvasObjectsByCanvas.canvasObjectsByCanvas) {
    return Object.keys(state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]).map(id => state.canvasObjects[id]);
  } else {
    return [];
  }
};

export const selectCanvasWithObjects = createSelector(
  [selectCanvasById, selectObjectsForCanvas],
  (canvas, objects) => canvas ? ({ ...canvas, shapes: objects }) : null
);

export const selectCanvasesWithObjectsByWhiteboardId = (
  state: RootState,
  whiteboardId: WhiteboardIdType
): CanvasData[] => (
  state.canvasesByWhiteboard[whiteboardId]
    ?.map((canvasId: CanvasIdType) => {
      const canvas = state.canvases[canvasId] || null;

      if (! canvas) {
        return null;
      } else {
        return ({
          ...canvas,
          shapes: Object.fromEntries(Object.keys(state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId])
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
    .filter(canvas => !!canvas)
    ?? []
);
