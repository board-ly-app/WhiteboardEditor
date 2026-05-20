// === Rect.tsx ================================================================
//
// Renders a Rect canvas object.
//
// =============================================================================

import {
  type ReactNode,
  useCallback,
} from 'react';

import Konva from 'konva';

import {
  Rect,
} from 'react-konva';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type RectModel,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import EditableShape from '@/components/EditableShape';

export interface RectCanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  model: RectModel;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const RectCanvasObject = ({
  id,
  canvasId,
  model,
  isDraggable,
  onUpdateObject,
}: RectCanvasObjectProps): ReactNode => {
  const {
    x,
    y,
    fillColor,
    strokeColor,
    strokeWidth,
    width,
    height,
    rotation,
  } = model;

  const handleTransformEnd = useCallback(
    (ev: Konva.KonvaEventObject<Event>) => {
      ev.cancelBubble = true;

      const node = ev.target;
      const rotation = node.rotation();

      const update: RectModel = {
        ...model,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation,
      };

      onUpdateObject(update);
    },
    [model, onUpdateObject]
  );// -- end handleTransformEnd

  return (
    <EditableShape<RectModel>
      id={id}
      canvasId={canvasId}
      draggable={isDraggable}
      shapeModel={model}
      onUpdateObject={onUpdateObject}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rotation={rotation}
      />
    </EditableShape>
  );
};
