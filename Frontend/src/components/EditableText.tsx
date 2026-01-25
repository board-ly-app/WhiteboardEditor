import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  useSelector,
} from 'react-redux';

import {
  Group,
  Text,
  Transformer,
} from 'react-konva';

import Konva from "konva";

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

import TextEditor from "./TextEditor";

import { type EditableObjectProps } from "@/dispatchers/editableObjectProps";
import type { CanvasObjectIdType, ShapeModel, TextModel } from "@/types/CanvasObjectModel";

interface EditableTextProps extends EditableObjectProps {
  id: string;
  fontSize: number;
  text: string;
  color: string;
  x: number;
  y: number;
  width: number;    
  height: number;   
  rotation: number;
  draggable: boolean; 
  shapeModel: TextModel;
  handleUpdateShapes: (shapes: Record<CanvasObjectIdType, ShapeModel>) => void
}

const EditableText = ({
  id,
  fontSize,
  text,
  color,
  x,
  y,
  width,
  height,
  rotation,
  draggable,
  shapeModel,
  handleUpdateShapes,
  onMouseOver,
  onMouseOut,
  onMouseDown,
  onMouseUp,
  onDragEnd,
  onTransform,
  onTransformEnd,
}: EditableTextProps) => {
  const dispatch = store.dispatch;
  const [isSelected, setIsSelected] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const textRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const selectedCanvasObjectIds : Record<CanvasObjectIdType, CanvasObjectIdType> = useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
  );

  useEffect(() => {
    setIsSelected(id in selectedCanvasObjectIds);
  }, [selectedCanvasObjectIds, setIsSelected, id]);

  // attach Transformer for editing when selected
  useEffect(() => {
    if (trRef.current) {
      if (isSelected && textRef.current) {
        trRef.current.nodes([textRef.current]);
      }
      else {
        trRef.current.nodes([]);
      }
    }
  }, [isSelected])
  
  const handleSelect = useCallback((ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    ev.cancelBubble = true;

    if (! isEditing) {
      setIsSelected(true);
      setSelectedCanvasObjects(dispatch, [id]);
    }
  }, [isEditing, dispatch, id]);

  // deselect when clicking outside of text node
  useEffect(() => {
    if (isEditing) return;

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.evt.detail === 2) {
        return;
      }
      if (e.target !== textRef.current) {
        setIsSelected(false);
        setSelectedCanvasObjects(dispatch, []);
      }
    };

    const stage = textRef.current?.getStage();
    if (!stage) return;
    stage.on("click", handleStageClick);
    return () => {
      stage.off("click", handleStageClick);
    };
  }, [isEditing, dispatch]);


  const handleTextDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!draggable) return;

    e.cancelBubble = true;

    setIsEditing(true);
    setIsSelected(false); 
  }, [draggable]);

  const handleTextChange = useCallback((newText: string): void => {
    const node = textRef.current;
    if (!node) return;

    const update = {
      [id]: {
        ...shapeModel,
        text: newText,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation: node.rotation(),
      }
    };

    handleUpdateShapes(update);
  }, [handleUpdateShapes, id, shapeModel]);

  return (
    <Group>
      <Text
        id={id}
        ref={textRef}
        text={text}
        fontSize={fontSize}
        fill={color}
        x={x}
        y={y}
        width={width}
        height={height}
        rotation={rotation}
        draggable={draggable}
        onClick={handleSelect}
        onTap={handleSelect}
        onDblClick={handleTextDblClick}
        onDblTap={handleTextDblClick}
        listening={!isEditing && draggable}
        visible={!isEditing}
        onDragEnd={onDragEnd}
        onMouseUp={onMouseUp}
        onMouseDown={onMouseDown}
        onMouseOut={onMouseOut}
        onMouseOver={onMouseOver}
        onTransform={onTransform} 
        onTransformEnd={onTransformEnd}
      />
      {isEditing && textRef.current && draggable && (
        <TextEditor
          textNode={textRef.current}
          onClose={(newText) => {
            handleTextChange(newText);
            setIsEditing(false);
          }}
        />
      )} 
      {isSelected && !isEditing && draggable && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(_oldBox, newBox) => ({
            ...newBox,
            width: Math.max(30, newBox.width),
            height: Math.max(30, newBox.height),
          })}
        />
      )}
    </ Group>
  );
}

export default EditableText;
