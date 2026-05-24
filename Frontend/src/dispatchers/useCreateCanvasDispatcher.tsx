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

import {
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';

import type {
  EventCoords
} from '@/types/EventCoords';
import type { AttributeDefinition } from '@/types/Attribute';

// === useCreateCanvasDispatcher ===============================================
//
// Tool for drawing rectangles.
//
// =============================================================================
const useCreateCanvasDispatcher = ({
  shapeAttributes: _shapeAttributes,
  addShapes: _addShapes,
  onCreate: onCreateCanvas,
}: OperationDispatcherProps<NewCanvasDimensions>
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
      }
    },
    []
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
      if (! onCreateCanvas) {
        throw new Error('CreateCanvasDispatcher requires an onCreate callback function');
      }

      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos && mouseDownCoords) {
        const { x: xA, y: yA } = pos;
        const { x: xB, y: yB } = mouseDownCoords;
        const xMin = Math.min(xA, xB);
        const yMin = Math.min(yA, yB);
        const width = Math.abs(xA - xB);
        const height = Math.abs(yA - yB);

        const newCanvasData : NewCanvasDimensions = {
          originX: xMin,
          originY: yMin,
          width,
          height,
        };

        onCreateCanvas(newCanvasData);
        setMouseDownCoords(null);
      }
    },
    [mouseDownCoords, onCreateCanvas]
  );// -- end handlePointerUp

  const handleCancel = useCallback(
    () => {
      setMouseDownCoords(null);
    },// -- end handleCance,
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
            stroke="black"
            dash={[10, 10]}
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
      return [];
    },
    []
  );// -- end getAttributes

  const getTooltipText = useCallback(
    () => {
      if (mouseDownCoords) {
        return 'Drag to desired size, then release';
      } else {
        return 'Click to carve a new canvas from this canvas.';
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
    getTooltipText,
  });
};// end useCreateCanvasDispatcher

export default useCreateCanvasDispatcher;
