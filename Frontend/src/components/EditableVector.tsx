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
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectSelectorByCanvasObject,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import type { CanvasObjectIdType, CanvasObjectModel, VectorModel } from "@/types/CanvasObjectModel";
import type { EditableObjectProps } from "@/dispatchers/editableObjectProps";
import editableObjectProps from "@/dispatchers/editableObjectProps";
import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';
import {
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

export interface EditableVectorProps<VectorType extends VectorModel> extends EditableObjectProps {
  id: CanvasObjectIdType;
  model: VectorType;
  draggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
  children: React.ReactElement<Konva.NodeConfig & KonvaNodeEvents>;
}

const EditableVector = <VectorType extends VectorModel>({
  id,
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

  useSnapping(vectorRef, snappingMonitor);

  const clientId : ClientIdType | null = useSelector(
    (state: RootState) => selectClientId(state)
  );

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id)
  );

  const isSelected = useMemo(
    () => editor?.clientId === clientId,
    [editor, clientId]
  );

  const isDraggable : boolean = useMemo(
    () => draggable && (isSelected || (! editor)),
    [draggable, isSelected, editor]
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
      const update : VectorType = {
        ...model,
        points: newPoints,
      };

      onUpdateObject(update);
    },
    [localPoints, onUpdateObject, model]
  );

  const handleVectorDragEnd = useCallback(
    (ev: Konva.KonvaEventObject<DragEvent>) => {
      const node = ev.target;
      const dx = node.x();
      const dy = node.y();

      const updatedPoints = model.points.map((p, i) =>
        i % 2 === 0 ? p + dx : p + dy
      );

      // Prevent flicker by updating localPoints before broadcasting
      setLocalPoints(updatedPoints);
      vectorRef.current?.setAttrs({ points: updatedPoints });
      node.position({ x: 0, y: 0 });

      const update : VectorType = {
        ...model,
        points: updatedPoints,
      };

      onUpdateObject(update);
    },
    [onUpdateObject, model, setLocalPoints]
  );

  useEffect(() => {
    setLocalPoints(model.points);
  }, [model.points]);

  // Override the onDragEnd handler for vectors to change points rather than x, y
  const vectorEditableProps = {
    ...editableObjectProps(model, isDraggable, onUpdateObject),
    onDragStart: handleSelect,
    onDragEnd: handleVectorDragEnd,
  };

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
        draggable: isDraggable,
        onClick: handleSelect,
        onTap: handleSelect,
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
};

export default EditableVector;
