// -- third-party imports
import Konva from 'konva';

// --- local imports
import type {
  OperationDispatcher,
  OperationDispatcherProps
} from '@/types/OperationDispatcher';

import type { AttributeDefinition } from '@/types/Attribute';

// === useImportImageDispatcher ================================================
//
// Tool for importing images. All interaction happens through the
// ImportImageMenu panel in the sidebar, so pointer events on the canvas are
// no-ops.
//
// =============================================================================
const useImportImageDispatcher = (
  _props: OperationDispatcherProps<null>
): OperationDispatcher => {
  return ({
    handlePointerDown: (_ev: Konva.KonvaEventObject<MouseEvent>) => {},
    handlePointerMove: (_ev: Konva.KonvaEventObject<MouseEvent>) => {},
    handlePointerUp: (_ev: Konva.KonvaEventObject<MouseEvent>) => {},
    handleCancel: () => {},
    getPreview: () => null,
    getAttributes: (): AttributeDefinition[] => [],
    getTooltipText: () => 'Choose an image to import from the sidebar',
  });
};// end useImportImageDispatcher

export default useImportImageDispatcher;
