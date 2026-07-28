// --- std imports
import {
  useState,
  useCallback,
} from 'react';

// --- third-party imports
import Konva from 'konva';
import { Rect } from 'react-konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  EventCoords
} from '@/types/EventCoords';

import { getAttributesByShape, type AttributeDefinition } from '@/types/Attribute';

import { constrainToSquare } from '@/lib/dragConstraints';

// === useRectangleDispatcher ==================================================
//
// Tool for drawing rectangles.
//
// =============================================================================
const useRectangleDispatcher = ({
  shapeAttributes,
  onStartEditing,
  addShapes,
}: OperationDispatcherProps<null>
): OperationDispatcher => {
  const [mouseDownCoords, setMouseDownCoords] = useState<EventCoords | null>(null);
  const [mouseCoords, setMouseCoords] = useState<EventCoords | null>(null);

  const handlePointerDown = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos) {
        const { x, y } = pos;

        setMouseDownCoords({ x, y });
        setMouseCoords({ x, y });

        if (onStartEditing) {
          onStartEditing();
        }
      }
    },
    [setMouseDownCoords, onStartEditing]
  );// -- end handlePointerDown

  const handlePointerMove = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      if (mouseDownCoords) {
        const pos = ev.currentTarget.getRelativePointerPosition();

        if (pos) {
          // -- shift constrains the drag to a perfect square
          const { x, y } = ev.evt.shiftKey
            ? constrainToSquare(mouseDownCoords, pos)
            : pos;

          setMouseCoords({ x, y });
        }
      }
    },
    [setMouseCoords, mouseDownCoords]
  );// -- end handlePointerMove

  const handlePointerUp = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos && mouseDownCoords) {
        // -- shift constrains the drag to a perfect square
        const { x: xA, y: yA } = ev.evt.shiftKey
          ? constrainToSquare(mouseDownCoords, pos)
          : pos;
        const { x: xB, y: yB } = mouseDownCoords;
        const xMin = Math.min(xA, xB);
        const yMin = Math.min(yA, yB);
        const width = Math.abs(xA - xB);
        const height = Math.abs(yA - yB);

        addShapes([{
          type: 'rect',
          ...shapeAttributes,
          x: xMin,
          y: yMin,
          width,
          height
        }]);
        setMouseDownCoords(null);
      }
    },
    [mouseDownCoords, addShapes, shapeAttributes]
  );// -- end handlePointerUp

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

  const getAttributes = (): AttributeDefinition[] => {
    console.log("in rect getAttributes");
    return getAttributesByShape('rect');
  }

  const getTooltipText = () => {
    if (mouseDownCoords) {
      return 'Drag to desired shape, then release (hold Shift for a square)';
    } else {
      return 'Click to draw a rectangle';
    }
  };

  return ({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
    getPreview,
    getAttributes,
    getTooltipText,
  });
};// end useRectangleDispatcher

export default useRectangleDispatcher;
