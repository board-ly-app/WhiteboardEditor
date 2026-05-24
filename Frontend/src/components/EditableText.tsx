import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";

import {
  Group,
  Text,
  Transformer,
} from 'react-konva';

import Konva from "konva";

import lodash from 'lodash';

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

import TextEditor from "./TextEditor";

import { type EditableObjectProps } from "@/dispatchers/editableObjectProps";
import type { ShapeModel, TextRecord } from "@/types/CanvasObjectModel";
import {
  SnappingMonitor,
  useSnapping,
} from "@/hooks/useSnapping";

export interface EditableTextProps extends EditableObjectProps {
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
  record: TextRecord;
  onUpdateObject: (updatedObject: ShapeModel) => unknown;
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
  record,
  onUpdateObject,
  onMouseOver,
  onMouseOut,
  onMouseDown,
  onMouseUp,
  onDragEnd,
  onTransform,
}: EditableTextProps) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const textRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [snappingMonitor] = useState(new SnappingMonitor());
  
  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  useSnapping(textRef, snappingMonitor);

  const clientId = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  const editor = useSelector(
    (state: RootState) => selectSelectorByCanvasObject(state, id),
    lodash.isEqual
  );

  const isSelected : boolean = useMemo(
    () => editor?.clientId === clientId,
    [editor, clientId]
  );

  // attach Transformer for editing when selected
  useEffect(() => {
    if (!trRef.current || !textRef.current) return;
    trRef.current.nodes(editor ? [textRef.current] : []);
  }, [editor]);
  
  const handleSelect = useCallback((ev: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    ev.cancelBubble = true;

    if (! editor) {
      clientMessenger?.sendSelectedCanvasObject({
        type: 'selected_canvas_object',
        canvasObjectId: id,
      });
    }
  }, [editor, clientMessenger, id]);

  const handleTextDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!draggable) return;

    e.cancelBubble = true;

    setIsEditing(true);
    // setIsSelected(false); 
  }, [draggable]);

  const handleTextChange = useCallback(
    (newText: string): void => {
      const node = textRef.current;
      if (!node) return;

      const update = {
        ...record,
        text: newText,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation: node.rotation(),
      };

      onUpdateObject(update);
    },
    [onUpdateObject, record]
  );

  const handleTransformEnd = useCallback(
    (ev: Konva.KonvaEventObject<Event>) => {
      ev.cancelBubble = true;
      
      const node = ev.target;
      const rotation = node.rotation();
      
      const update = {
        ...record,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation,
      };

      onUpdateObject(update);
    },
    [onUpdateObject, record]
  );

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
        onDragStart={handleSelect}
        onDragEnd={onDragEnd}
        onMouseUp={onMouseUp}
        onMouseDown={onMouseDown}
        onMouseOut={onMouseOut}
        onMouseOver={onMouseOver}
        onTransform={onTransform}
        onTransformEnd={handleTransformEnd}
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
      {editor && (
        <Transformer
          ref={trRef}
          borderEnabled={true}
          borderStroke={editor.color}
          borderStrokeWidth={(! isSelected) && 4 || undefined}
          resizeEnabled={isSelected}
          rotateEnabled={isSelected}
          flipEnabled={isSelected}
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
