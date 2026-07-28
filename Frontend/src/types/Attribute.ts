// === Interface Attribute ====================================================
//
// The set of funcitons that forms each attribute
//
// Each attribute must handle :
//  
// 
//
// =============================================================================

import type {
  Dispatch,
} from "react";

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
} from "@/types/CanvasObjectModel";

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import type {
  ShapeAttributesAction,
  ShapeAttributesState,
} from "@/reducers/shapeAttributesReducer";

import AttributeStrokeWidth from "@/components/AttributeStrokeWidth";
import AttributeStrokeColor from "@/components/AttributeStrokeColor";
import AttributeFillColor from "@/components/AttributeFillColor";
import AttributeFontSize from "@/components/AttributeFontSize";
import AttributeFontColor from "@/components/AttributeFontColor";
import AttributeZOrder from "@/components/AttributeZOrder";
import {
  AttributeTextAlign,
  AttributeTextVerticalAlign,
} from "@/components/AttributeTextAlign";
import {
  AttributeArrowStart,
  AttributeArrowEnd,
} from "@/components/AttributeArrowTips";
import AttributeShadow from "@/components/AttributeShadow";
import AttributeCornerRadius from "@/components/AttributeCornerRadius";

export type AttributeType =
  | "number"
  | "color"
  | "text";

export interface BaseAttribute<T> {
  name: string;
  type: AttributeType;
  value: T;
}

export interface NumberAttribute extends BaseAttribute<number> {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface ColorAttribute extends BaseAttribute<string> {
  type: "color";
}

export interface TextAttribute extends BaseAttribute<string> {
  type: "text";
}

export type Attribute =
  | NumberAttribute
  | ColorAttribute
  | TextAttribute;

export interface AttributeProps {
  selectedShapeIds: CanvasObjectIdType[];
  dispatch: Dispatch<ShapeAttributesAction>;
  handleUpdateShapes: (
    canvasId: CanvasIdType,
    canvasObjectsById: Record<CanvasIdType, CanvasObjectModel>,
    updates: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>,
  ) => unknown;
  canvasId: string;
  // -- undefined for attributes absent on older shapes (e.g. zIndex)
  value: Attribute['value'] | undefined;
  className: string;
}

export interface AttributeDefinition {
  name: string;
  Component: AttributeComponent;
  key: keyof ShapeAttributesState;
  // -- consecutive inline definitions share a single menu row
  inline?: boolean;
}

export type AttributeComponent = React.FC<AttributeProps>;

export type ShapeType = 'rect' | 'ellipse' | 'text' | 'vector' | 'image';

export const shapeAttributes: Record<ShapeType, AttributeDefinition[]> = {
  rect: [
    AttributeStrokeWidth,
    AttributeStrokeColor,
    AttributeFillColor,
    AttributeShadow,
    AttributeCornerRadius,
    AttributeZOrder,
  ],
  ellipse: [
    AttributeStrokeWidth,
    AttributeStrokeColor,
    AttributeFillColor,
    AttributeShadow,
    AttributeZOrder,
  ],
  text: [
    AttributeFontSize,
    AttributeFontColor,
    AttributeTextAlign,
    AttributeTextVerticalAlign,
    AttributeShadow,
    AttributeZOrder,
  ],
  vector: [
    AttributeStrokeWidth,
    AttributeStrokeColor,
    AttributeArrowStart,
    AttributeArrowEnd,
    AttributeShadow,
    AttributeZOrder,
  ],
  image: [
    AttributeShadow,
    AttributeZOrder,
  ],
}

export const getAttributesByShape = (shapeType: ShapeType): AttributeDefinition[] => {
  return shapeAttributes[shapeType];
}
