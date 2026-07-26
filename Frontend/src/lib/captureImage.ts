import type Konva from "konva";

import { 
  type RefObject, 
} from "react";

import {
  toast,
} from 'react-toastify';

import {
  KONVA_NODE_UI_ONLY_KEY,
} from '@/app.config';

import type { CanvasIdType } from "@/types/WebSocketProtocol";

export type ImageTypeEnum =
  | 'jpeg'
  | 'png'
;

export const captureImage = (
  canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>>, 
  canvasId: string, 
  imageType: ImageTypeEnum,
  quality: number,
): string => {
  const canvasGroupRef : RefObject<Konva.Group | null> | undefined = canvasGroupRefsByIdRef.current[canvasId];
  
  if (! canvasGroupRef?.current) {
    console.error('Could not find ref to Canvas with id', canvasId);
    toast.error('Error exporting Canvas');

    return "";
  } else {
    // -- create a clone of the Canvas group that excludes UI-only elements
    //    such as borders and tooltips.
    const exportableCanvas : Konva.Container = canvasGroupRef.current.clone();

    const isNodeContainer = (node: Konva.Node): node is Konva.Container => node.hasChildren();

    const destroyUIOnlyDescendants = (node: Konva.Node) => {
      if (isNodeContainer(node)) {
        for (const child of node.getChildren()) {
          if (child.hasName(KONVA_NODE_UI_ONLY_KEY)) {
            child.destroy();
          } else {
            destroyUIOnlyDescendants(child);
          }
        }// -- end for child
      }
    };// -- end destroyUIOnlyDescendants

    // -- filter out UI-only nodes
    destroyUIOnlyDescendants(exportableCanvas);

    // -- the first child is the canvas background rect; its bounds define the
    //    logical canvas area we clamp the thumbnail to. All coordinates here are
    //    in the (detached) clone's unscaled coordinate space, independent of the
    //    live stage's zoom.
    const canvasBounds = exportableCanvas
      .getChildren()[0]
      .getClientRect({ skipShadow: true, skipStroke: false });

    // skip the first child, it's the canvas itself
    const children = exportableCanvas.getChildren().slice(1);

    // get the bounds of the child shapes
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const padding = 30;

    children.forEach(child => {
      const box = child.getClientRect({ skipShadow: true, skipStroke: false });

      // -- skip empty / zero-area nodes (e.g. object wrapper groups that render
      //    nothing); Konva reports their bounds as {0, 0, 0, 0}, which would
      //    otherwise drag the thumbnail frame to the canvas origin.
      if (box.width === 0 && box.height === 0) {
        return;
      }

      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    });

    // -- no shapes (or degenerate bounds): fall back to the full canvas area
    if (! Number.isFinite(minX)) {
      minX = canvasBounds.x;
      minY = canvasBounds.y;
      maxX = canvasBounds.x + canvasBounds.width;
      maxY = canvasBounds.y + canvasBounds.height;
    }

    // -- intersect the padded content bounds with the canvas area so an
    //    out-of-range child canvas or stray shape can't blow up the frame
    const x = Math.max(canvasBounds.x, minX - padding);
    const y = Math.max(canvasBounds.y, minY - padding);
    const right = Math.min(canvasBounds.x + canvasBounds.width, maxX + padding);
    const bottom = Math.min(canvasBounds.y + canvasBounds.height, maxY + padding);
    const width = right - x;
    const height = bottom - y;

    // export
    const exportUrl = exportableCanvas.toDataURL({
      mimeType: `image/${imageType}`,
      quality,
      x,
      y,
      width,
      height,
    });

    // -- destroy temporary exportable canvas node
    exportableCanvas.destroy(); 

    return exportUrl;
  }
}
