// === VectorCanvasObject.tsx ==================================================
//
// Renders a Vector canvas object.
//
// =============================================================================

import {
  type ReactNode,
} from 'react';

import {
  Arrow,
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
  const { strokeColor, strokeWidth, points, arrowStart, arrowEnd } = model;

  const pointerSize = Math.max(8, strokeWidth * 3);

  // NOTE: Konva's pointerAtEnd/Beginning are opposite what we think of as end and beginning
  return (
    <EditableVector<VectorModel>
      id={id}
      canvasId={canvasId}
      draggable={isDraggable}
      model={model}
      onUpdateObject={onUpdateObject}
    >
      <Arrow
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={strokeColor}
        pointerAtBeginning={arrowEnd === 'arrow'}
        pointerAtEnding={arrowStart === 'arrow'}
        pointerLength={pointerSize}
        pointerWidth={pointerSize}
      />
    </EditableVector>
  );
};
