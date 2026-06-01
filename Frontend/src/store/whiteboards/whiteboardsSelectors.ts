import { createSelector } from '@reduxjs/toolkit';

import {
  type RootState,
} from '@/store';

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type WhiteboardState,
} from '@/types/Store';

import {
  type UserIdType,
} from '@/types/WebSocketProtocol';

import {
  type UserPermissionEnum,
} from '@/types/UserPermission';

import {
  type WhiteboardStatusEnum,
} from '@/store/whiteboards/whiteboardStatusSlice';

export const selectWhiteboardById = (
  state: RootState,
  whiteboardId: WhiteboardIdType | null
): WhiteboardState | null => (
  whiteboardId && state.whiteboards[whiteboardId] || null
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

export const selectWhiteboardPermissionByUser = (
  state: RootState,
  whiteboardId: WhiteboardIdType,
  userId: UserIdType,
): UserPermissionEnum | null => {
  if (! (whiteboardId in state.whiteboards)) {
    return null;
  }

  const whiteboard = state.whiteboards[whiteboardId];
  const explicit = whiteboard.permissionsByUserId[userId]?.permission ?? null;

  if (explicit !== null) {
    return explicit;
  }

  return whiteboard.visibility === 'public' ? 'edit' : null;
};// -- end selectWhiteboardPermissionByUser
