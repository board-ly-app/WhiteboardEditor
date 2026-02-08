import React, {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Konva from "konva";
import { Circle, Group, type KonvaNodeEvents } from "react-konva";
import type { CanvasObjectIdType, VectorModel } from "@/types/CanvasObjectModel";
import type { EditableObjectProps } from "@/dispatchers/editableObjectProps";
import editableObjectProps from "@/dispatchers/editableObjectProps";
import WhiteboardContext from "@/context/WhiteboardContext";
import {
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

interface EditableVectorProps<VectorType extends VectorModel> extends EditableObjectProps {
  id: string;
  shapeModel: VectorType;
  draggable: boolean;
  handleUpdateShapes: (shapes: Record<CanvasObjectIdType, VectorType>) => void;
  children: React.ReactElement<Konva.NodeConfig & KonvaNodeEvents>;
}

const EditableVector = <VectorType extends VectorModel>({
  id,
  shapeModel,
  draggable,
  handleUpdateShapes,
  children,
  ...props
}: EditableVectorProps<VectorType>) => {
  // const [isSelected, setIsSelected] = useState(false);
  const [localPoints, setLocalPoints] = useState(shapeModel.points);
  const vectorRef = useRef<Konva.Shape>(null);
  const [snappingMonitor] = useState(new SnappingMonitor());

  useSnapping(vectorRef, snappingMonitor);

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const {
    selectedShapeIds,
    setSelectedShapeIds,
  } = whiteboardContext;
  const isSelected = selectedShapeIds.includes(id);

  const handleSelect = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    setSelectedShapeIds([id]);
  };

  // Click outside to deselect
  useEffect(() => {
    const stage = vectorRef.current?.getStage();
    if (!stage) return;

    const listener = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== vectorRef.current) setSelectedShapeIds([]);
    };

    stage.on("click", listener);
    return () => {
      stage.off("click", listener);
    };
  }, [setSelectedShapeIds]);

  const handleAnchorDragMove = (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const newPoints = [...localPoints];

    newPoints[index * 2] = node.x();
    newPoints[index * 2 + 1] = node.y();

    // Update local state and redraw the vector visually only
    setLocalPoints(newPoints);
    vectorRef.current?.setAttrs({ points: newPoints });
  };

  const handleAnchorDragEnd = (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const newPoints = [...localPoints];

    newPoints[index * 2] = node.x();
    newPoints[index * 2 + 1] = node.y();

    // Fire the global update ONCE at the end
    handleUpdateShapes({
      [id]: {
        ...shapeModel,
        points: newPoints,
      } as VectorType,
    });
  };

  const handleVectorDragEnd = (ev: Konva.KonvaEventObject<DragEvent>) => {
    const id = ev.target.id();
    const node = ev.target;
    const dx = node.x();
    const dy = node.y();

    const updatedPoints = shapeModel.points.map((p, i) =>
      i % 2 === 0 ? p + dx : p + dy
    );

    // Prevent flicker by updating localPoints before broadcasting
    setLocalPoints(updatedPoints);
    vectorRef.current?.setAttrs({ points: updatedPoints });
    node.position({ x: 0, y: 0 });

    handleUpdateShapes({
      [id]: { ...shapeModel, points: updatedPoints } as VectorType,
    });

    setSelectedShapeIds([id]);;
  };


  useEffect(() => {
    setLocalPoints(shapeModel.points);
  }, [shapeModel.points]);


  // Override the onDragEnd handler for vectors to change points rather than x, y
  const vectorEditableProps = {
    ...editableObjectProps(shapeModel, draggable, handleUpdateShapes),
    onDragStart: () => setSelectedShapeIds([]),
    onDragEnd: handleVectorDragEnd,
  }

  return (
  <Group>
    {React.cloneElement(children, {
      id,
      ref: vectorRef,
      draggable,
      onClick: handleSelect,
      onTap: handleSelect,
      hitStrokeWidth: 20,
      ...vectorEditableProps,
      ...props,
    })}

    {isSelected && draggable && (
      <>
        <Circle
          x={localPoints[0]}
          y={localPoints[1]}
          radius={6}
          fill="#ddd"
          stroke="#5b6263ff"
          strokeWidth={2}
          draggable
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
          stroke="#5b6263ff"
          strokeWidth={2}
          draggable
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

};

export default EditableVector;
