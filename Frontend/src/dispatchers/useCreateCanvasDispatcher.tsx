// --- std imports
import { useState } from 'react';

// --- third-party imports
import Konva from 'konva';
import { Rect } from 'react-konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

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

  const handlePointerDown = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos) {
      const { x, y } = pos;

      setMouseDownCoords({ x, y });
      setMouseCoords({ x, y });
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
          stroke="black"
          dash={[10, 10]}
        />
      );
    } else {
      return null;
    }
  };

  const renderShape = (
    _key: string | number,
    _model: CanvasObjectModel,
    _isDraggable: boolean,
    _handleUpdateShapes: (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => void
  ): React.JSX.Element | null => {
    throw new Error('Canvas is not a valid shape type');
  };

  const getAttributes = (): AttributeDefinition[] => {
    return [];
  }

  const getTooltipText = () => {
    if (mouseDownCoords) {
      return 'Drag to desired size, then release';
    } else {
      return 'Click to carve a new canvas from this canvas.';
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
};// end useCreateCanvasDispatcher

export default useCreateCanvasDispatcher;
