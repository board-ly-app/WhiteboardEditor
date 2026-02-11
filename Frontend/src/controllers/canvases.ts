import {
  type AppDispatch,
} from '@/store';

import {
  type WhiteboardIdType,
  type CanvasIdType,
  type CanvasData,
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  setCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSlice';

import {
  setObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsByCanvasSlice';

import {
  setAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  setCanvases,
  removeCanvases,
} from '@/store/canvases/canvasesSlice';

import {
  mergeCanvasAction,
} from '@/store/canvases/mergeCanvasesReducer';

import {
  addCanvasesByWhiteboard,
  removeCanvasesByWhiteboard,
} from '@/store/canvases/canvasesByWhiteboardSlice';

import {
  addChildCanvasesByCanvas,
} from '@/store/canvases/childCanvasesByCanvasSlice';

import {
  setSelectedCanvasByWhiteboard as setSelectedCanvasByWhiteboardReducer,
} from '@/store/canvases/selectedCanvasesByWhiteboardSlice';

import {
  setCurrentEditorsByCanvas,
  unsetCurrentEditorsByCanvas,
} from '@/store/activeUsers/currentEditorsByCanvasSlice';

import {
  normalizeCanvas,
} from '@/store/canvases/canvasesNormalizers';

export const addCanvas = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  canvas: CanvasData
) => {
  const {
    canvases,
    canvasObjects,
    canvasObjectsByCanvas,
    allowedUsersByCanvas
  } = normalizeCanvas(canvas);

  if (canvas.parentCanvas) {
    const parentCanvasId = canvas.parentCanvas.canvasId;

    dispatch(addChildCanvasesByCanvas({
      [parentCanvasId]: [canvas.id],
    }));
  }

  dispatch(setCanvases(canvases));
  dispatch(setCanvasObjects(canvasObjects));
  dispatch(setObjectsByCanvas(canvasObjectsByCanvas));
  dispatch(setAllowedUsersByCanvas(allowedUsersByCanvas));
  dispatch(addCanvasesByWhiteboard({
    [whiteboardId]: [canvas.id]
  }));
};

export const deleteCanvas = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType
) => {
  dispatch(removeCanvases([canvasId]));
  dispatch(removeCanvasesByWhiteboard([canvasId]));
};

export const setCurrentEditorByCanvas = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType,
  editorClientId: ClientIdType
) => {
  dispatch(setCurrentEditorsByCanvas({ [canvasId]: editorClientId }));
};

export const unsetCurrentEditorByCanvas = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType,
) => {
  dispatch(unsetCurrentEditorsByCanvas([ canvasId ]));
};

export const setSelectedCanvasByWhiteboard = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType,
  whiteboardId: WhiteboardIdType,
) => {
  dispatch(setSelectedCanvasByWhiteboardReducer({
    canvasId,
    whiteboardId,
  }));
};

// === mergeCanvas =============================================================
//
// Merges the canvas indicated by canvasId into its parent canvas, transferring
// ownership of its shapes to the parent, then removing the canvas as a unique
// object in the store.
//
// =============================================================================
export const mergeCanvas = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType,
) => {
  dispatch(mergeCanvasAction(canvasId));
};
