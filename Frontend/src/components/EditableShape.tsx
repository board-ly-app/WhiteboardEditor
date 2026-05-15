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

import {
  useSelector,
} from 'react-redux';

// Local imports
import {
  type RootState,
} from '@/store';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectSelectorByCanvasObject,
} from '@/store/activeUsers/activeUsersSelectors';

import type { 
  EditableObjectProps 
} from "@/dispatchers/editableObjectProps";

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
}: EditableShapeProps<ShapeType>) => {
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [snappingMonitor] = useState(new SnappingMonitor());

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context provided');
  }

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const clientId = useSelector((state: RootState) => selectClientId(state));

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id)
  );

  const isDraggable = draggable && ((! editor) || editor.clientId === clientId);

  useSnapping(shapeRef, snappingMonitor);

  const isSelected : boolean = useMemo(
    () => editor?.clientId === clientId,
    [editor, clientId]
  );

  // Transformer attach/detach
  useEffect(() => {
    if (!trRef.current || !shapeRef.current) return;
    trRef.current.nodes(editor ? [shapeRef.current] : []);
  }, [editor]);

  const handleSelect = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      ev.cancelBubble = true;

      if (! editor) {
        // -- Identify the current user as the current selector
        clientMessenger?.sendSelectedCanvasObject({
          type: 'selected_canvas_object',
          canvasObjectId: id,
        });
      }
    },
    [id, clientMessenger, editor]
  );

  // Click outside to deselect
  // TODO: move this functionality to the canvas level, to avoid sending
  // duplicate messages
  const unselectListener = useCallback(
    (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== shapeRef.current) {
        // -- Indicate that user has unselected object
        clientMessenger?.sendUnselectedCanvasObject({
          type: 'unselected_canvas_object',
          canvasObjectId: id,
        });
      }
    },
    [shapeRef, clientMessenger, id]
  );

  useEffect(() => {
    const stage = shapeRef.current?.getStage();
    if (!stage) return;

    stage.on("click", unselectListener);
    return () => {
      stage.off("click", unselectListener)
    };
  }, [unselectListener]);

  // Override onDragEnd to reselect at end
  const {
    onDragEnd,
  } = editableObjectProps(shapeModel, isDraggable, handleUpdateShapes);

  const shapeOnDragStart = useCallback(
    () => {
    },
    []
  );

  const shapeOnDragEnd = useCallback(
    (ev: Konva.KonvaEventObject<DragEvent>) => {
      if (onDragEnd) {
        onDragEnd(ev);
      }
    },
    [onDragEnd]
  );

  const shapeEditableProps = {
    ...editableObjectProps(shapeModel, isDraggable, handleUpdateShapes),
    onDragStart: shapeOnDragStart,
    onDragEnd: shapeOnDragEnd,
  };

  return (
    <Group>
      {React.cloneElement(children, {
        id,
        ref: shapeRef,
        draggable: isDraggable,
        onClick: handleSelect,
        onTap: handleSelect,
        ...shapeEditableProps,
      })}
      {editor && (
        <Transformer
          ref={trRef}
          borderEnabled={true}
          borderStroke={editor.color}
          borderStrokeWidth={(! isSelected) && 5 || undefined}
          resizeEnabled={isSelected}
          rotateEnabled={isSelected}
          flipEnabled={isSelected}
        />
      )}
    </Group>
  );
}

export default EditableShape;
