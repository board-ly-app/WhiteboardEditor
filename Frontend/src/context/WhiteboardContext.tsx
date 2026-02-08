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
  ToolChoice
} from '@/components/Tool';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import type {
  CanvasIdType,
  WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import type {
  UserPermission,
  UserPermissionEnum,
} from '@/types/APIProtocol'
import type { OperationDispatcher } from '@/types/OperationDispatcher';

export interface WhiteboardContextType {
  handleUpdateShapes: (canvasId: CanvasIdType, shapes: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>) => unknown;
  currentTool: ToolChoice;
  setCurrentTool: React.Dispatch<React.SetStateAction<ToolChoice>>;
  whiteboardId: WhiteboardIdType;
  userPermissions: UserPermission[];
  setSharedUsers: React.Dispatch<React.SetStateAction<UserPermission[]>>;
  newCanvasAllowedUsers: string[];
  setNewCanvasAllowedUsers: React.Dispatch<React.SetStateAction<string[]>>;
  // -- view/edit/own permission - determines which actions to enable/disable
  ownPermission: UserPermissionEnum | null;
  setOwnPermission: React.Dispatch<React.SetStateAction<UserPermissionEnum | null>>;
  currentDispatcher: OperationDispatcher | null;
  setCurrentDispatcher: React.Dispatch<React.SetStateAction<OperationDispatcher | null>>;
  selectedCanvasId: CanvasIdType | null;
  setSelectedCanvasId: (id: CanvasIdType | null) => void;
  // -- tracks refs to Canvas groups (Konva Groups serve as frames for each Canvas)
  canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>>;
  tooltipText: string;
  setTooltipText: (text: string) => void;
  editingText: string;
  setEditingText: (text: string) => void;
}// -- end interface WhiteboardContextType

export type WhiteboardProvidersProps = WhiteboardContextType;

const WhiteboardContext = createContext<WhiteboardContextType | undefined>(undefined);

const WhiteboardProvider = (props: PropsWithChildren<WhiteboardProvidersProps>): React.JSX.Element => {
  const {
    handleUpdateShapes,
    currentTool,
    setCurrentTool,
    whiteboardId,
    children,
    userPermissions,
    setSharedUsers,
    newCanvasAllowedUsers,
    setNewCanvasAllowedUsers,
    ownPermission,
    setOwnPermission,
    currentDispatcher,
    setCurrentDispatcher,
    selectedCanvasId,
    setSelectedCanvasId,
    canvasGroupRefsByIdRef,
    tooltipText,
    setTooltipText,
    editingText,
    setEditingText,
  } = props;

  return (
    <WhiteboardContext.Provider value={{
      handleUpdateShapes,
      currentTool,
      setCurrentTool,
      whiteboardId,
      userPermissions,
      setSharedUsers,
      newCanvasAllowedUsers,
      setNewCanvasAllowedUsers,
      ownPermission,
      setOwnPermission,
      currentDispatcher,
      setCurrentDispatcher,
      selectedCanvasId,
      setSelectedCanvasId,
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
