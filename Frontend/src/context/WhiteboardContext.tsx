// -- std imports
import React, {
  createContext,
  type PropsWithChildren,
  type RefObject,
} from 'react';

// -- third-party imports
import Konva from 'konva';

// -- local imports
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import type {
  CanvasIdType,
  WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type OperationDispatcher,
} from '@/types/OperationDispatcher';

export interface WhiteboardContextType {
  handleUpdateShapes: (
      canvasId: CanvasIdType,
      canvasObjectsById: Record<CanvasObjectIdType, CanvasObjectModel>,
      updates: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
  ) => unknown;
  whiteboardId: WhiteboardIdType;
  // -- Contains ref to stage containing root canvas, located in pages/Whiteboard/CanvasCard
  stageRef: RefObject<Konva.Stage | null>;
  // -- Contains mapping of canvas object IDs to Konva objects
  canvasObjectRefsByIdRef: RefObject<Record<CanvasObjectIdType, RefObject<Konva.Shape | null>>>;
  selectedObjectRefsByIdRef: RefObject<Record<CanvasObjectIdType, RefObject<Konva.Shape | null>>>;
  currentDispatcherRef: RefObject<OperationDispatcher | null>;
  // -- tracks refs to Canvas groups (Konva Groups serve as frames for each Canvas)
  canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>>;
}// -- end interface WhiteboardContextType

export type WhiteboardProvidersProps = WhiteboardContextType;

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

const WhiteboardProvider = ({
  handleUpdateShapes,
  whiteboardId,
  stageRef,
  canvasObjectRefsByIdRef,
  selectedObjectRefsByIdRef,
  currentDispatcherRef,
  canvasGroupRefsByIdRef,
  children,
}: PropsWithChildren<WhiteboardProvidersProps>): React.JSX.Element => {
  return (
    <WhiteboardContext.Provider value={{
      handleUpdateShapes,
      whiteboardId,
      stageRef,
      canvasObjectRefsByIdRef,
      selectedObjectRefsByIdRef,
      currentDispatcherRef,
      canvasGroupRefsByIdRef,
    }}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export {
  WhiteboardProvider
};

export default WhiteboardContext;
