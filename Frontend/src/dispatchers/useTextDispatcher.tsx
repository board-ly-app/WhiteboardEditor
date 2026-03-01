import React, {
  useState
} from 'react';

import Konva from 'konva';
import { Rect } from 'react-konva';

import EditableText from '@/components/EditableText';

import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  TextModel
} from '@/types/CanvasObjectModel';
import type {
  EventCoords
} from '@/types/EventCoords';
import editableObjectProps from './editableObjectProps';
import { getAttributesByShape, type AttributeDefinition } from '@/types/Attribute';

// === useTextDispatcher ==================================================
//
// Tool for writing text.
//
// =============================================================================
const useTextDispatcher = ({
  shapeAttributes,
  onStartEditing,
  addShapes,
}: OperationDispatcherProps<null>
): OperationDispatcher => {
  const [mouseDownCoords, setMouseDownCoords] = useState<EventCoords | null>(null);
  const [mouseCoords, setMouseCoords] = useState<EventCoords | null>(null);

  const handlePointerDown = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos) {
      const { x, y } = pos;

      setMouseDownCoords({ x, y });
      setMouseCoords({ x, y });

      if (onStartEditing) {
        onStartEditing();
      }
    }
  };

  const handlePointerMove = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos) {
      const { x, y } = pos;

      setMouseCoords({ x, y });
    }
  };

  const handlePointerUp = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos && mouseDownCoords) {
      const { x: xA, y: yA } = pos;
      const { x: xB, y: yB } = mouseDownCoords;
      const xMin = Math.min(xA, xB);
      const yMin = Math.min(yA, yB);
      const width = Math.abs(xA - xB);
      const height = Math.abs(yA - yB);

      addShapes([{
        type: 'text',
        text: 'Enter Text',
        ...shapeAttributes,
        x: xMin,
        y: yMin,
        width,
        height,
        rotation: 0,
      }]);
      setMouseDownCoords(null);
    }
  };

  const handleCancel = () => {
    setMouseDownCoords(null);
  };// -- end handleCancel

  const getPreview = (): React.JSX.Element | null => {
    if (mouseDownCoords && mouseCoords) {
      const { x: xA, y: yA } = mouseDownCoords;
      const { x: xB, y: yB } = mouseCoords;

      return (
        <Rect
          x={Math.min(xA, xB)}
          y={Math.min(yA, yB)}
          width={Math.abs(xA - xB)}
          height={Math.abs(yA - yB)}
          fill="#ffaaaa"
        />
      );
    } else {
      return null;
    }
  };

  const renderShape = (
    key: string | number,
    model: CanvasObjectModel,
    isDraggable: boolean,
    handleUpdateShapes: (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => void
  ): React.JSX.Element | null => {
    if (model.type !== 'text') {
      return null;
    } else {
      const {
        fontSize,
        text,
        color,
        x,
        y,
        width,
        height,
        rotation,
      } = model;

      return (
        <EditableText
          key={key}
          id={`${key}`}
          fontSize={fontSize}
          text={text}
          color={color}
          x={x}
          y={y}
          width={width}
          height={height}
          draggable={isDraggable}
          rotation={rotation}
          shapeModel={model}
          handleUpdateShapes={handleUpdateShapes}
          {...editableObjectProps<TextModel>(model, isDraggable, handleUpdateShapes)}
        />
      )
    }
  };

  const getAttributes = (): AttributeDefinition[] => getAttributesByShape('text');

  const getTooltipText = () => {
    if (mouseDownCoords) {
      return 'Drag to desired textbox size, then release';
    } else {
      return 'Click to draw a textbox';
    }
  };  

  return ({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
    getPreview,
    getAttributes,
    renderShape,
    getTooltipText,
  });
}

export default useTextDispatcher;
