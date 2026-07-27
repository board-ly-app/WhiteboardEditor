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
  // -- optional: objects created before z-ordering have no zIndex (treated as 0)
  zIndex?: number;
  // -- optional: objects created before shadows have none (treated as false)
  shadow?: boolean;
}

export interface ShapeModelAttributes {
  x: number;
  y: number;
  rotation: number;
  fillColor: ShapeColor;
  fontSize: number;
  color: ShapeColor;
  zIndex?: number;
  shadow?: boolean;
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

export type ArrowTip = 'none' | 'arrow';

export interface VectorModel extends CanvasObjectBase {
  type: 'vector';
  points: number[];
  // -- optional: vectors created before arrow tips have neither (treated as 'none')
  arrowStart?: ArrowTip;
  arrowEnd?: ArrowTip;
}

export interface VectorRecord extends VectorModel, RecordBase {}

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';

// TODO: Pull out common fields and extend if possible
export interface TextModel extends ShapeModelAttributes {
  type: 'text';
  text: string;
  width: number;
  height: number;
  rotation: number;
  // -- optional: text created before alignment has neither (treated as 'left'/'top')
  align?: TextAlign;
  verticalAlign?: TextVerticalAlign;
}

export interface TextRecord extends TextModel, RecordBase {}

export type ShapeModel = RectModel | EllipseModel | TextModel;
export type ShapeRecord = RectRecord | EllipseRecord | TextRecord;

export type CanvasObjectModel = ShapeModel | VectorModel;
export type CanvasObjectRecord = ShapeRecord | VectorRecord;
