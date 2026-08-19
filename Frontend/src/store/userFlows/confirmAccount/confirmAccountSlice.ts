import {
  type PayloadAction,
  createSlice,
} from '@reduxjs/toolkit'

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

export interface ConfirmAccountStateInactive {
  status: 'inactive';
}

export interface ConfirmAccountPayloadPendingConfirmation {
  initToken?: string;
  error?: {
    kind: 'user' | 'system';
    reason?: string;
  };
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface ConfirmAccountStatePendingConfirmation
extends ConfirmAccountPayloadPendingConfirmation {
  status: 'pending_confirmation';
}

export interface ConfirmAccountPayloadRequestingConfirmation {
  accountCreationToken: string;
  password: string;
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface ConfirmAccountStateRequestingConfirmation
extends ConfirmAccountPayloadRequestingConfirmation {
  status: 'requesting_confirmation';
}

export interface ConfirmAccountPayloadRequestingWhiteboardTransfer {
  whiteboardId: WhiteboardIdType;
  whiteboardTransferAuthToken: string;
}

export interface ConfirmAccountStateRequestingWhiteboardTransfer 
extends ConfirmAccountPayloadRequestingWhiteboardTransfer {
  status: 'requesting_whiteboard_transfer';
}

export interface ConfirmAccountPayloadRenamingWhiteboard {
  whiteboardId: WhiteboardIdType;
  error?: {
    kind: 'user' | 'system';
    reason?: string;
  };
}

export interface ConfirmAccountStateRenamingWhiteboard
extends ConfirmAccountPayloadRenamingWhiteboard {
  status: 'renaming_whiteboard';
}

export interface ConfirmAccountPayloadRequestingWhiteboardRename {
  whiteboardId: WhiteboardIdType;
  name: string;
}

export interface ConfirmAccountStateRequestingWhiteboardRename extends ConfirmAccountPayloadRequestingWhiteboardRename {
  status: 'requesting_whiteboard_rename';
}

export interface ConfirmAccountStateLoggingIn {
  status: 'logging_in';
}

export type ConfirmAccountState =
  | ConfirmAccountStateInactive
  | ConfirmAccountStatePendingConfirmation
  | ConfirmAccountStateRequestingConfirmation
  | ConfirmAccountStateRequestingWhiteboardTransfer
  | ConfirmAccountStateRenamingWhiteboard
  | ConfirmAccountStateRequestingWhiteboardRename
  | ConfirmAccountStateLoggingIn
;

const initialState : ConfirmAccountState = ({
  status: 'inactive',
});

const confirmAccountSlice = createSlice({
  name: 'userFlows/confirmAccount',
  initialState: initialState as ConfirmAccountState,
  reducers: {
    setConfirmAccountInactive(_state, _action) {
      const newState : ConfirmAccountStateInactive = ({
        status: 'inactive',
      });

      return newState;
    },
    setConfirmAccountPendingConfirmation(
      _state,
      action: PayloadAction<ConfirmAccountPayloadPendingConfirmation>
    ) {
      const newState : ConfirmAccountStatePendingConfirmation = ({
        ...action.payload,
        status: 'pending_confirmation',
      });

      return newState;
    },
    setConfirmAccountRequestingConfirmation(
      _state,
      action: PayloadAction<ConfirmAccountPayloadRequestingConfirmation>
    ) {
      const newState : ConfirmAccountStateRequestingConfirmation = ({
        ...action.payload,
        status: 'requesting_confirmation',
      });

      return newState;
    },
    setConfirmAccountRequestingWhiteboardTransfer(
      _state,
      action: PayloadAction<ConfirmAccountPayloadRequestingWhiteboardTransfer>
    ) {
      const newState : ConfirmAccountStateRequestingWhiteboardTransfer = ({
        ...action.payload,
        status: 'requesting_whiteboard_transfer',
      });

      return newState;
    },
    setConfirmAccountRenamingWhiteboard(
      _state,
      action: PayloadAction<ConfirmAccountPayloadRenamingWhiteboard>
    ) {
      const newState : ConfirmAccountStateRenamingWhiteboard = ({
        ...action.payload,
        status: 'renaming_whiteboard',
      });

      return newState;
    },
    setConfirmAccountRequestingWhiteboardRename(_state, action: PayloadAction<ConfirmAccountPayloadRequestingWhiteboardRename>) {
      const newState : ConfirmAccountStateRequestingWhiteboardRename = ({
        ...action.payload,
        status: 'requesting_whiteboard_rename',
      });

      return newState;
    },
    setConfirmAccountLoggingIn(_state, _action) {
      const newState : ConfirmAccountStateLoggingIn = ({
        status: 'logging_in',
      });

      return newState;
    },
  },
});// -- end confirmAccountSlice

export const {
  setConfirmAccountInactive,
  setConfirmAccountPendingConfirmation,
  setConfirmAccountRequestingConfirmation,
  setConfirmAccountRequestingWhiteboardTransfer,
  setConfirmAccountRenamingWhiteboard,
  setConfirmAccountRequestingWhiteboardRename,
  setConfirmAccountLoggingIn,
} = confirmAccountSlice.actions;

export type ConfirmAccountActions =
  | ReturnType<typeof setConfirmAccountInactive>
  | ReturnType<typeof setConfirmAccountPendingConfirmation>
  | ReturnType<typeof setConfirmAccountRequestingConfirmation>
  | ReturnType<typeof setConfirmAccountRequestingWhiteboardTransfer>
  | ReturnType<typeof setConfirmAccountRenamingWhiteboard>
  | ReturnType<typeof setConfirmAccountRequestingWhiteboardRename>
  | ReturnType<typeof setConfirmAccountLoggingIn>
;

export default confirmAccountSlice.reducer;
