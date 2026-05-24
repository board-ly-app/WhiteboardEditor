import React, {
  useState,
  useCallback,
} from 'react';

import Konva from 'konva';
import { Rect } from 'react-konva';

import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  EventCoords
} from '@/types/EventCoords';
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

  const handlePointerDown = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      if (mouseDownCoords) {
        const pos = ev.currentTarget.getRelativePointerPosition();

        if (pos) {
          const { x, y } = pos;

          setMouseDownCoords({ x, y });
          setMouseCoords({ x, y });

          if (onStartEditing) {
            onStartEditing();
          }
        }
      }
    },
    [onStartEditing, mouseDownCoords]
  );// -- end handlePointerDown

  const handlePointerMove = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos) {
        const { x, y } = pos;

        setMouseCoords({ x, y });
      }
    },
    []
  );// -- end handlePointerMove

  const handlePointerUp = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
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
    },
    [addShapes, mouseDownCoords, shapeAttributes]
  );// -- end handlePointerUp

  const handleCancel = useCallback(
    () => {
      setMouseDownCoords(null);
    },
    []
  );// -- end handleCancel

  const getPreview = useCallback(
    (): React.JSX.Element | null => {
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
    },
    [mouseCoords, mouseDownCoords]
  );// -- end getPreview

  const getAttributes = useCallback(
    (): AttributeDefinition[] => {
      console.log("in text");
      return getAttributesByShape('text');
    },
    []
  );// -- end getAttributes

  const getTooltipText = useCallback(
    () => {
      if (mouseDownCoords) {
        return 'Drag to desired textbox size, then release';
      } else {
        return 'Click to draw a textbox';
      }
    },
    [mouseDownCoords]
  )// -- end getTooltipText

  return ({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
    getPreview,
    getAttributes,
    getTooltipText,
  });
}

export default useTextDispatcher;
