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

import EditableText from '@/components/EditableText';

import editableObjectProps from '@/dispatchers/editableObjectProps';

export interface TextCanvasObjectProps {
  id: CanvasObjectIdType;
  record: TextRecord;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const TextCanvasObject = ({
  id,
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
