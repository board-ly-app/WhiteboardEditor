// === CanvasObjectModel =======================================================
//
// Different types of shapes that can be drawn within a Canvas.
//
// =============================================================================

import {
  type ClientSummary,
} from '@/types/ClientSummary';

export type ShapeColor = string;

export interface RecordBase {
  editor?: ClientSummary,
}

// -- string represents Mongo ObjectId
export type CanvasObjectIdType = string;

export interface CanvasObjectBase {
  strokeColor: ShapeColor;
  strokeWidth: number;
}

export interface ShapeModelAttributes {
  x: number;
  y: number;
  rotation: number;
  fillColor: ShapeColor;
  fontSize: number;
  color: ShapeColor;
}

export type ShapeModelBase = CanvasObjectBase & ShapeModelAttributes;

export interface RectModel extends ShapeModelBase {
  type: 'rect';
  width: number;
  height: number;
}

export interface RectRecord extends RectModel, RecordBase {}

export interface EllipseModel extends ShapeModelBase {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
}

export interface EllipseRecord extends EllipseModel, RecordBase {}

export interface VectorModel extends CanvasObjectBase {
  type: 'vector';
  points: number[];
}

export interface VectorRecord extends VectorModel, RecordBase {}

// TODO: Pull out common fields and extend if possible
export interface TextModel extends ShapeModelAttributes {
  type: 'text';
  text: string;
  width: number;
  height: number;
  rotation: number;
}

export interface TextRecord extends TextModel, RecordBase {}

export type ShapeModel = RectModel | EllipseModel | TextModel;
export type ShapeRecord = RectRecord | EllipseRecord | TextRecord;

export type CanvasObjectModel = ShapeModel | VectorModel;
export type CanvasObjectRecord = ShapeRecord | VectorRecord;
