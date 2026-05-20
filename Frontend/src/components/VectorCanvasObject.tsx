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

import EditableVector from '@/components/EditableVector';

export interface VectorCanvasObjectProps {
  id: CanvasObjectIdType;
  model: VectorModel;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const VectorCanvasObject = ({
  id,
  model,
  isDraggable,
  onUpdateObject,
}: VectorCanvasObjectProps): ReactNode => {
  const { strokeColor, strokeWidth, points } = model;

  return (
    <EditableVector<VectorModel>
      id={id}
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
