// === ImageCanvasObject.tsx ===================================================
//
// Renders an Image canvas object.
//
// =============================================================================

import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

import Konva from 'konva';

import {
  Image,
} from 'react-konva';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
  type ImageModel,
} from '@/types/CanvasObjectModel';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import EditableShape from '@/components/EditableShape';

import { shadowProps } from '@/lib/shadowProps';

export interface ImageCanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  model: ImageModel;
  isDraggable: boolean;
  onUpdateObject: (updatedObject: CanvasObjectModel) => unknown;
}

export const ImageCanvasObject = ({
  id,
  canvasId,
  model,
  isDraggable,
  onUpdateObject,
}: ImageCanvasObjectProps): ReactNode => {
  const {
    x,
    y,
    width,
    height,
    rotation,
    src,
  } = model;

  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);

  useEffect(
    () => {
      const img = new window.Image();

      img.onload = () => setImageElement(img);
      img.src = src;
    },
    [src]
  );

  const handleTransformEnd = useCallback(
    (ev: Konva.KonvaEventObject<Event>) => {
      ev.cancelBubble = true;

      const node = ev.target;
      const rotation = node.rotation();

      const update: ImageModel = {
        ...model,
        x: node.x(),
        y: node.y(),
        width: node.width(),
        height: node.height(),
        rotation,
      };

      onUpdateObject(update);
    },
    [model, onUpdateObject]
  );// -- end handleTransformEnd

  return (
    <EditableShape<ImageModel>
      id={id}
      canvasId={canvasId}
      draggable={isDraggable}
      shapeModel={model}
      onUpdateObject={onUpdateObject}
      onTransformEnd={handleTransformEnd}
    >
      <Image
        x={x}
        y={y}
        width={width}
        height={height}
        image={imageElement ?? undefined}
        rotation={rotation}
        {...shadowProps(model.shadow)}
      />
    </EditableShape>
  );
};
