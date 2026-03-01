import {
  useState
} from 'react';

import Konva from 'konva';

import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  CanvasObjectIdType,
  CanvasObjectModel
} from '@/types/CanvasObjectModel';

// === useHandDispatcher =======================================================
// 
// Dispatcher for the Hand tool. Unlike other tools, doesn't generate a preview
// or render shapes.
//
// =============================================================================
const useHandDispatcher = ({
  onStartEditing,
}: OperationDispatcherProps<null>): OperationDispatcher => {
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);

  return ({
    handlePointerDown: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      setIsMouseDown(true);

      if (onStartEditing) {
        onStartEditing();
      }
    },
    handlePointerMove: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      // Nothing to do
    },
    handlePointerUp: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      setIsMouseDown(false);
    },
    handleCancel: () => {
      setIsMouseDown(false);
    },
    getPreview: () => null,
    getAttributes: () => [],
    renderShape: (
      _key: string | number,
      _model: CanvasObjectModel,
      _isDraggable: boolean,
      _handleUpdateShapes: (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => void
    ) => null,
    getTooltipText: () => isMouseDown ? "Drag shape(s) to desired location" : "Grab a shape to move its location"
  });
};

export default useHandDispatcher;
