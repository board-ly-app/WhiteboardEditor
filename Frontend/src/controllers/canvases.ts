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
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

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
  addCanvasesByWhiteboard,
  removeCanvasesByWhiteboard,
} from '@/store/canvases/canvasesByWhiteboardSlice';

import {
  addChildCanvasesByCanvas,
} from '@/store/canvases/childCanvasesByCanvasSlice';

import {
  addObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsByCanvasSlice';

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

// === mergeCanvas =============================================================
//
// Merges the canvas indicated by canvasId into its parent canvas, transferring
// ownership of its shapes to the parent, then removing the canvas as a unique
// object in the store.
//
// =============================================================================
export const mergeCanvas = (
  dispatch: AppDispatch,
  parentCanvasesByCanvas: Record<CanvasIdType, CanvasIdType>,
  canvasObjectsByCanvas: Record<CanvasIdType, Record<CanvasObjectIdType, CanvasObjectIdType>>,
  canvasId: CanvasIdType,
) => {
  // identify parent canvas
  // copy all canvas objects into parent canvas
  // remove original canvas
  const parentCanvasId : CanvasIdType | undefined = parentCanvasesByCanvas[canvasId];

  if (parentCanvasId) {
    dispatch(addObjectsByCanvas({
      [parentCanvasId]: Object.keys(canvasObjectsByCanvas[canvasId]),
    }));
    dispatch(removeCanvases([canvasId]));
    dispatch(removeCanvasesByWhiteboard([canvasId]));
  }
};
