import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";

import Konva from "konva";

import { Circle, Group, Line, type KonvaNodeEvents } from "react-konva";

import {
  useSelector,
} from 'react-redux';

import {
  type RootState,
} from '@/store';

import {
  selectSelectorByCanvasObject,
} from '@/store/activeUsers/activeUsersSelectors';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  useUser,
} from '@/hooks/useUser';

import type { CanvasObjectIdType, VectorModel } from "@/types/CanvasObjectModel";
import type { EditableObjectProps } from "@/dispatchers/editableObjectProps";
import editableObjectProps from "@/dispatchers/editableObjectProps";
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
}: EditableVectorProps<VectorType>) => {
  const [localPoints, setLocalPoints] = useState(shapeModel.points);
  const vectorRef = useRef<Konva.Shape>(null);
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

  const {
    user,
  } = useUser();

  if (! user) {
    throw new Error('No authenticated user provided');
  }

  useSnapping(vectorRef, snappingMonitor);

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id)
  );

  const isSelected = useMemo(
    () => user.id === editor?.userId,
    [user, editor]
  );

  const handleSelect = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;

      if (! editor) {
        clientMessenger?.sendSelectedCanvasObject({
          type: 'selected_canvas_object',
          canvasObjectId: id,
        });
      }
    },
    [id, clientMessenger, editor]
  );

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
    },
    [handleUpdateShapes, shapeModel, setLocalPoints]
  );

  useEffect(() => {
    setLocalPoints(shapeModel.points);
  }, [shapeModel.points]);

  const handleVectorDragStart = useCallback(
    () => {
    },
    []
  );

  // Override the onDragEnd handler for vectors to change points rather than x, y
  const vectorEditableProps = {
    ...editableObjectProps(shapeModel, draggable, handleUpdateShapes),
    onDragStart: () => handleVectorDragStart(),
    onDragEnd: handleVectorDragEnd,
  }

  const childStrokeWidth = (children.props.strokeWidth as number | undefined) ?? 2;

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
        draggable,
        onClick: handleSelect,
        onTap: handleSelect,
        hitStrokeWidth: 20,
        ...vectorEditableProps,
      })}

      {isSelected && draggable && (
        <>
          <Circle
            x={localPoints[0]}
            y={localPoints[1]}
            radius={6}
            fill="#ddd"
            stroke={editor?.color ?? "#5b6263ff"}
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
            stroke={editor?.color ?? "#5b6263ff"}
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
