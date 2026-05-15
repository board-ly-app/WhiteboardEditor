// === Canvas ==================================================================
//
// Component which allows users to draw within the browser.
//
// Makes use of react-konva. For documentation, see
// https://konvajs.org/docs/react/index.html.
//
// =============================================================================

import {
  useRef,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import {
  Group,
  Text,
  Rect,
} from 'react-konva';

import Konva from 'konva';

import {
  useSelector,
} from 'react-redux';

// -- local imports
import {
  KONVA_NODE_UI_ONLY_KEY,
} from '@/app.config';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  store,
  type RootState,
} from '@/store';

import {
  selectAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  selectCurrentEditorByCanvas,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  setSelectedCanvasByWhiteboard,
} from '@/controllers';

import {
  useUser,
} from '@/hooks/useUser';

import {
  type ToolChoice,
} from '@/components/Tool';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
  type CanvasData,
} from '@/types/WebSocketProtocol';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  type ShapeAttributesState,
} from '@/reducers/shapeAttributesReducer';

import type {
  OperationDispatcher,
} from '@/types/OperationDispatcher';

import {
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';

// -- dispatchers
import useMockDispatcher from '@/dispatchers/useMockDispatcher';
import useInaccessibleDispatcher from '@/dispatchers/useInaccessibleDispatcher';
import useRectangleDispatcher from '@/dispatchers/useRectangleDispatcher';
import useEllipseDispatcher from '@/dispatchers/useEllipseDispatcher';
import useVectorDispatcher from '@/dispatchers/useVectorDispatcher';
import useHandDispatcher from '@/dispatchers/useHandDispatcher';
import useTextDispatcher from '@/dispatchers/useTextDispatcher';
import useCreateCanvasDispatcher from '@/dispatchers/useCreateCanvasDispatcher';

export interface CanvasProps extends CanvasData {
  shapeAttributes: ShapeAttributesState;
  currentTool: ToolChoice;
  // -- should be fetched from selector in root calling component
  childCanvasesByCanvas: Record<CanvasIdType, Record<CanvasIdType, CanvasIdType>>;
  // -- should be fetched from selector in root calling component
  canvasesById: Record<CanvasIdType, CanvasData>;
  onSelectCanvasDimensions: (canvasId: CanvasIdType, dimensions: NewCanvasDimensions) => void;
}

const Canvas = (props: CanvasProps) => {
  const {
    id : canvasId,
    parentCanvas,
    width,
    height,
    shapes,
    shapeAttributes,
    currentTool,
    childCanvasesByCanvas,
    canvasesById,
    onSelectCanvasDimensions,
  } = props;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No Client Messenger context provided');
  }

  const dispatch = store.dispatch;

  const {
    whiteboardId,
    handleUpdateShapes,
    setCurrentTool,
    ownPermission,
    currentDispatcher,
    setCurrentDispatcher,
    canvasGroupRefsByIdRef,
    setTooltipText : setWhiteboardTooltipText,
    setEditingText,
  } = whiteboardContext;

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId)
  );

  const {
    clientMessenger,
  } = clientMessengerContext;

  const {
    user,
  } = useUser();

  const allowedUserIds = useSelector(
    // '' is effectively a null canvas id
    (state: RootState) => selectAllowedUsersByCanvas(state, canvasId || '')
  );

  const currentEditor : ClientSummary | null = useSelector((state: RootState) => (
    selectCurrentEditorByCanvas(state, canvasId)
  ));

  // const userHasAccess = user?.id
  //   ? allowedUserIds === undefined || allowedUserIds.length === 0 || allowedUserIds.includes(user.id)
  //   : false;
  const userHasAccess : boolean = useMemo(
    () => {
      if (user?.id) {
        return allowedUserIds === undefined
          || allowedUserIds.length === 0
          || allowedUserIds.includes(user.id);
      } else {
        return false;
      }
    },
    [user, allowedUserIds]
  );

  const groupRef = useRef<Konva.Group | null>(null);

  const handleObjectUpdateShapes = useCallback(
    (shapes: Record<CanvasObjectIdType, CanvasObjectModel>) => {
      handleUpdateShapes(canvasId, shapes);
    },
    [handleUpdateShapes, canvasId]
  );

  // In the future, we may wrap onAddShapes with some other logic.
  // For now, it's just an alias.
  const addShapes = useCallback(
    (shapes: CanvasObjectModel[]) => {
      if (clientMessenger) {
        clientMessenger.sendCreateShapes({
          type: 'create_shapes',
          canvasId,
          shapes
        });

        // Switch to hand tool after shape creation
        setCurrentTool("hand");
      }
    },
    [clientMessenger, setCurrentTool]
  );// -- end addShapes

  const notifyStartEditing = useCallback(
    () => {
      clientMessenger?.sendEditingCanvas({
        type: 'editing_canvas',
        canvasId,
      });
    },
    [clientMessenger]
  );// -- end notifyStartEditing
  
  const defaultDispatcher = useMockDispatcher({
    shapeAttributes,
    addShapes
  });
  const inaccessibleDispatcher = useInaccessibleDispatcher({
    shapeAttributes,
    addShapes
  });

  const handDispatcher = useHandDispatcher({
    shapeAttributes,
    addShapes,
    onStartEditing: notifyStartEditing,
  });

  const rectDispatcher = useRectangleDispatcher({
    shapeAttributes,
    addShapes,
    onStartEditing: notifyStartEditing,
  });

  const ellipseDispatcher = useEllipseDispatcher({
    shapeAttributes,
    addShapes,
    onStartEditing: notifyStartEditing,
  });

  const vectorDispatcher = useVectorDispatcher({
    shapeAttributes,
    addShapes,
    onStartEditing: notifyStartEditing,
  });

  const textDispatcher = useTextDispatcher({
    shapeAttributes,
    addShapes,
    onStartEditing: notifyStartEditing,
  });

  const createCanvasDispatcher = useCreateCanvasDispatcher({
    shapeAttributes,
    addShapes,
    onCreate: (dimensions: NewCanvasDimensions) => {
      onSelectCanvasDimensions(canvasId, dimensions);
    },
  });

  const getDispatcher: (tool: ToolChoice) => OperationDispatcher = useCallback(
    (tool: ToolChoice) => {
      if (! userHasAccess) {
        return inaccessibleDispatcher;
      } else {
        switch (tool) {
          case 'hand':
            return handDispatcher;
          case 'rect':
            return rectDispatcher;
          case 'ellipse':
            return ellipseDispatcher;
          case 'vector':
            return vectorDispatcher;
          case 'text':
            return textDispatcher;
          case 'create_canvas':
            return createCanvasDispatcher;
          default:
            return defaultDispatcher;
        }// -- end switch (currentTool)
      }
    },
    [
      userHasAccess,
      handDispatcher,
      rectDispatcher,
      ellipseDispatcher,
      vectorDispatcher,
      textDispatcher,
      createCanvasDispatcher,
      defaultDispatcher,
    ]
  );

  const dispatcher : OperationDispatcher = getDispatcher(currentTool);

  useEffect(() => {
    if (currentDispatcher !== dispatcher) {
      setCurrentDispatcher(dispatcher);
    }
  }, [currentTool]);

  // -- track ref to group enclosing the contents of this Canvas
  useEffect(
    () => {
      const canvasGroupRefsById = canvasGroupRefsByIdRef.current;

      canvasGroupRefsByIdRef.current[canvasId] = groupRef;

      // -- make sure to remove ref if Canvas is removed
      return () => {
        delete canvasGroupRefsById[canvasId];
      };
    },
    [canvasGroupRefsByIdRef, groupRef, canvasId]
  );

  const {
    getPreview,
    getTooltipText
  } = dispatcher;

  const handlePointerDown = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      ev.cancelBubble = true;

      if (selectedCanvasId === canvasId) {
        dispatcher.handlePointerDown(ev);
      }

      setSelectedCanvasByWhiteboard(dispatch, canvasId, whiteboardId);
    },
    [dispatch, whiteboardId, canvasId, dispatcher, selectedCanvasId]
  );// -- end handlePointerDown

  const handlePointerMove = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      ev.cancelBubble = true;

      dispatcher.handlePointerMove(ev);
    },
    [dispatcher]
  );

  const handlePointerUp = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      ev.cancelBubble = true;

      if (selectedCanvasId === canvasId) {
        dispatcher.handlePointerUp(ev);
      }

      setSelectedCanvasByWhiteboard(dispatch, canvasId, whiteboardId);
    },
    [dispatch, whiteboardId, canvasId, dispatcher, selectedCanvasId]
  );

  // TODO: delegate draggability to tool definitions
  const areShapesDraggable = ((ownPermission !== 'view') && (currentTool === 'hand') && userHasAccess);

  const tooltipText = useMemo(
    () => {
      if (ownPermission === 'view') {
        return "You are in view-only mode";
      } else {
        return getTooltipText();
      }
    },
    [ownPermission, getTooltipText]
  );

  useEffect(() => {
    setWhiteboardTooltipText(tooltipText);
  }, [tooltipText, setWhiteboardTooltipText]);

  const editingText = useMemo(
    () => {
      if (! currentEditor) {
        return '';
      } else if (currentEditor.userId === user?.id) {
        return "You are currently editing";
      } else {
        return `${currentEditor.username} is currently editing`;
      }
    },
    [currentEditor, user]
  );

  // Set editingText in context for main canvas
  useEffect(
    () => {
      if (currentEditor && (! parentCanvas)) {
        setEditingText(editingText);
      }
      else {
        setEditingText("");
      }
    },
    [editingText, currentEditor, setEditingText, parentCanvas]
  );

  const childCanvasesData : CanvasData[] = childCanvasesByCanvas[canvasId] ?
    Object.keys(childCanvasesByCanvas[canvasId]).map((childCanvasId: CanvasIdType) => canvasesById[childCanvasId] || null)
    .filter((canvas: CanvasData | null): canvas is CanvasData => !!canvas)
    : [];

  const {
    originX,
    originY,
  } = parentCanvas || {
      originX: 0,
      originY: 0,
  };

  // const isCanvasSelected = (canvasId === selectedCanvasId);
  const isCanvasSelected = useMemo(
    () => (canvasId === selectedCanvasId),
    [canvasId, selectedCanvasId]
  );

  const [canvasFrameColor, canvasFrameWidth] = useMemo(
    () => {
      if (currentEditor && (currentEditor.userId !== user?.id)) {
        return [currentEditor.color, 4];
      } else if (isCanvasSelected) {
        return ['green', 4];
      } else {
        return ['black', 1];
      }
    },
    [currentEditor, user, isCanvasSelected]
  );// -- end [canvasFrameColor, canvasFrameWidth]

  const handleMouseOver = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      ev.cancelBubble = true;

      const stage = ev.target.getStage();

      if (stage) {
        if (! isCanvasSelected) {
          // indicate that canvas is selectable
          stage.container().style.cursor = 'pointer';
        } else {
          stage.container().style.cursor = 'default';
        }
      }
    },
    [isCanvasSelected]
  );// -- end handleMouseOver

  const handleMouseOut = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent>) => {
      ev.cancelBubble = true;

      const stage = ev.target.getStage();

      if (stage) {
        if (! isCanvasSelected) {
          // indicate that canvas is selectable
          stage.container().style.cursor = 'default';
        }
      }
    },
    [isCanvasSelected]
  );// -- end handleMouseOut

  // get the CSS variable from :root (index.css)
  const rootStyles = getComputedStyle(document.documentElement);
  const canvasBackgroundColor = rootStyles.getPropertyValue('--canvas-background').trim();

  return (
    <Group
      ref={groupRef}
      x={originX}
      y={originY}
      width={width}
      height={height}
      clipWidth={width}
      clipHeight={height}
      onPointerdown={handlePointerDown}
      onPointermove={handlePointerMove}
      onPointerup={handlePointerUp}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      listening={ownPermission !== 'view'}
    >
      {/** White background **/}
      <Rect
        width={width}
        height={height}
        fill={canvasBackgroundColor}
      />

      <Group
        name={KONVA_NODE_UI_ONLY_KEY}
      >
        {/** Border **/}
        <Rect
          width={width}
          height={height}
          stroke={canvasFrameColor}
          strokeWidth={canvasFrameWidth}
        />

        {/** Display current editor, if given **/}
        {currentEditor && parentCanvas && (
          <Text
            text={editingText}
            fontSize={15}
            fontStyle="italic"
            height={height}
            verticalAlign="bottom"
          />
        )}

        {/** Preview Shape **/}
        {getPreview()}
      </Group>

      {/** Shapes **/}
      {
        Object.entries(shapes).filter(([_id, sh]) => !!sh).map(([id, shape]) => {
          const renderDispatcher = getDispatcher(shape.type);
          const {
            renderShape,
          } = renderDispatcher;

          return renderShape(
            id, shape, areShapesDraggable,
            handleObjectUpdateShapes
          );
        })
      }

      {/** Layer child canvases on top **/}
      {childCanvasesData && (
        childCanvasesData.map(canvasData => (
          <Canvas
            key={canvasData.id}
            {
              ...{
                ...props,
                ...canvasData
              }
            }
          />
        ))
      )}
    </Group>
  );
};

export default Canvas;
