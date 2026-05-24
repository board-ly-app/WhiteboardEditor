import Konva from 'konva';

import type {
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';  

export interface EditableObjectProps {
  onMouseOver?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseOut?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseDown?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseUp?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (ev: Konva.KonvaEventObject<DragEvent>) => void;
  onTransform?: (ev: Konva.KonvaEventObject<DragEvent>) => void;
}

const editableObjectProps = <ShapeType extends CanvasObjectModel> (
  shapeModel: ShapeType,
  isDraggable: boolean,
  handleUpdateShape: (updatedShape: ShapeType) => void
): EditableObjectProps => {
  const handleMouseOver = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    ev.cancelBubble = true;

    const stage = ev.target.getStage();

    if (stage) {
      stage.container().style.cursor = 'grab';
    }
  };

  const handleMouseOut = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    ev.cancelBubble = true;

    const stage = ev.target.getStage();

    if (stage) {
      stage.container().style.cursor = 'default';
    }
  };

  const handleMouseDown = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    ev.cancelBubble = true;

    const stage = ev.target.getStage();

    if (stage) {
      stage.container().style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (ev: Konva.KonvaEventObject<MouseEvent>) => {
    ev.cancelBubble = true;

    const stage = ev.target.getStage();

    if (stage) {
      stage.container().style.cursor = 'grab';
    }
  };

  const handleDragEnd = (ev: Konva.KonvaEventObject<DragEvent>) => {
    ev.cancelBubble = true;

    const x = ev.target.x();
    const y = ev.target.y();

    handleUpdateShape({ ...shapeModel, x, y });
  };

  // transform the targetted box locally in real time without broadcasting
  const handleTransform = (ev: Konva.KonvaEventObject<Event>) => {
    ev.cancelBubble = true;

    const node = ev.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    const width = node.width() * scaleX;
    const height = node.height() * scaleY;

    // apply new size locally so text stays crisp
    node.width(width);
    node.height(height);
    node.scaleX(1);
    node.scaleY(1);
  };

  return ({
    onMouseOver: isDraggable && handleMouseOver || undefined,
    onMouseOut: isDraggable && handleMouseOut || undefined,
    onMouseDown: isDraggable && handleMouseDown || undefined,
    onMouseUp: isDraggable && handleMouseUp || undefined,
    onDragEnd: isDraggable && handleDragEnd || undefined,
    onTransform: isDraggable && handleTransform || undefined,
  });
};

export default editableObjectProps;
