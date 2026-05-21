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
  type UserPermission,
} from '@/types/UserPermission'

import type { OperationDispatcher } from '@/types/OperationDispatcher';

export interface WhiteboardContextType {
  handleUpdateShapes: (canvasId: CanvasIdType, shapes: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>) => unknown;
  whiteboardId: WhiteboardIdType;
  userPermissions: UserPermission[];
  setSharedUsers: React.Dispatch<React.SetStateAction<UserPermission[]>>;
  newCanvasAllowedUsers: string[];
  setNewCanvasAllowedUsers: React.Dispatch<React.SetStateAction<string[]>>;
  // -- view/edit/own permission - determines which actions to enable/disable
  currentDispatcherRef: RefObject<OperationDispatcher | null>;
  // -- tracks refs to Canvas groups (Konva Groups serve as frames for each Canvas)
  canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>>;
  tooltipText: string;
  setTooltipText: (text: string) => void;
  editingText: string;
  setEditingText: (text: string) => void;
}// -- end interface WhiteboardContextType

export type WhiteboardProvidersProps = WhiteboardContextType;

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

const WhiteboardProvider = ({
  handleUpdateShapes,
  whiteboardId,
  children,
  userPermissions,
  setSharedUsers,
  newCanvasAllowedUsers,
  setNewCanvasAllowedUsers,
  currentDispatcherRef,
  canvasGroupRefsByIdRef,
  tooltipText,
  setTooltipText,
  editingText,
  setEditingText,
}: PropsWithChildren<WhiteboardProvidersProps>): React.JSX.Element => {
  console.log('!! WHITEBOARD_CONTEXT RERENDER');
  console.log('!! NL');

  return (
    <WhiteboardContext.Provider value={{
      handleUpdateShapes,
      whiteboardId,
      userPermissions,
      setSharedUsers,
      newCanvasAllowedUsers,
      setNewCanvasAllowedUsers,
      currentDispatcherRef,
      canvasGroupRefsByIdRef,
      tooltipText,
      setTooltipText,
      editingText,
      setEditingText,
    }}>
      {children}
    </WhiteboardContext.Provider>
  );
}

export {
  WhiteboardProvider
};

export default WhiteboardContext;
