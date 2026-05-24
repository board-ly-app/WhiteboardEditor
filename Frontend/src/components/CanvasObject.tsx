// === CanvasObject.tsx ========================================================
//
// Class which takes a canvas object identified by its ID and delegates
// rendering to the component identified by the cannvas object (shape) type.
//
// =============================================================================

import {
  type ReactNode,
  useCallback,
  useContext,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  type RootState,
} from '@/store';

import {
  selectCanvasObjectById,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  RectCanvasObject,
} from '@/components/RectCanvasObject';

import {
  EllipseCanvasObject,
} from '@/components/EllipseCanvasObject';

import {
  VectorCanvasObject,
} from '@/components/VectorCanvasObject';

import {
  TextCanvasObject,
} from '@/components/TextCanvasObject';

export interface CanvasObjectProps {
  id: CanvasObjectIdType;
  canvasId: CanvasIdType;
  isDraggable: boolean;
}

export const CanvasObject = ({
  id,
  canvasId,
  isDraggable,
}: CanvasObjectProps): ReactNode => {
  const canvasObject = useSelector(
    (state: RootState) => selectCanvasObjectById(state, id),
    lodash.isEqual
  );

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const handleUpdateObject = useCallback(
    (updatedObject: CanvasObjectModel) => {
      clientMessenger?.sendUpdateShapes({
        type: 'update_shapes',
        canvasId,
        shapes: {
          [id]: updatedObject,
        },
      });
    },
    [clientMessenger, canvasId, id]
  );// -- end handleUpdateObject

  if (! canvasObject) {
    console.error('Canvas object', id, 'not found in state store');

    return null;
  } else {
    switch (canvasObject.type) {
      case 'rect':
        return (
          <RectCanvasObject
            id={id}
            canvasId={canvasId}
            model={canvasObject}
            isDraggable={isDraggable}
            onUpdateObject={handleUpdateObject}
          />
        );
      case 'ellipse':
        return (
          <EllipseCanvasObject
            id={id}
            canvasId={canvasId}
            model={canvasObject}
            isDraggable={isDraggable}
            onUpdateObject={handleUpdateObject}
          />
        );
      case 'vector':
        return (
          <VectorCanvasObject
            id={id}
            model={canvasObject}
            isDraggable={isDraggable}
            onUpdateObject={handleUpdateObject}
          />
        );
      case 'text':
        return (
          <TextCanvasObject
            id={id}
            record={canvasObject}
            isDraggable={isDraggable}
            onUpdateObject={handleUpdateObject}
          />
        );
      default:
        throw new Error(`Unrecognized canvas object: ${canvasObject}`);
    }// -- end switch
  }
};// -- end  CanvasObject
