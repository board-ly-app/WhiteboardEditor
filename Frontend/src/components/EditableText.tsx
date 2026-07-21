import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";

import {
  Group,
  Text,
  Transformer,
} from 'react-konva';

import Konva from "konva";

import lodash from 'lodash';

import {
  useSelector,
} from 'react-redux';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectSelectorByCanvasObject,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  selectUserHasAccessToCanvas,
} from '@/store/canvases/canvasesSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import WhiteboardContext from '@/context/WhiteboardContext';

import TextEditor from "./TextEditor";

import {
  type EditableObjectProps,
} from "@/dispatchers/editableObjectProps";

import {
  type CanvasObjectIdType,
  type ShapeModel,
  type TextRecord,
} from "@/types/CanvasObjectModel";

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  useUser,
} from '@/hooks/useUser';

import {
  ROTATION_SNAPS,
  ROTATION_SNAP_TOLERANCE,
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

export interface EditableTextProps extends EditableObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType,
  fontSize: number;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  draggable: boolean;
  record: TextRecord;
  onUpdateObject: (updatedObject: ShapeModel) => unknown;
}

const EditableText = ({
  id,
  canvasId,
  fontSize,
  text,
  color,
  x,
  y,
  width,
  height,
  rotation,
  draggable,
  record,
  onUpdateObject,
  onMouseOver,
  onMouseOut,
  onMouseDown,
  onMouseUp,
  onDragEnd,
  onTransform,
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const textRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [snappingMonitor] = useState(new SnappingMonitor());
  
  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  const {
    user,
  } = useUser();

  if (! user) {
    throw new Error('No authenticated user provided');
  }

  const userHasCanvasAccess = useSelector(
    (state: RootState) => selectUserHasAccessToCanvas(state, canvasId, user.id),
    lodash.isEqual
  );// -- end const userHasCanvasAccess

  useSnapping(textRef, snappingMonitor, trRef);

  const anchorDragBoundFunc = useCallback(
    (oldPos: Konva.Vector2d, newPos: Konva.Vector2d) =>
      trRef.current
        ? snappingMonitor.getAnchorBoundPosition(trRef.current, oldPos, newPos)
        : newPos,
    [snappingMonitor]
  );

  const clientId = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id),
    lodash.isEqual
  );

  const isSelected : boolean = useMemo(
    () => userHasCanvasAccess && (editor?.clientId === clientId),
    [userHasCanvasAccess, editor, clientId]
  );// -- end const isSelected

  // attach Transformer for editing when selected
  useEffect(() => {
    if (!trRef.current || !textRef.current) return;
    trRef.current.nodes(editor ? [textRef.current] : []);
  }, [editor]);
  
  const handleSingleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;

      if (clientMessenger) {
        const currState = store.getState();
        const selectedCanvasObjects = selectSelectedCanvasObjectsByWhiteboard(
          currState, whiteboardId, clientId
        );

        // -- Control key signals unselect target
        if (e.evt.ctrlKey) {
          if (editor?.clientId === clientId) {
            // -- Identify the current user as the current selector
            clientMessenger.sendUnselectedCanvasObjects({
              type: 'unselected_canvas_objects',
              canvasObjectIds: [id],
            });
          }
        } else if (! editor) {
          // -- Shift key indicates multi select
          if (! e.evt.shiftKey) {
            // -- Unselect any previously selected objects
            if (selectedCanvasObjects.length > 0) {
              clientMessenger.sendUnselectedCanvasObjects({
                type: 'unselected_canvas_objects',
                canvasObjectIds: selectedCanvasObjects,
              });
            }
          }

          // -- Identify the current user as the current selector
          clientMessenger.sendSelectedCanvasObjects({
            type: 'selected_canvas_objects',
            canvasObjectIds: [id],
          });
        }
      }
    },
    [id, whiteboardId, clientId, clientMessenger, editor]
  );// -- end handleSingleSelect

  const handleTextDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!draggable) return;

    e.cancelBubble = true;

    setIsEditing(true);
    // setIsSelected(false); 
  }, [draggable]);

  const handleTextChange = useCallback(
    (newText: string): void => {
      const node = textRef.current;
      if (!node) return;

      const update = {
        ...record,
        text: newText,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation: node.rotation(),
      };

      onUpdateObject(update);
    },
    [onUpdateObject, record]
  );

  const handleTransformEnd = useCallback(
    (ev: Konva.KonvaEventObject<Event>) => {
      ev.cancelBubble = true;
      
      const node = ev.target;
      const rotation = node.rotation();
      
      const update = {
        ...record,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation,
      };

      onUpdateObject(update);
    },
    [onUpdateObject, record]
  );

  return (
    <Group>
      <Text
        id={id}
        ref={textRef}
        text={text}
        fontSize={fontSize}
        fill={color}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        draggable={draggable}
        onClick={handleSingleSelect}
        onTap={handleSingleSelect}
        onDblClick={handleTextDblClick}
        onDblTap={handleTextDblClick}
        listening={!isEditing && draggable}
        visible={!isEditing}
        onDragStart={handleSingleSelect}
        onDragEnd={onDragEnd}
        onMouseUp={onMouseUp}
        onMouseDown={onMouseDown}
        onMouseOut={onMouseOut}
        onMouseOver={onMouseOver}
        onTransform={onTransform}
        onTransformEnd={handleTransformEnd}
      />
      {isEditing && textRef.current && draggable && (
        <TextEditor
          textNode={textRef.current}
          onClose={(newText) => {
            handleTextChange(newText);
            setIsEditing(false);
          }}
        />
      )} 
      {editor && (
        <Transformer
          ref={trRef}
          borderEnabled={true}
          borderStroke={editor.color}
          borderStrokeWidth={(! isSelected) && 4 || undefined}
          resizeEnabled={isSelected}
          rotateEnabled={isSelected}
          flipEnabled={isSelected}
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={ROTATION_SNAP_TOLERANCE}
          anchorDragBoundFunc={anchorDragBoundFunc}
          boundBoxFunc={(_oldBox, newBox) => ({
            ...newBox,
            width: Math.max(30, newBox.width),
            height: Math.max(30, newBox.height),
          })}
        />
      )}
    </ Group>
  );
}

export default EditableText;
