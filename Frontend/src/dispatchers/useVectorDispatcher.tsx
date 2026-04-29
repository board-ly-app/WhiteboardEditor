// --- std imports
import { useState } from 'react';

// --- third-party imports
import Konva from 'konva';
import { Line } from 'react-konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  VectorModel,
} from '@/types/CanvasObjectModel';
import type {
  EventCoords
} from '@/types/EventCoords';
import EditableVector from '@/components/EditableVector';
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

      addShapes([{
        type: 'vector',
        ...shapeAttributes,
        points: [xA, yA, xB, yB]
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
        <Line
          points={[xA, yA, xB, yB]}
          stroke="#888888"
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
    if (model.type !== 'vector') {
      return null;
    } else {
      const { strokeColor, strokeWidth, points } = model;

      return (
        <EditableVector<VectorModel>
          key={key}
          id={`${key}`}
          draggable={isDraggable}
          shapeModel={model}
          handleUpdateShapes={handleUpdateShapes}
        >
          <Line
            points={points}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </EditableVector>
      );
    }
  };

  const getAttributes = (): AttributeDefinition[] => getAttributesByShape('vector');

  const getTooltipText = () => {
    if (mouseDownCoords) {
      return 'Drag to desired length, then release';
    } else {
      return 'Click to draw a vector';
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
};// end useVectorDispatcher

export default useVectorDispatcher;
