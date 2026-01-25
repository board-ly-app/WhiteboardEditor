import React, { 
  useEffect, 
  useRef, 
  useCallback,
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

import type { 
  EditableObjectProps 
} from "@/dispatchers/editableObjectProps";

import type { 
  CanvasObjectIdType, 
  ShapeModel, 
} from "@/types/CanvasObjectModel";

import editableObjectProps from "@/dispatchers/editableObjectProps";

import {
  setSelectedCanvasObjects,
} from '@/controllers';

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

  const selectedCanvasObjectIds : Record<CanvasObjectIdType, CanvasObjectIdType> = useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
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
      setSelectedCanvasObjects(dispatch, [id]);
    },
    [dispatch, id]
  );

  // Click outside to deselect
  useEffect(() => {
    const stage = shapeRef.current?.getStage();
    if (!stage) return;

    const listener = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== shapeRef.current) {
        setSelectedCanvasObjects(dispatch, []);
      }
    };

    stage.on("click", listener);
    return () => {
      stage.off("click", listener)
    };
  }, [dispatch]);

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
  }

  return (
    <Group>
      {React.cloneElement(children, {
        id,
        ref: shapeRef,
        draggable,
        onClick: handleSelect,
        onTap: handleSelect,
        ...shapeEditableProps,
        ...props
      })}
      {draggable && <Transformer ref={trRef} />}
    </Group>
  );
}

export default EditableShape;
