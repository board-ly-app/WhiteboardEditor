import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";

import Konva from "konva";

import lodash from 'lodash';

import { Circle, Group, Line, type KonvaNodeEvents } from "react-konva";

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
  selectUserHasAccessToCanvas,
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  selectCanvasObjectById,
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  useUser,
} from '@/hooks/useUser';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type VectorModel,
} from "@/types/CanvasObjectModel";
import {
  type EditableObjectProps,
} from "@/dispatchers/editableObjectProps";
import editableObjectProps from "@/dispatchers/editableObjectProps";
import {
  type ClientIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';
import {
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

export interface EditableVectorProps<VectorType extends VectorModel> extends EditableObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  model: VectorType;
  draggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
  children: React.ReactElement<Konva.NodeConfig & KonvaNodeEvents>;
}

const EditableVector = <VectorType extends VectorModel>({
  id,
  canvasId,
  model,
  draggable,
  onUpdateObject,
  children,
}: EditableVectorProps<VectorType>) => {
  const [localPoints, setLocalPoints] = useState(model.points);
  const vectorRef = useRef<Konva.Shape>(null);
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

  useSnapping(vectorRef, snappingMonitor);

  const clientId : ClientIdType | null = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id),
    lodash.isEqual
  );

  // -- Register canvas object ref
  useEffect(
    () => {
      canvasObjectRefsByIdRef.current[id] = vectorRef;

      return () => {
        delete canvasObjectRefsByIdRef.current[id];
      };
    },
    [id, canvasObjectRefsByIdRef]
  );// -- end registering canvas object ref

  const isSelected : boolean = useMemo(
    () => userHasCanvasAccess && (editor?.clientId === clientId),
    [userHasCanvasAccess, editor, clientId]
  );// -- end const isSelected

  // -- Register/unregister shape in selected objects ref
  useEffect(
    () => {
      if (isSelected) {
        selectedObjectRefsByIdRef.current[id] = vectorRef;
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

  const isDraggable : boolean = useMemo(
    () => draggable && (isSelected || (! editor)),
    [draggable, isSelected, editor]
  );

  // -- Ensure localPoints changes whenever the model's points change
  useEffect(
    () => {
      setLocalPoints(model.points);
    },
    [model.points, setLocalPoints]
  );// -- end useEffect

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
  );

  const handleAnchorDragMove = useCallback(
    (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const newPoints = [...localPoints];

      // Snap the line to exactly horizontal/vertical when close to the opposite endpoint's axis
      const fixedIndex = 1 - index;
      const fixedPoint = {
        x: localPoints[fixedIndex * 2],
        y: localPoints[fixedIndex * 2 + 1],
      };
      const snappedPos = snappingMonitor.onEndpointDragMove(e, fixedPoint);

      newPoints[index * 2] = snappedPos.x;
      newPoints[index * 2 + 1] = snappedPos.y;

      // Update local state and redraw the vector visually only
      setLocalPoints(newPoints);
      vectorRef.current?.setAttrs({ points: newPoints });
    },
    [localPoints, setLocalPoints, vectorRef, snappingMonitor]
  );

  const handleAnchorDragEnd = useCallback(
    (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
      snappingMonitor.onDragEnd(e);

      const node = e.target;
      const newPoints = [...localPoints];

      newPoints[index * 2] = node.x();
      newPoints[index * 2 + 1] = node.y();

      // Fire the global update ONCE at the end
      const update : VectorType = {
        ...model,
        points: newPoints,
      };

      onUpdateObject(update);
    },
    [localPoints, onUpdateObject, model, snappingMonitor]
  );

  useEffect(() => {
    setLocalPoints(model.points);
  }, [model.points]);

  const childStrokeWidth = (children.props.strokeWidth as number | undefined) ?? 2;

  // -- Reset x and y offsets whenever the model points change
  useEffect(
    () => {
      if (! vectorRef.current) return;

      const vector = vectorRef.current;

      vector.x(0);
      vector.y(0);
    },
    [model.points]
  );// -- end useEffect

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      handleSingleSelect(e);
    },
    [handleSingleSelect]
  );// -- end handleDragStart

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (! clientMessenger) return;

      const currState : RootState = store.getState();
      const canvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);
      if (! canvasId) return;

      const translateX = e.currentTarget.x();
      const translateY = e.currentTarget.y();

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
    [whiteboardId, clientMessenger, selectedObjectRefsByIdRef]
  );// -- end handleDragEnd

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const currState : RootState = store.getState();

      const translateX = e.currentTarget.x();
      const translateY = e.currentTarget.y();

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
    [id, selectedObjectRefsByIdRef]
  );// -- end handleDragMove

  // Override the onDragEnd handler for vectors to change points rather than x, y
  const vectorEditableProps = {
    ...editableObjectProps(model, isDraggable, onUpdateObject),
    ondragstart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
  };

  return (
    <Group>
      {editor && (
        <Line
          points={localPoints}
          stroke={editor.color}
          strokeWidth={childStrokeWidth + 6}
          lineCap={children.props.lineCap}
          lineJoin={children.props.lineJoin}
          listening={false}
        />
      )}
      {React.cloneElement(children, {
        id,
        ref: vectorRef,
        draggable: isDraggable,
        onClick: handleSingleSelect,
        onTap: handleSingleSelect,
        onDragStart: handleSingleSelect,
        hitStrokeWidth: 20,
        ...vectorEditableProps,
      })}

      {editor && (
        <>
          <Circle
            x={localPoints[0]}
            y={localPoints[1]}
            radius={6}
            fill="#ddd"
            stroke={editor.color}
            strokeWidth={2}
            draggable={isDraggable}
            onDragMove={(e) => handleAnchorDragMove(0, e)}
            onDragEnd={(e) => handleAnchorDragEnd(0, e)}
            onMouseOver={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'move'; // coordinate arrow
            }}
            onMouseOut={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
          />
          <Circle
            x={localPoints[2]}
            y={localPoints[3]}
            radius={6}
            fill="#ddd"
            stroke={editor?.color ?? "#5b6263ff"}
            strokeWidth={2}
            draggable={isDraggable}
            onDragMove={(e) => handleAnchorDragMove(1, e)}
            onDragEnd={(e) => handleAnchorDragEnd(1, e)}
            onMouseOver={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'move'; // coordinate arrow
            }}
            onMouseOut={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
          />
        </>
      )}
    </Group>
  );
};// -- end EditableVector

export default EditableVector;
