import type {
  RootState
} from '@/store';

import type {
  ClientIdType,
  WhiteboardIdType,
  CanvasIdType,
} from '@/types/WebSocketProtocol';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  CanvasObjectRecord,
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
): Record<CanvasObjectIdType, CanvasObjectRecord> | null => {
  const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null
    = (canvasId in state.canvasObjectsByCanvas.canvasObjectsByCanvas) ?
    state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]
    : null;

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
): Record<CanvasIdType, Record<CanvasObjectIdType, CanvasObjectRecord>> => {
  const canvasIds: CanvasIdType[] | null = (whiteboardId in state.canvasesByWhiteboard.canvasesByWhiteboard) ?
    Object.keys(state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId])
    : null;

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

// === selectSelectedCanvasObjectsByWhiteboard =================================
//
// Fetches canvas objects within a given whiteboard selected by a given user.
//
// =============================================================================
export const selectSelectedCanvasObjectsByWhiteboard = (
  state: RootState,
  whiteboardId: WhiteboardIdType,
  clientId: ClientIdType | null,
): CanvasObjectIdType[] => {
  if (! clientId) {
    return [];
  }

  const canvasIdSet = state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId];

  if (! canvasIdSet) {
    return [];
  } else {
    const out : CanvasObjectIdType[] = [];

    for (const canvasId of Object.keys(canvasIdSet)) {
      const canvasObjectIdSet = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId];

      if (! canvasObjectIdSet) {
        continue;
      }

      for (const objId of Object.keys(canvasObjectIdSet)) {
        const canvasObject = state.canvasObjects[objId];

        if (canvasObject && state.selectorsByCanvasObject.selectorsByCanvasObject[objId] === clientId) {
          out.push(objId);
        }
      }// -- end for objId
    }// -- end for canvasId

    return out;
  }
};// -- end selectSelectedCanvasObjectsByWhiteboard

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
