// === clientSlice.ts ==========================================================
//
// Simply stores the state of the user's active client, namely the client id.
//
// =============================================================================

// -- std imports
import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

interface ClientSliceState {
  clientId: ClientIdType | null;
}

const initialState : ClientSliceState = {
  clientId: null,
};

const clientSlice = createSlice({
  name: 'client',
  initialState,
  reducers: {
    setClientId(state, action: PayloadAction<ClientIdType>) {
      state.clientId = action.payload;

      return state;
    },// -- end setClientId
    unsetClientId(state) {
      state.clientId = null;

      return state;
    },// -- end unsetClientId() {
  },
});// -- end clientSlice

export const {
  setClientId,
  unsetClientId,
} = clientSlice.actions;

export type ClientActions =
  | ReturnType<typeof setClientId>
  | ReturnType<typeof unsetClientId>
;

export default clientSlice.reducer;
