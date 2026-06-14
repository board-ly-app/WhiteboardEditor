// === VectorCanvasObject.tsx ==================================================
//
// Renders a Vector canvas object.
//
// =============================================================================

import {
  type ReactNode,
} from 'react';

import {
  Line,
} from 'react-konva';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type VectorModel,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import EditableVector from '@/components/EditableVector';

export interface VectorCanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  model: VectorModel;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const VectorCanvasObject = ({
  id,
  canvasId,
  model,
  isDraggable,
  onUpdateObject,
}: VectorCanvasObjectProps): ReactNode => {
  const { strokeColor, strokeWidth, points } = model;

  return (
    <EditableVector<VectorModel>
      id={id}
      canvasId={canvasId}
      draggable={isDraggable}
      model={model}
      onUpdateObject={onUpdateObject}
    >
      <Line
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </EditableVector>
  );
};
