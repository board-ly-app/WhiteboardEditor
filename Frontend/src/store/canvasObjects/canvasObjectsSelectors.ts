import type {
  RootState
} from '@/store';

import type {
  WhiteboardIdType,
  CanvasIdType,
} from '@/types/WebSocketProtocol';

import type {
  CanvasObjectIdType,
  CanvasObjectModel
} from '@/types/CanvasObjectModel';

// === selectCanvasObjectsByCanvas =============================================
//
// Selects canvas objects belonging to a particular canvas.
//
// Returns a mapping of canvas object IDs to canvas objects, or null if there
// are no objects belonging to the given canvas.
//
// =============================================================================
export const selectCanvasObjectsByCanvas = (
  state: RootState,
  canvasId: CanvasIdType
): Record<CanvasObjectIdType, CanvasObjectModel> | null => {
  const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId] || null;

  if (! objectIds) {
    return null;
  } else {
    return Object.fromEntries(Object.keys(objectIds).map((objectId: CanvasObjectIdType) => {
      const canvasObject = state.canvasObjects[objectId] || null;

      if (! canvasObject) {
        return null;
      } else {
        return [objectId, canvasObject];
      }
    }).filter(entry => !!entry));
  }
};

export const selectCanvasObjectsByWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType
): Record<CanvasIdType, Record<CanvasObjectIdType, CanvasObjectModel>> => {
  const canvasIds: CanvasIdType[] | null = state.canvasesByWhiteboard[whiteboardId] || null;

  if (! canvasIds) {
    return {};
  } else {
    return Object.fromEntries(canvasIds.map((canvasId: CanvasIdType) => {
      const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId] || null;

      if (! objectIds) {
        return null;
      } else {
        return [
          canvasId,
          Object.fromEntries(Object.keys(objectIds).map(objId => {
            const objModel = state.canvasObjects[objId];

            if (! objModel) {
              return null;
            } else {
              return [objId, objModel];
            }
          }).filter(entry => !!entry))
        ];
      }
    }).filter(entry => !!entry));
  }
};

export const selectSelectedCanvasObjects = (
  state: RootState
): Record<CanvasObjectIdType, CanvasObjectIdType> => {
  return state.selectedCanvasObjects;
};

export const selectSelectedCanvasObjectsByWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType
): CanvasObjectIdType[] => {
  const canvasIds: CanvasIdType[] | null = state.canvasesByWhiteboard[whiteboardId] || null;

  if (! canvasIds) {
    return [];
  } else {
    const selectedCanvasObjectSet : Record<CanvasObjectIdType, CanvasObjectIdType> = state.selectedCanvasObjects;

    return canvasIds.reduce(
      (accum: CanvasObjectIdType[], canvasId) => {
        const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId] || null;

        if (objectIds) {
          accum.push(...Object.keys(objectIds).filter(objId => objId in selectedCanvasObjectSet));
        }

        return accum;
      },
      []
    );
  }
};

export const selectCanvasObjectById = (
  state: RootState,
  objectId: CanvasObjectIdType,
): CanvasObjectModel | null => {
  const canvasObject: CanvasObjectModel | null = state.canvasObjects[objectId] || null;

  return canvasObject;
};

export const getShapeType = (
  state: RootState,
  shapeId: CanvasObjectIdType,
): CanvasObjectModel['type'] | undefined => {
  const shape = state.canvasObjects[shapeId];
  return shape?.type;
}
