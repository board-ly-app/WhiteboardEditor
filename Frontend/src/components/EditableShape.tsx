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
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
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

  // Transformer attach/detach
  useEffect(() => {
    if (!trRef.current || !shapeRef.current) return;
    trRef.current.nodes(editor ? [shapeRef.current] : []);
  }, [editor]);

  const handleSingleSelect = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      ev.cancelBubble = true;

      if (clientMessenger && (! editor)) {
        const currState = store.getState();
        const selectedCanvasObjects = selectSelectedCanvasObjectsByWhiteboard(
          currState, whiteboardId, clientId
        );

        // -- Unselect any previously selected objects
        if (selectedCanvasObjects.length > 0) {
          clientMessenger.sendUnselectedCanvasObjects({
            type: 'unselected_canvas_objects',
            canvasObjectIds: selectedCanvasObjects,
          });
        }

        // -- Identify the current user as the current selector
        clientMessenger.sendSelectedCanvasObjects({
          type: 'selected_canvas_objects',
          canvasObjectIds: [id],
        });
      }
    },
    [id, whiteboardId, clientId, clientMessenger, editor]
  );

  // Override onDragEnd to reselect at end
  const editableProps = editableObjectProps(shapeModel, isDraggable, onUpdateObject);
  const {
    onDragEnd,
  } = editableProps;

  const shapeOnDragEnd = useCallback(
    (ev: Konva.KonvaEventObject<DragEvent>) => {
      if (onDragEnd) {
        onDragEnd(ev);
      }
    },
    [onDragEnd]
  );

  const shapeEditableProps = {
    ...editableProps,
    onDragStart: handleSingleSelect,
    onDragEnd: shapeOnDragEnd,
  };

  return (
    <Group>
      {React.cloneElement(children, {
        id,
        ref: shapeRef,
        draggable: isDraggable,
        onClick: handleSingleSelect,
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
