import Konva from "konva";
import type { Shape, ShapeConfig } from "konva/lib/Shape";
import React, { 
  useEffect,
  // useRef 
} from "react";

const GUIDELINE_OFFSET = 5;

type Snap = "start" | "center" | "end";

type SnappingEdges = {
  vertical: Array<{
    guide: number;
    offset: number;
    snap: Snap;
  }>;
  horizontal: Array<{
    guide: number;
    offset: number;
    snap: Snap;
  }>;
};

type SnapObject = (
  Konva.Shape |
  Konva.Text
);

export type LineGuideStopType = {
  vertical: number[];
  horizontal: number[];
};

export type GuideType = {
  lineGuide: number;
  offset: number;
  orientation: "V" | "H";
  snap: "start" | "center" | "end";
};

export interface UseSnappingInterface {
  getLineGuideStops: (skipShape: SnapObject) => { vertical: number[]; horizontal: number[]; };
  getObjectSnappingEdges: (node: SnapObject) => SnappingEdges;
  getGuides: (lineGuideStops: LineGuideStopType, itemBounds: SnappingEdges) => Array<GuideType>;
  drawGuides: (guides: Array<GuideType>, layer: Konva.Layer) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

// === class SnappingMonitor ===================================================
//
// Creates a hook which allows the Whiteboard interface to display snapping
// guides while users are editing Canvas Objects.
//
// =============================================================================
export class SnappingMonitor {
  constructor() {
    this.getLineGuideStops = this.getLineGuideStops.bind(this);
    this.getObjectSnappingEdges = this.getObjectSnappingEdges.bind(this);
    this.getGuides = this.getGuides.bind(this);
    this.drawGuides = this.drawGuides.bind(this);
    this.onDragMove = this.onDragMove.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
  }

  getLineGuideStops(skipShape: SnapObject) {
    const stage = skipShape.getStage();
    if (!stage) return { vertical: [], horizontal: [] };

    // we can snap to stage borders and the center of the stage
    const vertical = [0, stage.width() / 2, stage.width()];
    const horizontal = [0, stage.height() / 2, stage.height()];

    // and we snap over edges and center of each object on the canvas
    stage.find("Shape").forEach((guideItem) => {
      if (guideItem.getParent() instanceof Konva.Transformer) {
        return;
      }
      if (guideItem === skipShape) {
        return;
      }
      const box = guideItem.getClientRect();
      // and we can snap to all edges of shapes
      vertical.push(box.x, box.x + box.width, box.x + box.width / 2);
      horizontal.push(box.y, box.y + box.height, box.y + box.height / 2);
    });
    return {
      vertical,
      horizontal
    };
  }// -- end getLineGuideStops

  getObjectSnappingEdges(node: SnapObject): SnappingEdges {
    const selfRect = node.getSelfRect();
    const absPos = node.absolutePosition();

    return {
      vertical: [
        {
          guide: Math.round(absPos.x),
          offset: 0,
          snap: "start"
        },
        {
          guide: Math.round(absPos.x + selfRect.width / 2),
          offset: -selfRect.width / 2,
          snap: "center"
        },
        {
          guide: Math.round(absPos.x + selfRect.width),
          offset: -selfRect.width,
          snap: "end"
        }
      ],
      horizontal: [
        {
          guide: Math.round(absPos.y),
          offset: 0,
          snap: "start"
        },
        {
          guide: Math.round(absPos.y + selfRect.height / 2),
          offset: -selfRect.height / 2,
          snap: "center"
        },
        {
          guide: Math.round(absPos.y + selfRect.height),
          offset: -selfRect.height,
          snap: "end"
        }
      ]
    };
  }// -- end getObjectSnappingEdges

