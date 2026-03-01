import { createSelector } from '@reduxjs/toolkit';

import {
  type RootState,
} from '@/store';

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type WhiteboardStatusEnum,
} from '@/store/whiteboards/whiteboardStatusSlice';

export const selectWhiteboardById = (state: RootState, whiteboardId: WhiteboardIdType) => (
  state.whiteboards[whiteboardId]
);

export const selectCanvasesForWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType
) => {
  if (whiteboardId in state.canvasesByWhiteboard.canvasesByWhiteboard) {
    return Object.keys(state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId])
      .map(canvasId => state.canvases[canvasId]);
  } else {
    return [];
  }
};

export const selectWhiteboardWithCanvases = createSelector(
  [selectWhiteboardById, selectCanvasesForWhiteboard],
  (whiteboard, canvases) => whiteboard ? ({ ...whiteboard, canvases }) : null
);

export const selectWhiteboardStatus = (
  state: RootState,
  whiteboardId: WhiteboardIdType,
): WhiteboardStatusEnum | undefined => {
  return state.whiteboardStatus.statusesByWhiteboard[whiteboardId];
};
