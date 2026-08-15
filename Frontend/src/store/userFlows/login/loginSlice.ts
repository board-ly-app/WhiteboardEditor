import {
  type PayloadAction,
  createSlice,
} from '@reduxjs/toolkit'

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

export interface LoginStateInactive {
  status: 'inactive';
}

export interface LoginPayloadError {
  errorKind: 'user' | 'system';
  reason?: string;
}

export interface LoginStateError extends LoginPayloadError {
  status: 'error';
}

export interface LoginPayloadRequestingWhiteboardTransferAuth {
  whiteboardId: WhiteboardIdType;
  email: string;
  password: string;
}

export interface LoginStateRequestingWhiteboardTransferAuth
extends LoginPayloadRequestingWhiteboardTransferAuth {
  status: 'requesting_whiteboard_transfer_auth';
}

export interface LoginPayloadRequesting {
  email: string;
  password: string;
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface LoginStateRequesting extends LoginPayloadRequesting {
  status: 'requesting';
}

export interface LoginPayloadRequestingWhiteboardTransfer {
  whiteboardId: WhiteboardIdType;
  whiteboardTransferAuthToken: string;
}

export interface LoginStateRequestingWhiteboardTransfer 
extends LoginPayloadRequestingWhiteboardTransfer {
  status: 'requesting_whiteboard_transfer';
}

export interface LoginPayloadRenamingWhiteboard {
  whiteboardId: WhiteboardIdType;
}

export interface LoginStateRenamingWhiteboard extends LoginPayloadRenamingWhiteboard {
  status: 'renaming_whiteboard';
}

export interface LoginPayloadRequestingWhiteboardRename {
  whiteboardId: WhiteboardIdType;
  name: string;
}

export interface LoginStateRequestingWhiteboardRename extends LoginPayloadRequestingWhiteboardRename {
  status: 'requesting_whiteboard_rename';
}

export interface LoginStateLoggingIn {
  status: 'logging_in';
}

export type LoginState =
  | LoginStateInactive
  | LoginStateError
  | LoginStateRequestingWhiteboardTransferAuth
  | LoginStateRequesting
  | LoginStateRequestingWhiteboardTransfer
  | LoginStateRenamingWhiteboard
  | LoginStateRequestingWhiteboardRename
  | LoginStateLoggingIn
;

const initialState : LoginState = ({
  status: 'inactive',
});

const loginSlice = createSlice({
  name: 'userFlows/login',
  initialState: initialState as LoginState,
  reducers: {
    setLoginInactive(_state, _action) {
      const newState : LoginStateInactive = ({
        status: 'inactive',
      });

      return newState;
    },
    setLoginError(_state, action: PayloadAction<LoginPayloadError>) {
      const newState : LoginStateError = ({
        ...action.payload,
        status: 'error',
      });

      return newState;
    },
    setLoginRequestingWhiteboardTransferAuth(
      _state,
      action: PayloadAction<LoginPayloadRequestingWhiteboardTransferAuth>
    ) {
      const newState : LoginStateRequestingWhiteboardTransferAuth = ({
        ...action.payload,
        status: 'requesting_whiteboard_transfer_auth',
      });

      return newState;
    },
    setLoginRequesting(_state, action: PayloadAction<LoginPayloadRequesting>) {
      const newState : LoginStateRequesting = ({
        ...action.payload,
        status: 'requesting',
      });

      return newState;
    },
    setLoginRequestingWhiteboardTransfer(
      _state,
      action: PayloadAction<LoginPayloadRequestingWhiteboardTransfer>
    ) {
      const newState : LoginStateRequestingWhiteboardTransfer = ({
        ...action.payload,
        status: 'requesting_whiteboard_transfer',
      });

      return newState;
    },
    setLoginRenamingWhiteboard(_state, action: PayloadAction<LoginPayloadRenamingWhiteboard>) {
      const newState : LoginStateRenamingWhiteboard = ({
        ...action.payload,
        status: 'renaming_whiteboard',
      });

      return newState;
    },
    setLoginRequestingWhiteboardRename(_state, action: PayloadAction<LoginPayloadRequestingWhiteboardRename>) {
      const newState : LoginStateRequestingWhiteboardRename = ({
        ...action.payload,
        status: 'requesting_whiteboard_rename',
      });

      return newState;
    },
    setLoginLoggingIn(_state, _action) {
      const newState : LoginStateLoggingIn = ({
        status: 'logging_in',
      });

      return newState;
    },
  },
});// -- end loginSlice

export const {
  setLoginInactive,
  setLoginError,
  setLoginRequestingWhiteboardTransferAuth,
  setLoginRequesting,
  setLoginRequestingWhiteboardTransfer,
  setLoginRenamingWhiteboard,
  setLoginRequestingWhiteboardRename,
  setLoginLoggingIn,
} = loginSlice.actions;

export type LoginActions =
  | ReturnType<typeof setLoginInactive>
  | ReturnType<typeof setLoginError>
  | ReturnType<typeof setLoginRequestingWhiteboardTransferAuth>
  | ReturnType<typeof setLoginRequesting>
  | ReturnType<typeof setLoginRequestingWhiteboardTransfer>
  | ReturnType<typeof setLoginRenamingWhiteboard>
  | ReturnType<typeof setLoginRequestingWhiteboardRename>
  | ReturnType<typeof setLoginLoggingIn>
;

export default loginSlice.reducer;
