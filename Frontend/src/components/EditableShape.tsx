import React, { 
  useEffect, 
  useRef, 
  useCallback,
  useState,
  useContext,
  useMemo,
} from "react";

import { 
  Group, 
  Transformer, 
  type KonvaNodeEvents 
} from "react-konva";

import type Konva from "konva";

import lodash from 'lodash';

import {
  useSelector,
} from 'react-redux';

// Local imports
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
  selectUserHasAccessToCanvas,
} from '@/store/canvases/canvasesSelectors';

import type { 
  EditableObjectProps 
} from "@/dispatchers/editableObjectProps";

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import { 
  type CanvasObjectModel,
  type ShapeModel,
} from "@/types/CanvasObjectModel";

import editableObjectProps from "@/dispatchers/editableObjectProps";

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  useUser,
} from '@/hooks/useUser';

import {
  ROTATION_SNAPS,
  ROTATION_SNAP_TOLERANCE,
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

interface EditableShapeProps<ShapeType extends ShapeModel> extends EditableObjectProps {
  id: string;
  canvasId: CanvasIdType;
  shapeModel: ShapeType;
  draggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
  onTransformEnd: (ev: Konva.KonvaEventObject<Event>) => unknown;
  children: React.ReactElement<Konva.NodeConfig & KonvaNodeEvents>;
}

const EditableShape = <ShapeType extends ShapeModel> ({
  id,
  canvasId,
  shapeModel,
  draggable,
  onUpdateObject,
  onTransformEnd,
  children,
}: EditableShapeProps<ShapeType>) => {
  const shapeRef = useRef<Konva.Shape>(null);
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

  const userHasCanvasAccess = useSelector(
    (state: RootState) => selectUserHasAccessToCanvas(state, canvasId, user.id),
    lodash.isEqual
  );// -- end const userHasCanvasAccess

  const isDraggable = draggable && ((! editor) || editor.clientId === clientId);

  useSnapping(shapeRef, snappingMonitor, trRef);

  // -- Register canvas object ref
  useEffect(
    () => {
      canvasObjectRefsByIdRef.current[id] = shapeRef;

      return () => {
        delete canvasObjectRefsByIdRef.current[id];
      };
    },
    [id, canvasObjectRefsByIdRef]
  );

  const anchorDragBoundFunc = useCallback(
    (oldPos: Konva.Vector2d, newPos: Konva.Vector2d) =>
      trRef.current
        ? snappingMonitor.getAnchorBoundPosition(trRef.current, oldPos, newPos)
        : newPos,
    [snappingMonitor]
  );

  const isSelected : boolean = useMemo(
    () => userHasCanvasAccess && (editor?.clientId === clientId),
    [userHasCanvasAccess, editor, clientId]
  );// -- end const isSelected

  // -- Register/unregister shape in selected objects ref
  useEffect(
    () => {
      if (isSelected) {
        selectedObjectRefsByIdRef.current[id] = shapeRef;
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

  // Transformer attach/detach
  useEffect(() => {
    if (!trRef.current || !shapeRef.current) return;
    trRef.current.nodes(editor ? [shapeRef.current] : []);
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

  // Override onDragEnd to reselect at end
  const editableProps = editableObjectProps(shapeModel, isDraggable, onUpdateObject);

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (! clientMessenger) return;

      const currState : RootState = store.getState();
      const canvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);
      if (! canvasId) return;

      const translateX = e.currentTarget.x() - shapeModel.x;
      const translateY = e.currentTarget.y() - shapeModel.y;

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
            case 'image':
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
    [whiteboardId, clientMessenger, selectedObjectRefsByIdRef, shapeModel.x, shapeModel.y]
  );// -- end handleDragEnd

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const currState : RootState = store.getState();
      const translateX = e.currentTarget.x() - shapeModel.x;
      const translateY = e.currentTarget.y() - shapeModel.y;

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
          case 'image':
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
    [id, selectedObjectRefsByIdRef, shapeModel.x, shapeModel.y]
  );// -- end handleDragMove

  const shapeEditableProps = {
    ...editableProps,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  };

  return (
    <Group>
      {React.cloneElement(children, {
        id,
        ref: shapeRef,
        draggable: isDraggable,
        onClick: handleSingleSelect,
        onDragStart: handleSingleSelect,
        onTap: handleSingleSelect,
        onTransformEnd,
        ...shapeEditableProps,
      })}
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
        />
      )}
    </Group>
  );
}

export default EditableShape;
