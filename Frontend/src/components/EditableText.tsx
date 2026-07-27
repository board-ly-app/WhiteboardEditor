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
  selectCanvasObjectById,
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  selectUserHasAccessToCanvas,
} from '@/store/canvases/canvasesSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import WhiteboardContext from '@/context/WhiteboardContext';

import TextEditor from "./TextEditor";

import { shadowProps } from '@/lib/shadowProps';

import {
  type EditableObjectProps,
} from "@/dispatchers/editableObjectProps";

import {
  type CanvasObjectIdType,
  type ShapeModel,
  type TextAlign,
  type TextRecord,
  type TextVerticalAlign,
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
  align?: TextAlign;
  verticalAlign?: TextVerticalAlign;
  shadow?: boolean;
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
  align,
  verticalAlign,
  shadow,
  draggable,
  record,
  onUpdateObject,
  onMouseOver,
  onMouseOut,
  onMouseDown,
  onMouseUp,
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
    canvasObjectRefsByIdRef,
    selectedObjectRefsByIdRef,
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

  // -- Register canvas object ref
  useEffect(
    () => {
      canvasObjectRefsByIdRef.current[id] = textRef;

      return () => {
        delete canvasObjectRefsByIdRef.current[id];
      };
    },
    [id, canvasObjectRefsByIdRef]
  );// -- end registering canvas object ref

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

  if (! clientId) {
    throw new Error('No clientId provided');
  }

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id),
    lodash.isEqual
  );

  const isSelected : boolean = useMemo(
    () => userHasCanvasAccess && (editor?.clientId === clientId),
    [userHasCanvasAccess, editor, clientId]
  );// -- end const isSelected

  // -- Register/unregister shape in selected objects ref
  useEffect(
    () => {
      if (isSelected) {
        selectedObjectRefsByIdRef.current[id] = textRef;
      } else if (id in selectedObjectRefsByIdRef.current) {
        delete selectedObjectRefsByIdRef.current[id];
      }

      return () => {
        if (id in selectedObjectRefsByIdRef.current) {
          delete selectedObjectRefsByIdRef.current[id];
        }
      };
    },
    [id, isSelected, selectedObjectRefsByIdRef]
  );

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
        if (e.evt.ctrlKey || e.evt.metaKey) {
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

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (! clientMessenger) return;

      const currState : RootState = store.getState();
      const canvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);
      if (! canvasId) return;

      const translateX = e.currentTarget.x() - x;
      const translateY = e.currentTarget.y() - y;

      const selectedObjectRefsById = selectedObjectRefsByIdRef.current;
      const updatedObjects = Object.fromEntries(Object.entries(selectedObjectRefsById).map(
        ([objId, objRef]) => {
          if (! objRef.current) return null;

          const prevObj = selectCanvasObjectById(currState, objId);
          if (! prevObj) return null;

          switch (prevObj.type) {
            case 'rect':
            case 'ellipse':
            case 'text':
            {
              const objUpdate = ({
                ...prevObj,
                x: prevObj.x + translateX,
                y: prevObj.y + translateY,
              });

              return [objId, objUpdate];
            }
            case 'vector':
            {
              const objUpdate = ({
                ...prevObj,
                points: prevObj.points.map((val, i) => {
                  if (i % 2 === 0) {
                    return val + translateX;
                  } else {
                    return val + translateY;
                  }
                }),
              });

              return [objId, objUpdate];
            }
            default:
              throw new Error('ERROR: unrecognized object type');
          }// -- end switch (prevObj.type)
        }
      ).filter(entry => !! entry));

      clientMessenger.sendUpdateCanvasObjects({
        type: 'update_canvas_objects',
        canvasId,
        canvasObjects: updatedObjects,
      });
    },
    [whiteboardId, clientMessenger, selectedObjectRefsByIdRef, x, y]
  );// -- end handleDragEnd

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const currState : RootState = store.getState();
      const translateX = e.currentTarget.x() - x;
      const translateY = e.currentTarget.y() - y;

      for (const [objId, objRef] of Object.entries(selectedObjectRefsByIdRef.current)) {
        if (objId === id) continue;
        if (! objRef.current) continue;

        const obj = objRef.current;
        const prevObj = selectCanvasObjectById(currState, objId);
        if (! prevObj) continue;

        switch (prevObj.type) {
          case 'rect':
          case 'ellipse':
          case 'text':
          {
            obj.x(prevObj.x + translateX);
            obj.y(prevObj.y + translateY);
          }
          break;
          case 'vector':
          {
            const vec = obj as Konva.Line;
            const pointsUpdate = prevObj.points.map((val, i) => {
              if (i % 2 === 0) {
                return val + translateX;
              } else {
                return val + translateY;
              }
            });

            vec.points(pointsUpdate);
          }
          break;
          default:
            throw new Error('Unrecognized object type');
        }// -- end switch (prevObj.type)
      }// -- end 
    },
    [id, selectedObjectRefsByIdRef, x, y]
  );// -- end handleDragMove

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
        align={align ?? 'left'}
        verticalAlign={verticalAlign ?? 'top'}
        {...shadowProps(shadow)}
        draggable={draggable}
        onClick={handleSingleSelect}
        onTap={handleSingleSelect}
        onDblClick={handleTextDblClick}
        onDblTap={handleTextDblClick}
        listening={!isEditing && draggable}
        visible={!isEditing}
        onDragStart={handleSingleSelect}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
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
};// -- end EditableText

export default EditableText;
