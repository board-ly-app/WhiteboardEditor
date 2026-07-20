// === useSelectDispatcher.tsx =================================================
//
// Allows selecting multiple objects in a canvas in a selection box.
//
// =============================================================================

import {
  useState,
  useCallback,
  useContext,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import Konva from 'konva';

import {
  Rect,
} from 'react-konva';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  type AttributeDefinition,
} from '@/types/Attribute';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  selectCanvasObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  setSelectorsByCanvasObject,
} from '@/controllers';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  type OperationDispatcher,
} from '@/types/OperationDispatcher';

import {
  type EventCoords,
} from '@/types/EventCoords';

// === useSelectDispatcher =====================================================
// 
// Dispatcher for the Select tool. Preview displays selection box, which is used
// to select multiple objects.
//
// =============================================================================
const useSelectDispatcher = (): OperationDispatcher => {
  const [mouseDownCoords, setMouseDownCoords] = useState<EventCoords | null>(null);
  const [mouseCoords, setMouseCoords] = useState<EventCoords | null>(null);

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  const clientId = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  if (! clientId) throw new Error('No clientId provided to SelectDispatcher');

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

  const handleSelectShapes = useCallback(
    (originCoords: EventCoords, finalCoords: EventCoords) => {
      const currState : RootState = store.getState();
      const selectedCanvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);

      if (! selectedCanvasId) return;

      const canvasObjects = selectCanvasObjectsByCanvas(currState, selectedCanvasId);
      if (! canvasObjects) return;

      const { x: originX, y: originY } = originCoords;
      const { x: finalX, y: finalY } = finalCoords;

      const [minX, maxX] = (originX < finalX) ?
        [originX, finalX]
        : [finalX, originX]
      ;

      const [minY, maxY] = (originY < finalY) ?
        [originY, finalY]
        : [finalY, originY]
      ;

      // -- Locate all shapes between the origin and the final coordinates
      const selectedCanvasObjectIds : CanvasObjectIdType[] = [];

      for (const [objId, obj] of Object.entries(canvasObjects)) {
        switch (obj.type) {
          case 'rect':
          case 'text':
          {
            const { x: objX, y: objY } = obj;

            if (objX < minX) continue;
            if (objX > maxX) continue;
            if (objY < minY) continue;
            if (objY > maxY) continue;

            selectedCanvasObjectIds.push(objId);
          }
          break;
          case 'ellipse':
          {
            const { x: objX, y: objY } = obj;

            if (objX < minX) continue;
            if (objX > maxX) continue;
            if (objY < minY) continue;
            if (objY > maxY) continue;

            selectedCanvasObjectIds.push(objId);
          }
          break;
          case 'vector':
          {
            const { points } = obj;
            const [xA, yA, xB, yB] = points;
            const coords = [
              [xA, yA],
              [xB, yB],
            ];

            for (const [pointX, pointY] of coords) {
              if (pointX < minX) continue;
              if (pointX > maxX) continue;
              if (pointY < minY) continue;
              if (pointY > maxY) continue;

              selectedCanvasObjectIds.push(objId);
              break;
            }// -- end for (const [pointX, pointY] of coords)
          }
          break;
          default:
            throw new Error('ERROR: unrecognized object type');
        }// -- end switch (obj.type)
      }// -- end for obj

      setSelectorsByCanvasObject(
        store.dispatch,
        Object.fromEntries(
          selectedCanvasObjectIds.map(objId => [objId, clientId])
        )
      );
    },
    [whiteboardId, clientId]
  );// -- end handleSelectShapes

  const handlePointerUp = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      const pos = ev.currentTarget.getRelativePointerPosition();

      if (pos && mouseDownCoords) {
        handleSelectShapes(mouseDownCoords, pos);
        setMouseDownCoords(null);
      }
    },
    [handleSelectShapes, mouseDownCoords]
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
        return 'Drag to enclose the shapes to select, then release';
      } else {
        return 'Click to select shapes on this canvas.';
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
};

export default useSelectDispatcher;
