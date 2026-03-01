import Konva from 'konva';

import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';
import type {
  CanvasObjectIdType,
  CanvasObjectModel
} from '@/types/CanvasObjectModel';

// === useMockDispatcher =======================================================
// Use as a dummy for unimplemented functionalities.
//
// =============================================================================
const useMockDispatcher = (_props: OperationDispatcherProps<null>): OperationDispatcher => {
  return ({
    handlePointerDown: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      console.log('TODO: implement');
    },
    handlePointerMove: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      console.log('TODO: implement');
    },
    handlePointerUp: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      console.log('TODO: implement');
    },
    handleCancel: () => {
      console.log('TODO: implement');
    },
    getPreview: () => null,
    getAttributes: () => [],
    renderShape: (
      _key: string | number,
      _model: CanvasObjectModel,
      _isDraggable: boolean,
      _handleUpdateShapes: (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => void
    ) => null,
    getTooltipText: () => "TODO: implement"
  });
};

export default useMockDispatcher;
