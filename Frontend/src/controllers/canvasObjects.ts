import type {
  AppDispatch,
} from '@/store';

import type {
  CanvasIdType,
} from '@/types/WebSocketProtocol';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  setCanvasObjects,
  removeCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSlice';

import {
  addObjectsByCanvas,
  removeCanvasObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsByCanvasSlice';

const controllerSetCanvasObjects = (
  dispatch: AppDispatch,
  canvasId: CanvasIdType,
  canvasObjects: Record<CanvasObjectIdType, CanvasObjectModel>
) => {
  dispatch(setCanvasObjects(canvasObjects));
  dispatch(addObjectsByCanvas({
    [canvasId]: Object.keys(canvasObjects)
  }));
};

const controllerRemoveCanvasObjects = (
  dispatch: AppDispatch,
  canvasObjectIds: CanvasObjectIdType[]
) => {
  dispatch(removeCanvasObjects(canvasObjectIds));
  dispatch(removeCanvasObjectsByCanvas(canvasObjectIds));
};

export {
  controllerSetCanvasObjects as setCanvasObjects,
  controllerRemoveCanvasObjects as removeCanvasObjects,
};
