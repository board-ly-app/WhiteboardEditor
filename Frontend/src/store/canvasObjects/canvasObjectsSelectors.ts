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

// Returns object IDs in render order: ascending zIndex, with ties broken by
// object ID (ObjectIds are chronologically ordered, so ties keep creation
// order and stay deterministic across clients).
export const selectCanvasObjectIdsByCanvas = (
  state: RootState,
  canvasId: CanvasIdType,
): CanvasObjectIdType[] | null => {
  const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null
    = (canvasId in state.canvasObjectsByCanvas.canvasObjectsByCanvas) ?
    state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]
    : null;

  if (objectIds === null) {
    return null;
  } else {
    return Object.keys(objectIds).sort((idA, idB) => {
      const zA = state.canvasObjects[idA]?.zIndex ?? 0;
      const zB = state.canvasObjects[idB]?.zIndex ?? 0;

      if (zA !== zB) {
        return zA - zB;
      }

      return idA < idB ? -1 : (idA > idB ? 1 : 0);
    });
  }
};// -- end selectCanvasObjectIdsByCanvas

// === selectMaxZIndexByCanvas =================================================
//
// Returns the highest zIndex among a canvas' objects, or 0 if the canvas has
// no objects. Used to stamp new shapes so they render on top.
//
// =============================================================================
export const selectMaxZIndexByCanvas = (
  state: RootState,
  canvasId: CanvasIdType,
): number => {
  const objectIds: Record<CanvasObjectIdType, CanvasObjectIdType> | null
    = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId] || null;

  if (objectIds === null) {
    return 0;
  }

  return Object.keys(objectIds).reduce(
    (max, objId) => Math.max(max, state.canvasObjects[objId]?.zIndex ?? 0),
    0
  );
};// -- end selectMaxZIndexByCanvas

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
        if (state.selectorsByCanvasObject.selectorsByCanvasObject[objId] === clientId) {
          out.push(objId);
        }
      }// -- end for objId
    }// -- end for canvasId

    return out;
  }
};// -- end selectSelectedCanvasObjectsByWhiteboard

export const selectSelectedCanvasObjectsByCanvas = (
  state: RootState,
  canvasId: CanvasIdType,
  clientId: ClientIdType | null,
): CanvasObjectIdType[] => {
  if (! clientId) return [];

  const out : CanvasObjectIdType[] = [];
  const canvasObjectIdSet = state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId];

  if (! canvasObjectIdSet) {
    return [];
  }

  for (const objId of Object.keys(canvasObjectIdSet)) {
    if (state.selectorsByCanvasObject.selectorsByCanvasObject[objId] === clientId) {
      out.push(objId);
    }
  }// -- end for objId

  return out;
};// -- end selectSelectedCanvasObjectsByCanvas

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
