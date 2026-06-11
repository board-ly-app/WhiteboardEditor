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
  // -- view/edit/own permission - determines which actions to enable/disable
  currentDispatcherRef: RefObject<OperationDispatcher | null>;
  // -- tracks refs to Canvas groups (Konva Groups serve as frames for each Canvas)
  canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>>;
}// -- end interface WhiteboardContextType

export type WhiteboardProvidersProps = WhiteboardContextType;

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

const WhiteboardProvider = ({
  handleUpdateShapes,
  whiteboardId,
  children,
  currentDispatcherRef,
  canvasGroupRefsByIdRef,
}: PropsWithChildren<WhiteboardProvidersProps>): React.JSX.Element => {
  return (
    <WhiteboardContext.Provider value={{
      handleUpdateShapes,
      whiteboardId,
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
