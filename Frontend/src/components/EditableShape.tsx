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

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import { 
  type CanvasObjectModel,
  type ShapeModel,
} from "@/types/CanvasObjectModel";

import editableObjectProps from "@/dispatchers/editableObjectProps";

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
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
    onDragStart: handleSelect,
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
        />
      )}
    </Group>
  );
}

export default EditableShape;
