
import type {
  CanvasIdType,
  CanvasAttribs,
  CanvasData,
} from '@/types/WebSocketProtocol';

import type {
  CanvasObjectIdType,
  CanvasObjectModel
} from '@/types/CanvasObjectModel';

export interface CanvasNormal {
  canvases: Record<CanvasIdType, CanvasAttribs>;
  canvasObjects: Record<CanvasObjectIdType, CanvasObjectModel>;
  canvasObjectsByCanvas: Record<CanvasIdType, CanvasObjectIdType[]>;
  allowedUsersByCanvas: Record<string, string[]>;
}

// === normalizeCanvas =========================================================
//
// Takes a complete canvas object and normalizes it so its constituent parts can
// be stored.
//
// =============================================================================
export const normalizeCanvas = (
  canvas: CanvasData
): CanvasNormal => {
  const { id: canvasId } = canvas;
  const canvasAttribs: Partial<CanvasData> = { ...canvas };
  const canvasObjects = { ...canvas.canvasObjects };
  const allowedUsersByCanvas = {
    [canvasId]: canvasAttribs.allowedUsers || [],
  };

  // remove vector fields from canvasAttribs
  delete canvasAttribs.canvasObjects;
  delete canvasAttribs.allowedUsers;

  return ({
    canvases: ({
      [canvasId]: canvasAttribs as CanvasAttribs
    }),
    canvasObjects,
    canvasObjectsByCanvas: {
      [canvasId]: Object.keys(canvas.canvasObjects)
    },
    allowedUsersByCanvas,
  });
};
