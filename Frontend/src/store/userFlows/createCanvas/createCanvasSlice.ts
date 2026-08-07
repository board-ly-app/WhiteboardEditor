import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

import {
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

export interface CreateCanvasStateInactive {
  status: 'inactive';
}

export interface CreateCanvasPayloadReady {
  parentCanvasId: CanvasIdType;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface CreateCanvasStateReady extends CreateCanvasPayloadReady {
  status: 'ready';
}

export interface CreateCanvasPayloadRequesting extends CreateCanvasPayloadReady {
  name: string;
  allowedUsers: string[];
}

export interface CreateCanvasStateRequesting extends CreateCanvasPayloadRequesting {
  status: 'requesting';
}

export type CreateCanvasState =
  | CreateCanvasStateInactive
  | CreateCanvasStateReady
  | CreateCanvasStateRequesting
;

const initialState : CreateCanvasState = ({
  status: 'inactive',
});

const createCanvasSlice = createSlice({
  name: 'userFlows/createCanvas',
  initialState: initialState as CreateCanvasState,
  reducers: {
    setCreateCanvasInactive(_state, _action) {
      const newState : CreateCanvasStateInactive = ({
        status: 'inactive',
      });
      return newState;
    },
    setCreateCanvasReady(_state, action: PayloadAction<CreateCanvasPayloadReady>) {
      const newState : CreateCanvasStateReady = ({
        ...action.payload,
        status: 'ready',
      });
      return newState;
    },
    setCreateCanvasRequesting(_state, action: PayloadAction<CreateCanvasPayloadRequesting>) {
      const newState : CreateCanvasStateRequesting = ({
        ...action.payload,
        status: 'requesting',
      });
      return newState;
    },
  },
});// -- end createCanvasSlice

export const {
  setCreateCanvasInactive,
  setCreateCanvasReady,
  setCreateCanvasRequesting,
} = createCanvasSlice.actions;

export type CreateCanvasActions =
  | ReturnType<typeof setCreateCanvasInactive>
  | ReturnType<typeof setCreateCanvasReady>
  | ReturnType<typeof setCreateCanvasRequesting>
;

export default createCanvasSlice.reducer;
