import React, 
{ 
  useContext,
  useEffect, 
  useRef, 
} from "react";
import { 
  Group, 
  Transformer, 
  type KonvaNodeEvents 
} from "react-konva";
import type Konva from "konva";

// Local imports
import type { 
  EditableObjectProps 
} from "@/dispatchers/editableObjectProps";
import type { 
  CanvasObjectIdType, 
  ShapeModel, 
} from "@/types/CanvasObjectModel";
import editableObjectProps from "@/dispatchers/editableObjectProps";
import WhiteboardContext from "@/context/WhiteboardContext";
import SnappingMonitor from "@/hooks/useSnapping";

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
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const snapping = new SnappingMonitor(shapeRef);

  snapping.useSnapping();

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const {
    selectedShapeIds,
    setSelectedShapeIds,
  } = whiteboardContext;
  const isSelected = selectedShapeIds.includes(id);

  // Transformer attach/detach
  useEffect(() => {
    if (!trRef.current || !shapeRef.current) return;
    trRef.current.nodes(isSelected ? [shapeRef.current] : []);
  }, [isSelected]);

  const handleSelect = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    ev.cancelBubble = true;
    setSelectedShapeIds([id]);
  }

  // Click outside to deselect
  useEffect(() => {
    const stage = shapeRef.current?.getStage();
    if (!stage) return;

    const listener = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== shapeRef.current) setSelectedShapeIds([]);
    };

    stage.on("click", listener);
    return () => {
      stage.off("click", listener)
    };
  }, [setSelectedShapeIds]);

  // Override onDragEnd to reselect at end
  const { onDragEnd } = editableObjectProps(shapeModel, draggable, handleUpdateShapes);
  const shapeOnDragEnd = (ev: Konva.KonvaEventObject<DragEvent>) => {
    if (onDragEnd) {
      onDragEnd(ev);
    }
    setSelectedShapeIds([id]);
  }

  const shapeEditableProps = {
    ...editableObjectProps(shapeModel, draggable, handleUpdateShapes),
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
        onDragStart: () => setSelectedShapeIds([]),
        ...shapeEditableProps,
        ...props
      })}
      {draggable && <Transformer ref={trRef} />}
    </Group>
  );
}

export default EditableShape;
