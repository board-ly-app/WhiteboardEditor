import Konva from 'konva';

import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';

// === useInaccessibleDispatcher ===============================================
//
// Used for keeping users from accessing inaccessible canvases.
//
// =============================================================================
const useInaccessibleDispatcher = (_props: OperationDispatcherProps<null>): OperationDispatcher => {
  return ({
    handlePointerDown: (_ev: Konva.KonvaEventObject<MouseEvent>) => {
      console.log("You don't have access to this canvas");
    },
    handlePointerMove: (_ev: Konva.KonvaEventObject<MouseEvent>) => null,
    handlePointerUp: (_ev: Konva.KonvaEventObject<MouseEvent>) => null,
    handleCancel: () => null,
    getPreview: () => null,
    getAttributes: () => [],
    getTooltipText: () => "You don't have access to this canvas"
  });
};

export default useInaccessibleDispatcher;
