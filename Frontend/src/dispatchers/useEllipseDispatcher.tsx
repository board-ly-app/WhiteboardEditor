// --- std imports
import { useState } from 'react';

// --- third-party imports
import Konva from 'konva';
import { Ellipse } from 'react-konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  EllipseModel
} from '@/types/CanvasObjectModel';
import type {
  EventCoords
} from '@/types/EventCoords';

import EditableShape from '@/components/EditableShape';
import { getAttributesByShape, type AttributeDefinition } from '@/types/Attribute';

// === useEllipseDispatcher ====================================================
//
// Tool for drawing ellipses.
//
// =============================================================================
const useEllipseDispatcher = ({
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
    ev.cancelBubble = true;

    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos) {
      const { x, y } = pos;

      setMouseCoords({ x, y });
    }
  };

  const handlePointerUp = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    ev.cancelBubble = true;

    const pos = ev.currentTarget.getRelativePointerPosition();

    if (pos && mouseDownCoords) {
      const { x: xRelease, y: yRelease } = pos;
      const { x: xOrigin, y: yOrigin } = mouseDownCoords;

      const xCenter = (xOrigin + xRelease) / 2;
      const yCenter = (yOrigin + yRelease) / 2;
      const xRadius = Math.abs((xRelease - xOrigin) / 2);
      const yRadius = Math.abs((yRelease - yOrigin) / 2); 

      addShapes([{
        type: 'ellipse',
        ...shapeAttributes,
        x: xCenter,
        y: yCenter,
        radiusX: xRadius,
        radiusY: yRadius,
      }]);
      setMouseDownCoords(null);
    }
  };

  const handleCancel = () => {
    setMouseDownCoords(null);
  };// -- end handleCancel

  const getPreview = (): React.JSX.Element | null => {
    if (mouseDownCoords && mouseCoords) {
      const { x: xOrigin, y: yOrigin } = mouseDownCoords;
      const { x: xCurr, y: yCurr } = mouseCoords;

      const xCenter = (xOrigin + xCurr) / 2;
      const yCenter = (yOrigin + yCurr) / 2;
      const xRadius = Math.abs((xCurr - xOrigin) / 2);
      const yRadius = Math.abs((yCurr - yOrigin) / 2);

      return (
        <Ellipse
          x={xCenter}
          y={yCenter}
          radiusX={xRadius}
          radiusY={yRadius}
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
    if (model.type !== 'ellipse') {
      return null;
    } else {
      const { 
        x, 
        y, 
        radiusX, 
        radiusY, 
        fillColor, 
        strokeColor, 
        strokeWidth,
        rotation,
      } = model;

      return (
        <EditableShape<EllipseModel>
          key={key}
          id={`${key}`}
          draggable={isDraggable}
          shapeModel={model}
          handleUpdateShapes={handleUpdateShapes}
        >
          <Ellipse
            x={x}
            y={y}
            radiusX={radiusX}
            radiusY={radiusY}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            rotation={rotation}
          />
        </EditableShape>
      );
    }
  };

  const getAttributes = (): AttributeDefinition[] => getAttributesByShape('ellipse'); 

  const getTooltipText = () => {
    if (mouseDownCoords) {
      return 'Drag to desired shape, then release';
    } else {
      return 'Click to draw an ellipse';
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
    getTooltipText
  });
};// end useEllipseDispatcher

export default useEllipseDispatcher;
