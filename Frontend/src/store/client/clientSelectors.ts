import {
  type RootState,
} from '@/store';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

export const selectClientId = (
  state: RootState,
): ClientIdType | null => {
  return state.client.clientId;
};
