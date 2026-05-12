import React, { 
  useEffect, 
  useRef, 
  useCallback,
  useState,
  useContext,
} from "react";

import {
  useSelector,
} from 'react-redux';

import { 
  Group, 
  Transformer, 
  type KonvaNodeEvents 
} from "react-konva";

import type Konva from "konva";

// Local imports
import {
  store,
  type RootState,
} from '@/store';

import {
  selectSelectedCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  selectCurrentEditorByCanvasObject,
  selectClientColorByWhiteboard,
} from '@/store/activeUsers/activeUsersSelectors';

import type { 
  EditableObjectProps 
} from "@/dispatchers/editableObjectProps";

import {
  type UserSummary,
} from '@/types/WebSocketProtocol';

import type { 
  CanvasObjectIdType, 
  ShapeModel, 
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
  setSelectedCanvasObjects,
} from '@/controllers';
import {
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

interface EditableShapeProps<ShapeType extends ShapeModel> extends EditableObjectProps {
  id: string;
  shapeModel: ShapeType;
  draggable: boolean;
  handleUpdateShapes: (shapes: Record<CanvasObjectIdType, ShapeType>) => void;
  children: React.ReactElement<Konva.NodeConfig & KonvaNodeEvents>;
}

const EditableShape = <ShapeType extends ShapeModel> ({
  id,
  shapeModel,
  draggable,
  handleUpdateShapes,
  children,
  ...props
}: EditableShapeProps<ShapeType>) => {
  const dispatch = store.dispatch;
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [snappingMonitor] = useState(new SnappingMonitor());

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  useSnapping(shapeRef, snappingMonitor);

  const {
    user,
  }= useUser();

  if (! user) {
    throw new Error('No authenticated user');
  }

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const selectedCanvasObjectIds : Record<CanvasObjectIdType, CanvasObjectIdType> = useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
  );

  const userSummary : UserSummary | null = useSelector(
    (state: RootState) => selectCurrentEditorByCanvasObject(state, id)
  );

  const editorColor : string | null = useSelector(
    (state: RootState) => selectClientColorByWhiteboard(
      state, whiteboardId, userSummary?.clientId ?? null
    )
  );

  const isSelected = (id in selectedCanvasObjectIds);

  // Transformer attach/detach
  useEffect(() => {
    if (!trRef.current || !shapeRef.current) return;
    trRef.current.nodes(isSelected ? [shapeRef.current] : []);
  }, [isSelected]);

  const handleSelect = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      ev.cancelBubble = true;

      if ((! userSummary) || (userSummary.userId != user.id)) {
        // -- Identify the current user as the current selector
        clientMessenger?.sendSelectedCanvasObject({
          type: 'selected_canvas_object',
          canvasObjectId: id,
        });
        setSelectedCanvasObjects(dispatch, [id]);
      }
    },
    [dispatch, id, userSummary, user, clientMessenger]
  );

  // Click outside to deselect
  useEffect(() => {
    const stage = shapeRef.current?.getStage();
    if (!stage) return;

    const listener = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== shapeRef.current) {
        // -- Indicate that user has unselected object
        clientMessenger?.sendUnselectedCanvasObject({
          type: 'unselected_canvas_object',
          canvasObjectId: id,
        });
        setSelectedCanvasObjects(dispatch, []);
      }
    };

    stage.on("click", listener);
    return () => {
      stage.off("click", listener)
    };
  }, [dispatch, id, clientMessenger]);

  // Override onDragEnd to reselect at end
  const {
    onDragEnd,
  } = editableObjectProps(shapeModel, draggable, handleUpdateShapes);

  const shapeOnDragStart = useCallback(
    () => {
      setSelectedCanvasObjects(dispatch, []);
    },
    [dispatch]
  );

  const shapeOnDragEnd = useCallback(
    (ev: Konva.KonvaEventObject<DragEvent>) => {
      if (onDragEnd) {
        onDragEnd(ev);
      }
      setSelectedCanvasObjects(dispatch, [id]);
    },
    [dispatch, onDragEnd, id]
  );

  const shapeEditableProps = {
    ...editableObjectProps(shapeModel, draggable, handleUpdateShapes),
    onDragStart: shapeOnDragStart,
    onDragEnd: shapeOnDragEnd,
  };

  // -- used to indicate when the shape is selected by a user
  const selectedProps = editorColor ?
  {
    shadowColor: editorColor,
    shadowBlur: 20,
    shadowOpacity: 1.0,
  } : {};

  return (
    <Group>
      {React.cloneElement(children, {
        id,
        ref: shapeRef,
        draggable,
        onClick: handleSelect,
        onTap: handleSelect,
        ...shapeEditableProps,
        ...selectedProps,
        ...props
      })}
      {draggable && <Transformer ref={trRef} />}
    </Group>
  );
}

export default EditableShape;
