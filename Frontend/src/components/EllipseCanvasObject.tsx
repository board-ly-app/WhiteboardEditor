// === EllipseCanvasObject.tsx =================================================
//
// Renders an Ellipse canvas object.
//
// =============================================================================

import {
  type ReactNode,
  useCallback,
} from 'react';

import Konva from 'konva';

import {
  Ellipse,
} from 'react-konva';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type EllipseModel,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import EditableShape from '@/components/EditableShape';

export interface EllipseCanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  model: EllipseModel;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const EllipseCanvasObject = ({
  id,
  canvasId,
  model,
  isDraggable,
  onUpdateObject,
}: EllipseCanvasObjectProps): ReactNode => {
  const {
    x, 
    y, 
    radiusX, 
    radiusY, 
    fillColor, 
    strokeColor, 
    strokeWidth,
    rotation,
  } = model;

  const handleTransformEnd = useCallback(
    (ev: Konva.KonvaEventObject<Event>) => {
      ev.cancelBubble = true;

      const node = ev.target;
      const rotation = node.rotation();

      const update: EllipseModel = {
        ...model,
        x: node.x(),
        y: node.y(),
        radiusX: node.width() / 2,
        radiusY: node.height() / 2,
        rotation,
      };

      onUpdateObject(update);
    },
    [model, onUpdateObject]
  );// -- end handleTransformEnd

  return (
    <EditableShape<EllipseModel>
      id={id}
      canvasId={canvasId}
      draggable={isDraggable}
      shapeModel={model}
      onUpdateObject={onUpdateObject}
      onTransformEnd={handleTransformEnd}
    >
      <Ellipse
        x={x}
        y={y}
        radiusX={radiusX}
        radiusY={radiusY}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        rotation={rotation}
      />
    </EditableShape>
  );
};
