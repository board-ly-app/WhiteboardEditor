import {
  type AppDispatch,
} from '@/store';

import {
  setClientId as reducerSetClientId,
  unsetClientId as reducerUnsetClientId,
} from '@/store/client/clientSlice';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

export const setClientId = (
  dispatch: AppDispatch,
  clientId: ClientIdType,
) => {
  dispatch(reducerSetClientId(clientId));
};// -- end setClientId

export const unsetClientId = (
  dispatch: AppDispatch,
) => {
  dispatch(reducerUnsetClientId());
};// -- end unsetClientId
