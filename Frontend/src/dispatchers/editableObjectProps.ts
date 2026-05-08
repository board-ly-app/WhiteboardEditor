import Konva from 'konva';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';  

export interface EditableObjectProps {
  onMouseOver?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseOut?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseDown?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseUp?: (ev: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragEnd?: (ev: Konva.KonvaEventObject<DragEvent>) => void;
  onTransform?: (ev: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd?: (ev: Konva.KonvaEventObject<DragEvent>) => void;
}

const editableObjectProps = <ShapeType extends CanvasObjectModel> (
  shapeModel: ShapeType,
  isDraggable: boolean,
  handleUpdateShapes: (shapes: Record<CanvasObjectIdType, ShapeType>) => void
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

    const id = ev.target.id();
    const x = ev.target.x();
    const y = ev.target.y();

    const update = {
      [id]: ({ ...shapeModel, x, y })
    };

    handleUpdateShapes(update);
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

  // once the transform ends, send the update to server to broadcast
  const handleTransformEnd = (ev: Konva.KonvaEventObject<Event>) => {
    ev.cancelBubble = true;

    const node = ev.target;
    const id = node.id();
    const rotation = node.rotation();

    let update: ShapeType;

    switch(shapeModel.type) {
      case "rect": 
        update = {
          ...shapeModel,
          x: node.x(),
          y: node.y(),
          width: node.width(),
          height: node.height(),
          rotation,
        };
        break;
      case "text":
        update = {
          ...shapeModel,
          x: node.x(),
          y: node.y(),
          width: node.width(),
          height: node.height(),
          rotation,
        };
        break;
      case "ellipse":
        update = {
          ...shapeModel,
          x: node.x(),
          y: node.y(),
          radiusX: node.width() / 2,
          radiusY: node.height() / 2,
          rotation,
        };
        break;
      default:
        update = {...shapeModel};
    };

    handleUpdateShapes({ [id]: update });
  };

  return ({
    onMouseOver: isDraggable && handleMouseOver || undefined,
    onMouseOut: isDraggable && handleMouseOut || undefined,
    onMouseDown: isDraggable && handleMouseDown || undefined,
    onMouseUp: isDraggable && handleMouseUp || undefined,
    onDragEnd: isDraggable && handleDragEnd || undefined,
    onTransform: isDraggable && handleTransform || undefined,
    onTransformEnd: isDraggable && handleTransformEnd || undefined,
  });
};

export default editableObjectProps;