  getGuides(lineGuideStops: LineGuideStopType, itemBounds: SnappingEdges): Array<GuideType> {
    const resultV: Array<{
      lineGuide: number;
      diff: number;
      snap: Snap;
      offset: number;
    }> = [];

    const resultH: Array<{
      lineGuide: number;
      diff: number;
      snap: Snap;
      offset: number;
    }> = [];

    lineGuideStops.vertical.forEach((lineGuide) => {
      itemBounds.vertical.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < GUIDELINE_OFFSET) {
          resultV.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset
          });
        }
      });
    });

    lineGuideStops.horizontal.forEach((lineGuide) => {
      itemBounds.horizontal.forEach((itemBound) => {
        const diff = Math.abs(lineGuide - itemBound.guide);
        if (diff < GUIDELINE_OFFSET) {
          resultH.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: itemBound.snap,
            offset: itemBound.offset
          });
        }
      });
    });

    const guides: Array<{
      lineGuide: number;
      offset: number;
      orientation: "V" | "H";
      snap: "start" | "center" | "end";
    }> = [];

    const minV = resultV.sort((a, b) => a.diff - b.diff)[0];
    const minH = resultH.sort((a, b) => a.diff - b.diff)[0];

    if (minV) {
      guides.push({
        lineGuide: minV.lineGuide,
        offset: minV.offset,
        orientation: "V",
        snap: minV.snap
      });
    }

    if (minH) {
      guides.push({
        lineGuide: minH.lineGuide,
        offset: minH.offset,
        orientation: "H",
        snap: minH.snap
      });
    }

    return guides;
  }

  drawGuides(guides: Array<GuideType>, layer: Konva.Layer): void {
    guides.forEach((lg) => {
      if (lg.orientation === "H") {
        const line = new Konva.Line({
          points: [-6000, 0, 6000, 0],
          stroke: "rgb(0, 161, 255)",
          strokeWidth: 1,
          name: "guide-line",
          dash: [4, 6]
        });
        layer.add(line);
        line.absolutePosition({
          x: 0,
          y: lg.lineGuide
        });
      } else if (lg.orientation === "V") {
        const line = new Konva.Line({
          points: [0, -6000, 0, 6000],
          stroke: "rgb(0, 161, 255)",
          strokeWidth: 1,
          name: "guide-line",
          dash: [4, 6]
        });
        layer.add(line);
        line.absolutePosition({
          x: lg.lineGuide,
          y: 0
        });
      }
    });
  }// -- end drawGuides

  onDragMove(e: Konva.KonvaEventObject<DragEvent>): void {
    const layer = e.target.getLayer();
    if (!layer) return;

    layer.find(".guide-line").forEach(l => l.destroy());

    const lineGuideStops = this.getLineGuideStops(e.target as Shape<ShapeConfig>);
    const itemBounds = this.getObjectSnappingEdges(e.target as Shape<ShapeConfig>);
    const guides = this.getGuides(lineGuideStops, itemBounds);

    if (!guides.length) return;

    this.drawGuides(guides, layer);

    const pos = e.target.position();
    guides.forEach(lg => {
      if (lg.orientation === "V") pos.x = lg.lineGuide + lg.offset;
      if (lg.orientation === "H") pos.y = lg.lineGuide + lg.offset;
    });

    e.target.position(pos);
  }// -- end onDragMove

  onDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    e.target.getLayer()?.find(".guide-line").forEach(l => l.destroy());
  }// -- end onDragEnd
}// -- end SnappingMonitor

export const useSnapping = (
  nodeRef: React.RefObject<SnapObject | null>,
  snappingMonitor: UseSnappingInterface
): void => {

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    node.on("dragmove", snappingMonitor.onDragMove);
    node.on("dragend", snappingMonitor.onDragEnd);

    return () => {
      node.off("dragmove", snappingMonitor.onDragMove);
      node.off("dragEnd", snappingMonitor.onDragEnd);
    };
  }, [nodeRef, snappingMonitor.onDragMove, snappingMonitor.onDragEnd]);
};// -- end useSnapping
