import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  useSelector,
} from 'react-redux';

import Konva from "konva";

import { Circle, Group, type KonvaNodeEvents } from "react-konva";

import {
  store,
  type RootState,
} from '@/store';

import {
  selectSelectedCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  setSelectedCanvasObjects,
} from '@/controllers';

import type { CanvasObjectIdType, VectorModel } from "@/types/CanvasObjectModel";
import type { EditableObjectProps } from "@/dispatchers/editableObjectProps";
import editableObjectProps from "@/dispatchers/editableObjectProps";

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
  const dispatch = store.dispatch;
  const [localPoints, setLocalPoints] = useState(shapeModel.points);
  const vectorRef = useRef<Konva.Shape>(null);

  const selectedCanvasObjectIds : Record<CanvasObjectIdType, CanvasObjectIdType> = useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
  );
  const isSelected = (id in selectedCanvasObjectIds);

  const handleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      setSelectedCanvasObjects(dispatch, [id]);
    },
    [dispatch, id]
  );

  // Click outside to deselect
  useEffect(() => {
    const stage = vectorRef.current?.getStage();
    if (!stage) return;

    const listener = (ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (ev.target !== vectorRef.current) {
        setSelectedCanvasObjects(dispatch, []);
      }
    };

    stage.on("click", listener);
    return () => {
      stage.off("click", listener);
    };
  }, [dispatch]);

  const handleAnchorDragMove = useCallback(
    (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const newPoints = [...localPoints];

      newPoints[index * 2] = node.x();
      newPoints[index * 2 + 1] = node.y();

      // Update local state and redraw the vector visually only
      setLocalPoints(newPoints);
      vectorRef.current?.setAttrs({ points: newPoints });
    },
    [localPoints, setLocalPoints, vectorRef]
  );

  const handleAnchorDragEnd = useCallback(
    (index: number, e: Konva.KonvaEventObject<DragEvent>) => {
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
    },
    [localPoints, handleUpdateShapes, shapeModel, id]
  );

  const handleVectorDragEnd = useCallback(
    (ev: Konva.KonvaEventObject<DragEvent>) => {
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

      setSelectedCanvasObjects(dispatch, [id]);
    },
    [handleUpdateShapes, shapeModel, setLocalPoints, dispatch]
  );

  useEffect(() => {
    setLocalPoints(shapeModel.points);
  }, [shapeModel.points]);

  const handleVectorDragStart = useCallback(
    () => {
      setSelectedCanvasObjects(dispatch, []);
    },
    [dispatch]
  );

  // Override the onDragEnd handler for vectors to change points rather than x, y
  const vectorEditableProps = {
    ...editableObjectProps(shapeModel, draggable, handleUpdateShapes),
    onDragStart: () => handleVectorDragStart(),
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
