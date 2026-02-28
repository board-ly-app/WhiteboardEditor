// === interface OperationDispatcher ===========================================
//
// A collection of functions that handle tool operations.
//
// Each tool operation must handle three Konva events:
//  - pointer down: The starting point of the operation should be determined
//  here (i.e. the initial point from which to draw a rectangle)
//  - pointer move: Triggered whenever the pointer moves while the mouse is
//  down. Should modify the state of preview and prepare the operation for its
//  final state.
//  - pointer up: Finishes the operation. Likely creates a shape, to be added to
//  the collection of shapes within the canvas.
//
//  The dispatcher should also provide a getPreview method, which indicates the
//  current state of the operation and the final shape that the user would draw
//  if they finish the operation at any given point (i.e. an outline of a
//  rectangle).
//
// =============================================================================

// -- third-party imports
import Konva from 'konva';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  type ShapeAttributesState,
} from '@/reducers/shapeAttributesReducer';
import type { AttributeDefinition } from '@/types/Attribute';

export interface OperationDispatcher {
  handlePointerDown: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  handlePointerMove: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  handlePointerUp: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  handleCancel: () => void;
  getPreview: () => React.JSX.Element | null;
  getAttributes: () => AttributeDefinition[];
  renderShape: (
    key: string | number,
    model: CanvasObjectModel,
    isDraggable: boolean,
    handleUpdateShapes: (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => void,
  ) => React.JSX.Element | null;
  getTooltipText: () => string;
}// end interface OperationDispatcher

export interface OperationDispatcherProps <OnCreateInputType> {
  shapeAttributes: ShapeAttributesState;
  addShapes: (shapes: CanvasObjectModel[]) => void;
  onStartEditing?: () => void;
  onCreate?: (data: OnCreateInputType) => void;
}
