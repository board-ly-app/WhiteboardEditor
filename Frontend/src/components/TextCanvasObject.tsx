// === TextCanvasObject.tsx ====================================================
//
// Renders a Text canvas object.
//
// =============================================================================

import {
  type ReactNode,
} from 'react';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type TextRecord,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import EditableText from '@/components/EditableText';

import editableObjectProps from '@/dispatchers/editableObjectProps';

export interface TextCanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  record: TextRecord;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const TextCanvasObject = ({
  id,
  canvasId,
  record,
  isDraggable,
  onUpdateObject,
}: TextCanvasObjectProps): ReactNode => {
  const {
    fontSize,
    text,
    color,
    x,
    y,
    width,
    height,
    rotation,
  } = record;

  return (
    <EditableText
      id={id}
      canvasId={canvasId}
      fontSize={fontSize}
      text={text}
      color={color}
      x={x}
      y={y}
      width={width}
      height={height}
      draggable={isDraggable}
      rotation={rotation}
      record={record}
      onUpdateObject={onUpdateObject}
      {...editableObjectProps<TextRecord>(record, isDraggable, onUpdateObject)}
    />
  )
};
