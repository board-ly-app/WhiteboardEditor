// --- std imports
import {
  useState,
  useCallback,
} from 'react';

// --- third-party imports
import Konva from 'konva';
import { Line } from 'react-konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  EventCoords
} from '@/types/EventCoords';
import { getAttributesByShape, type AttributeDefinition } from '@/types/Attribute';

// === useVectorDispatcher =====================================================
//
// Tool for drawing vectors.
//
// =============================================================================
const useVectorDispatcher = ({
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
    [onStartEditing]
  );// -- end handlePointerDown

  const handlePointerMove = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      if (mouseDownCoords) {
        const pos = ev.currentTarget.getRelativePointerPosition();

        if (pos) {
          const { x, y } = pos;

          setMouseCoords({ x, y });
        }
      }
    },
    [mouseDownCoords]
  );// -- end handlePointerMove

  const handlePointerUp = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos && mouseDownCoords) {
        const { x: xA, y: yA } = pos;
        const { x: xB, y: yB } = mouseDownCoords;

        addShapes([{
          type: 'vector',
          ...shapeAttributes,
          points: [xA, yA, xB, yB]
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
          <Line
            points={[xA, yA, xB, yB]}
            stroke="#888888"
          />
        );
      } else {
        return null;
      }
    },
    [mouseCoords, mouseDownCoords]
  );// -- end getPreview

  const getAttributes = useCallback(
    (): AttributeDefinition[] => getAttributesByShape('vector'),
    []
  );

  const getTooltipText = useCallback(
    () => {
      if (mouseDownCoords) {
        return 'Drag to desired length, then release';
      } else {
        return 'Click to draw a vector';
      }
    },
    [mouseDownCoords]
  );// -- end getTooltipText

  return ({
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCancel,
    getPreview,
    getAttributes,
    getTooltipText
  });
};// end useVectorDispatcher

export default useVectorDispatcher;
