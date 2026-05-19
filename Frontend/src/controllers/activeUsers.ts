// -- local imports
import {
  type AppDispatch,
} from '@/store';

import {
  type ClientIdType,
  type WhiteboardIdType,
} from "@/types/WebSocketProtocol";

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  setActiveUsers,
  setClientCursorPos as reducerSetClientCursorPos,
} from '@/store/activeUsers/activeUsersSlice';

import {
  setSelectorsByCanvasObject as reducerSetSelectorsByCanvasObject,
  removeSelectorsByCanvasObject as reducerRemoveSelectorsByCanvasObject,
  removeCanvasObjectsBySelector as reducerRemoveCanvasObjectsBySelector,
} from '@/store/activeUsers/selectorsByCanvasObjectSlice';

import {
  addActiveUsersByWhiteboard as addActiveUsersByWhiteboardReducer,
  setActiveUsersByWhiteboard as setActiveUsersByWhiteboardReducer,
  removeActiveUsers as removeActiveUsersReducer,
} from '@/store/activeUsers/activeUsersByWhiteboardSlice';

export const addActiveUsersByWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  clientSummaries: ClientSummary[],
) => {
  dispatch(setActiveUsers(clientSummaries));
  dispatch(addActiveUsersByWhiteboardReducer({
    [whiteboardId]: clientSummaries.map(clientSummary => clientSummary.clientId),
  }));
};

export const setActiveUsersByWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  clientSummaries: ClientSummary[],
) => {
  dispatch(setActiveUsers(clientSummaries));
  dispatch(setActiveUsersByWhiteboardReducer({
    [whiteboardId]: clientSummaries.map(clientSummary => clientSummary.clientId)
  }));
};

export const removeActiveUsers = (
  dispatch: AppDispatch,
  userClientIds: ClientIdType[]
) => {
  dispatch(removeActiveUsersReducer(userClientIds));
};

export const setSelectorsByCanvasObject = (
  dispatch: AppDispatch,
  selectorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>,
) => {
  dispatch(reducerSetSelectorsByCanvasObject(selectorsByCanvasObject));
};

export const removeSelectorsByCanvasObject = (
  dispatch: AppDispatch,
  objectIds: CanvasObjectIdType[],
) => {
  dispatch(reducerRemoveSelectorsByCanvasObject(objectIds));
};

export const removeCanvasObjectsBySelector = (
  dispatch: AppDispatch,
  selectors: ClientIdType[],
) => {
  dispatch(reducerRemoveCanvasObjectsBySelector(selectors));
};

export const setClientCursorPos = (
  dispatch: AppDispatch,
  clientId: ClientIdType,
  x: number,
  y: number,
) => {
  dispatch(reducerSetClientCursorPos({
    [clientId]: { x, y },
  }));
};
