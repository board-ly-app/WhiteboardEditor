// === mergeCanvasesReducer.ts =================================================
//
// Reducer which takes the entirety of the root state and uses it to merge a
// canvas into its parent canvas.
//
// =============================================================================

// -- third-party imports
import {
  type UnknownAction,
} from 'redux';

import {
  createAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type RootState,
} from '@/store';

import {
  type CanvasIdType,
  type CanvasAttribs,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectModel,
} from '@/types/CanvasObjectModel';

const MERGE_CANVAS_ACTION_TYPE = 'mergeCanvas';

export const mergeCanvasAction = createAction<CanvasIdType>(MERGE_CANVAS_ACTION_TYPE);

export type MergeCanvasActionType = ReturnType<typeof mergeCanvasAction>;

export const isMergeCanvasAction = (action: UnknownAction): action is MergeCanvasActionType => {
  return action.type === MERGE_CANVAS_ACTION_TYPE;
};

export const mergeCanvasReducer = (state: RootState, action: MergeCanvasActionType): RootState => {
  const canvasId : CanvasIdType = action.payload;
  const {
    childCanvasesByCanvas: childCanvasesByCanvasOld,
    parentCanvasesByCanvas: parentCanvasesByCanvasOld,
  } = state.childCanvasesByCanvas;
  const {
    canvasObjectsByCanvas: canvasObjectsByCanvasOld,
    canvasesByCanvasObjects: canvasesByCanvasObjectsOld,
  } = state.canvasObjectsByCanvas;
  const {
    canvasesByWhiteboard: canvasesByWhiteboardOld,
    whiteboardsByCanvas: whiteboardsByCanvasOld,
  } = state.canvasesByWhiteboard;
  const canvasesOld = state.canvases;
  const canvasObjectsOld = state.canvasObjects;

  if (
    (! (canvasId in parentCanvasesByCanvasOld))
    || (! (canvasId in canvasesOld))
  ) {
    // No parent canvas found; abort and return original state
    return state;
  } else {
    // get id of parent canvas
    const parentCanvasId : CanvasIdType = parentCanvasesByCanvasOld[canvasId];
    const canvas : CanvasAttribs = canvasesOld[canvasId];

    if (! canvas.parentCanvas) {
      // abort; return original, unaltered state
      return state;
    }

    // get whiteboard id
    if (! (canvasId in whiteboardsByCanvasOld)) {
      // abort; return original, unaltered state
      return state;
    }

    const whiteboardId = whiteboardsByCanvasOld[canvasId];

    const {
      originX,
      originY,
    } = canvas.parentCanvas;

    // increase old canvas' objects' coordinates by originX and originY, to
    // represent the objects' locations on the parent canvas
    const canvasObjects : typeof canvasObjectsOld = Object.fromEntries(
      Object.keys(canvasObjectsByCanvasOld[canvasId]).map(objId => {
        const objOld = canvasObjectsOld[objId];
        let obj : CanvasObjectModel;

        switch (objOld.type) {
          case 'vector':
          {
              obj = {
                ...objOld,
                points: objOld.points.map((val, i) => (
                  (i % 2 == 0) ? val + originX : val + originY
                )),
              };
          }
          break;
          default:
          {
              obj = {
                ...objOld,
                x: objOld.x + originX,
                y: objOld.y + originY,
              };
          }
        }// -- end switch

        return [objId, obj];
      })
    );

    const {
      [canvasId]: canvasObjectIdSet,
      [parentCanvasId]: parentCanvasObjectIdSet,
      ...canvasObjectsByCanvas
    } = canvasObjectsByCanvasOld;

    canvasObjectsByCanvas[parentCanvasId] = {
      ...parentCanvasObjectIdSet,
      ...canvasObjectIdSet
    };

    const canvasesByCanvasObjects = Object.fromEntries(
      Object.entries(canvasesByCanvasObjectsOld).map(([objId, canId]) => [
        objId, canId === canvasId ? parentCanvasId : canId
      ])
    );

    // extract old child entry referencing the target canvas
    const {
      [canvasId]: _childCanvasId,
      ...childCanvasesSet
    } = childCanvasesByCanvasOld[parentCanvasId];

    // extract reference from child to parent canvas
    const {
      [canvasId]: _parentCanvasId,
      ...parentCanvasesByCanvas
    } = parentCanvasesByCanvasOld;

    // TODO: reimplement canvasesByWhiteboardSlice to contain back-mapping of
    // canvases to their parent whiteboards, to reduce this to an O(1)
    // operation.
    // Remove references to canvas from canvasesByWhiteboard slice
    const {
      [canvasId]: _canvasByWhiteboardSetEntry,
      ...canvasesByWhiteboardSet
    } = canvasesByWhiteboardOld[whiteboardId];

    const canvasesByWhiteboard = {
      ...canvasesByWhiteboardOld,
      [whiteboardId]: canvasesByWhiteboardSet,
    };

    const {
      [canvasId]: _whiteboardByCanvasEntry,
      ...whiteboardsByCanvas
    } = whiteboardsByCanvasOld;

    return {
      ...state,
      childCanvasesByCanvas: {
        childCanvasesByCanvas: {
          ...childCanvasesByCanvasOld,
          [parentCanvasId]: {
            ...childCanvasesSet,
            ...childCanvasesByCanvasOld[canvasId],
          },
        },
        parentCanvasesByCanvas,
      },
      canvasObjectsByCanvas: {
        canvasObjectsByCanvas,
        canvasesByCanvasObjects,
      },
      canvasesByWhiteboard: {
        canvasesByWhiteboard,
        whiteboardsByCanvas,
      },
      canvasObjects,
    };
  }
};// -- end mergeCanvasesReducer
