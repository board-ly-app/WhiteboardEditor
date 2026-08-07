// --- std imports
import {
  useState,
  useCallback,
  useContext,
} from 'react';

// --- third-party imports
import {
  useSelector,
} from 'react-redux';
import Konva from 'konva';
import { Rect } from 'react-konva';

// --- local imports
import {
  type OperationDispatcher,
} from '@/types/OperationDispatcher';

import type {
  EventCoords
} from '@/types/EventCoords';
import type { AttributeDefinition } from '@/types/Attribute';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectCreateCanvasFlowState,
} from '@/store/userFlows/createCanvas/createCanvasSelectors';

import {
  setCreateCanvasReady,
} from '@/store/userFlows/createCanvas/createCanvasSlice';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import WhiteboardContext from '@/context/WhiteboardContext';

// === useCreateCanvasDispatcher ===============================================
//
// Tool for drawing rectangles.
//
// =============================================================================
const useCreateCanvasDispatcher = (): OperationDispatcher => {
  const whiteboardContext = useContext(WhiteboardContext);
  if (! whiteboardContext) throw new Error('No WhiteboardContext provided');

  const {
    whiteboardId,
  } = whiteboardContext;

  const componentState = useSelector(
    (state: RootState) => selectCreateCanvasFlowState(state)
  );
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
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (! pos) return;
      if (! mouseDownCoords) return;

      const currState = store.getState();
      const currCanvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);
      if (! currCanvasId) throw new Error('No canvas currently selected');

      const { x: xA, y: yA } = pos;
      const { x: xB, y: yB } = mouseDownCoords;
      const xMin = Math.min(xA, xB);
      const yMin = Math.min(yA, yB);
      const width = Math.abs(xA - xB);
      const height = Math.abs(yA - yB);

      store.dispatch(setCreateCanvasReady({
        width,
        height,
        parentCanvasId: currCanvasId,
        originX: xMin,
        originY: yMin,
      }));
      setMouseDownCoords(null);
    },
    [whiteboardId, mouseDownCoords]
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
        switch (componentState.status) {
          case 'inactive':
            return null;
          case 'ready':
          case 'requesting':
            return (
              <Rect
                x={componentState.originX}
                y={componentState.originY}
                width={componentState.width}
                height={componentState.height}
                stroke="black"
                dash={[10, 10]}
              />
            );
        }// -- end switch (componentState.status)
      }
    },
    [componentState, mouseCoords, mouseDownCoords]
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
