import Konva from "konva";

import React, { 
  useEffect,
  // useRef 
} from "react";

const GUIDELINE_OFFSET = 5;

// -- Rotation angles (degrees) that the Transformer's rotate anchor snaps to.
export const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

// -- How close (degrees) the rotation must be to a snap angle before the
// Transformer locks onto it.
export const ROTATION_SNAP_TOLERANCE = 5;

// -- Tolerance (degrees) used to detect that a rotation is currently locked
// onto a snap angle. Konva sets the rotation exactly when snapped, so this
// only needs to absorb floating point error.
const ROTATION_SNAP_EPSILON = 0.1;

// -- Minimum share of an edge anchor's movement direction along an absolute
// axis before resize snapping applies on that axis. Edge anchors travel along
// a single local axis, which is rotated along with the shape.
const ANCHOR_AXIS_COMPONENT_MIN = 0.1;

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
  Konva.Text |
  Konva.Line
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
  getAnchorBoundPosition: (
    transformer: Konva.Transformer,
    oldAbsPos: Konva.Vector2d,
    newAbsPos: Konva.Vector2d
  ) => Konva.Vector2d;
  onTransform: (e: Konva.KonvaEventObject<Event>, transformer: Konva.Transformer | null) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onEndpointDragMove: (e: Konva.KonvaEventObject<DragEvent>, fixedPoint: Konva.Vector2d) => Konva.Vector2d;
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
    this.findNearestSnap = this.findNearestSnap.bind(this);
    this.getAnchorBoundPosition = this.getAnchorBoundPosition.bind(this);
    this.onTransform = this.onTransform.bind(this);
    this.onTransformEnd = this.onTransformEnd.bind(this);
    this.onEndpointDragMove = this.onEndpointDragMove.bind(this);
  }

  getLineGuideStops(skipShape: SnapObject): LineGuideStopType {
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
      // Skip nodes belonging to the same object group as the skipped shape
      // (e.g. a vector's endpoint anchors and selection highlight), so an
      // object never snaps to its own parts.
      if (guideItem.getParent() === skipShape.getParent()) {
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
    const stage = node.getStage();
    if (!stage) return { vertical: [], horizontal: [] };
    const selfRect = node.getClientRect({ relativeTo: stage });
    const absPos = { x: selfRect.x, y: selfRect.y };

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

    const node = e.target;
    const stage = node.getStage();
    if (!stage) return;

    const lineGuideStops = this.getLineGuideStops(node as SnapObject);
    const itemBounds = this.getObjectSnappingEdges(node as SnapObject);
    const guides = this.getGuides(lineGuideStops, itemBounds);

    if (!guides.length) return;

    this.drawGuides(guides, layer);

    const box = node.getClientRect({ relativeTo: stage });

    // current node position (transform origin)
    const nodePos = node.position();

    let dx = 0;
    let dy = 0;

    guides.forEach(lg => {
      if (lg.orientation === "V") {
        const targetX = lg.lineGuide + lg.offset;
        dx = targetX - box.x;
      }
      if (lg.orientation === "H") {
        const targetY = lg.lineGuide + lg.offset;
        dy = targetY - box.y;
      }
    });

    node.position({
      x: nodePos.x + dx,
      y: nodePos.y + dy
    });
  }// -- end onDragMove


  onDragEnd(e: Konva.KonvaEventObject<DragEvent>): void {
    e.target.getLayer()?.find(".guide-line").forEach(l => l.destroy());
  }// -- end onDragEnd

  findNearestSnap(stops: number[], value: number): number | null {
    let nearest: number | null = null;
    let nearestDiff = GUIDELINE_OFFSET;

    stops.forEach((stop) => {
      const diff = Math.abs(stop - value);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearest = stop;
      }
    });

    return nearest;
  }// -- end findNearestSnap

  // Bounds a Transformer resize anchor so it snaps to guide-line stops.
  // Positions are in absolute (container) coordinates.
  getAnchorBoundPosition(
    transformer: Konva.Transformer,
    _oldAbsPos: Konva.Vector2d,
    newAbsPos: Konva.Vector2d
  ): Konva.Vector2d {
    const node = transformer.nodes()[0];
    const layer = transformer.getLayer();
    if (!node || !layer) return newAbsPos;

    const anchor = transformer.getActiveAnchor();
    // Rotation guides are owned by onTransform; leave them untouched here.
    if (!anchor || anchor === "rotater") return newAbsPos;

    layer.find(".guide-line").forEach(l => l.destroy());

    // Edge anchors move along a single local axis, which the shape's rotation
    // maps onto the absolute axes; only snap along axes the anchor can
    // actually move on. Corner anchors move freely.
    const radians = (node.getAbsoluteRotation() * Math.PI) / 180;
    let snapX = true;
    let snapY = true;

    if (anchor === "top-center" || anchor === "bottom-center") {
      // Moves along the local y axis: direction (-sin, cos)
      snapX = Math.abs(Math.sin(radians)) > ANCHOR_AXIS_COMPONENT_MIN;
      snapY = Math.abs(Math.cos(radians)) > ANCHOR_AXIS_COMPONENT_MIN;
    } else if (anchor === "middle-left" || anchor === "middle-right") {
      // Moves along the local x axis: direction (cos, sin)
      snapX = Math.abs(Math.cos(radians)) > ANCHOR_AXIS_COMPONENT_MIN;
      snapY = Math.abs(Math.sin(radians)) > ANCHOR_AXIS_COMPONENT_MIN;
    }

    const lineGuideStops = this.getLineGuideStops(node as SnapObject);
    const snappedX = snapX ? this.findNearestSnap(lineGuideStops.vertical, newAbsPos.x) : null;
    const snappedY = snapY ? this.findNearestSnap(lineGuideStops.horizontal, newAbsPos.y) : null;

    const guides: Array<GuideType> = [];

    if (snappedX !== null) {
      guides.push({
        lineGuide: snappedX,
        offset: 0,
        orientation: "V",
        snap: "start"
      });
    }

    if (snappedY !== null) {
      guides.push({
        lineGuide: snappedY,
        offset: 0,
        orientation: "H",
        snap: "start"
      });
    }

    if (guides.length) {
      this.drawGuides(guides, layer);
    }

    return {
      x: snappedX ?? newAbsPos.x,
      y: snappedY ?? newAbsPos.y
    };
  }// -- end getAnchorBoundPosition

  // Draws a horizontal/vertical guide through the shape's center while its
  // rotation is locked onto 0/90/180/270 degrees.
  onTransform(e: Konva.KonvaEventObject<Event>, transformer: Konva.Transformer | null): void {
    if (!transformer || transformer.getActiveAnchor() !== "rotater") return;

    const layer = e.target.getLayer();
    if (!layer) return;

    layer.find(".guide-line").forEach(l => l.destroy());

    const rotation = ((e.target.rotation() % 360) + 360) % 360;
    const snapped = [...ROTATION_SNAPS, 360].find(
      (snap) => Math.abs(rotation - snap) < ROTATION_SNAP_EPSILON
    );
    if (snapped === undefined) return;

    const box = e.target.getClientRect();
    const isHorizontal = snapped % 180 === 0;

    this.drawGuides([{
      lineGuide: isHorizontal ? box.y + box.height / 2 : box.x + box.width / 2,
      offset: 0,
      orientation: isHorizontal ? "H" : "V",
      snap: "center"
    }], layer);
  }// -- end onTransform

  onTransformEnd(e: Konva.KonvaEventObject<Event>): void {
    e.target.getLayer()?.find(".guide-line").forEach(l => l.destroy());
  }// -- end onTransformEnd

  // Snaps a dragged vector endpoint to guide-line stops and to the fixed
  // endpoint's axes (making the line exactly horizontal or vertical when
  // close), drawing the matching guides. fixedPoint and the returned position
  // are in the anchor's parent coordinates.
  onEndpointDragMove(
    e: Konva.KonvaEventObject<DragEvent>,
    fixedPoint: Konva.Vector2d
  ): Konva.Vector2d {
    const node = e.target;
    const layer = node.getLayer();
    const parent = node.getParent();
    if (!layer || !parent) return node.position();

    layer.find(".guide-line").forEach(l => l.destroy());

    // Work in absolute coordinates to match the guide stops
    const absPos = node.absolutePosition();
    const absFixed = parent.getAbsoluteTransform().point(fixedPoint);
    const lineGuideStops = this.getLineGuideStops(node as SnapObject);

    type Candidate = { value: number; diff: number; isAxisSnap: boolean };

    const axisCandidate = (current: number, axisValue: number): Candidate | null => {
      const diff = Math.abs(current - axisValue);
      return diff < GUIDELINE_OFFSET ? { value: axisValue, diff, isAxisSnap: true } : null;
    };

    const stopCandidate = (current: number, stops: number[]): Candidate | null => {
      const stop = this.findNearestSnap(stops, current);
      return stop !== null
        ? { value: stop, diff: Math.abs(stop - current), isAxisSnap: false }
        : null;
    };

    const closer = (a: Candidate | null, b: Candidate | null): Candidate | null => {
      if (!a || !b) return a ?? b;
      return a.diff <= b.diff ? a : b;
    };

    const stopX = stopCandidate(absPos.x, lineGuideStops.vertical);
    const stopY = stopCandidate(absPos.y, lineGuideStops.horizontal);

    let snapX = closer(axisCandidate(absPos.x, absFixed.x), stopX);
    let snapY = closer(axisCandidate(absPos.y, absFixed.y), stopY);

    // Never snap both axes onto the fixed endpoint, or short lines would
    // collapse to a single point; keep the closer axis snap only.
    if (snapX?.isAxisSnap && snapY?.isAxisSnap) {
      if (snapX.diff <= snapY.diff) {
        snapY = stopY;
      } else {
        snapX = stopX;
      }
    }

    if (!snapX && !snapY) return node.position();

    node.absolutePosition({
      x: snapX?.value ?? absPos.x,
      y: snapY?.value ?? absPos.y
    });

    const guides: Array<GuideType> = [];

    if (snapX) {
      guides.push({
        lineGuide: snapX.value,
        offset: 0,
        orientation: "V",
        snap: "center"
      });
    }

    if (snapY) {
      guides.push({
        lineGuide: snapY.value,
        offset: 0,
        orientation: "H",
        snap: "center"
      });
    }

    this.drawGuides(guides, layer);

    return node.position();
  }// -- end onEndpointDragMove
}// -- end SnappingMonitor

export const useSnapping = (
  nodeRef: React.RefObject<SnapObject | null>,
  snappingMonitor: UseSnappingInterface,
  transformerRef?: React.RefObject<Konva.Transformer | null>
): void => {

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    // Resolve the transformer at event time; it is rendered conditionally.
    const handleTransform = (e: Konva.KonvaEventObject<Event>) =>
      snappingMonitor.onTransform(e, transformerRef?.current ?? null);

    node.on("dragmove", snappingMonitor.onDragMove);
    node.on("dragend", snappingMonitor.onDragEnd);
    node.on("transform", handleTransform);
    node.on("transformend", snappingMonitor.onTransformEnd);

    return () => {
      node.off("dragmove", snappingMonitor.onDragMove);
      node.off("dragend", snappingMonitor.onDragEnd);
      node.off("transform", handleTransform);
      node.off("transformend", snappingMonitor.onTransformEnd);
    };
  }, [nodeRef, transformerRef, snappingMonitor]);
};// -- end useSnapping
