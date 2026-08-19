import {
  type PayloadAction,
  createSlice,
} from '@reduxjs/toolkit'

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

export interface SignupStateInactive {
  status: 'inactive';
}

export interface SignupPayloadError {
  errorKind: 'user' | 'system';
  reason?: string;
}

export interface SignupStateError extends SignupPayloadError {
  status: 'error';
}

export interface SignupPayloadRequestingWhiteboardTransferAuth {
  whiteboardId: WhiteboardIdType;
  email: string;
  username: string;
  password: string;
}

export interface SignupStateRequestingWhiteboardTransferAuth
extends SignupPayloadRequestingWhiteboardTransferAuth {
  status: 'requesting_whiteboard_transfer_auth';
}

export interface SignupPayloadRequesting {
  email: string;
  username: string;
  password: string;
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface SignupStateRequesting extends SignupPayloadRequesting {
  status: 'requesting';
}

export interface SignupPayloadPendingConfirmation {
  email: string;
  error?: {
    kind: 'user' | 'system';
    reason?: string;
  };
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface SignupStatePendingConfirmation
extends SignupPayloadPendingConfirmation {
  status: 'pending_confirmation';
}

export interface SignupPayloadRequestingConfirmation {
  accountCreationToken: string;
  password: string;
  email: string;
  whiteboardToTransfer?: {
    whiteboardId: string;
    transferAuthToken: string;
  };
}

export interface SignupStateRequestingConfirmation
extends SignupPayloadRequestingConfirmation {
  status: 'requesting_confirmation';
}

export interface SignupPayloadRequestingWhiteboardTransfer {
  whiteboardId: WhiteboardIdType;
  whiteboardTransferAuthToken: string;
}

export interface SignupStateRequestingWhiteboardTransfer 
extends SignupPayloadRequestingWhiteboardTransfer {
  status: 'requesting_whiteboard_transfer';
}

export interface SignupPayloadRenamingWhiteboard {
  whiteboardId: WhiteboardIdType;
}

export interface SignupStateRenamingWhiteboard extends SignupPayloadRenamingWhiteboard {
  status: 'renaming_whiteboard';
}

export interface SignupPayloadRequestingWhiteboardRename {
  whiteboardId: WhiteboardIdType;
  name: string;
}

export interface SignupStateRequestingWhiteboardRename extends SignupPayloadRequestingWhiteboardRename {
  status: 'requesting_whiteboard_rename';
}

export interface SignupStateLoggingIn {
  status: 'logging_in';
}

export type SignupState =
  | SignupStateInactive
  | SignupStateError
  | SignupStateRequestingWhiteboardTransferAuth
  | SignupStateRequesting
  | SignupStatePendingConfirmation
  | SignupStateRequestingConfirmation
  | SignupStateRequestingWhiteboardTransfer
  | SignupStateRenamingWhiteboard
  | SignupStateRequestingWhiteboardRename
  | SignupStateLoggingIn
;

const initialState : SignupState = ({
  status: 'inactive',
});

const signupSlice = createSlice({
  name: 'userFlows/signup',
  initialState: initialState as SignupState,
  reducers: {
    setSignupInactive(_state, _action) {
      const newState : SignupStateInactive = ({
        status: 'inactive',
      });

      return newState;
    },
    setSignupError(_state, action: PayloadAction<SignupPayloadError>) {
      const newState : SignupStateError = ({
        ...action.payload,
        status: 'error',
      });

      return newState;
    },
    setSignupRequestingWhiteboardTransferAuth(
      _state,
      action: PayloadAction<SignupPayloadRequestingWhiteboardTransferAuth>
    ) {
      const newState : SignupStateRequestingWhiteboardTransferAuth = ({
        ...action.payload,
        status: 'requesting_whiteboard_transfer_auth',
      });

      return newState;
    },
    setSignupRequesting(_state, action: PayloadAction<SignupPayloadRequesting>) {
      const newState : SignupStateRequesting = ({
        ...action.payload,
        status: 'requesting',
      });

      return newState;
    },
    setSignupPendingConfirmation(
      _state,
      action: PayloadAction<SignupPayloadPendingConfirmation>
    ) {
      const newState : SignupStatePendingConfirmation = ({
        ...action.payload,
        status: 'pending_confirmation',
      });

      return newState;
    },
    setSignupRequestingConfirmation(
      _state,
      action: PayloadAction<SignupPayloadRequestingConfirmation>
    ) {
      const newState : SignupStateRequestingConfirmation = ({
        ...action.payload,
        status: 'requesting_confirmation',
      });

      return newState;
    },
    setSignupRequestingWhiteboardTransfer(
      _state,
      action: PayloadAction<SignupPayloadRequestingWhiteboardTransfer>
    ) {
      const newState : SignupStateRequestingWhiteboardTransfer = ({
        ...action.payload,
        status: 'requesting_whiteboard_transfer',
      });

      return newState;
    },
    setSignupRenamingWhiteboard(_state, action: PayloadAction<SignupPayloadRenamingWhiteboard>) {
      const newState : SignupStateRenamingWhiteboard = ({
        ...action.payload,
        status: 'renaming_whiteboard',
      });

      return newState;
    },
    setSignupRequestingWhiteboardRename(_state, action: PayloadAction<SignupPayloadRequestingWhiteboardRename>) {
      const newState : SignupStateRequestingWhiteboardRename = ({
        ...action.payload,
        status: 'requesting_whiteboard_rename',
      });

      return newState;
    },
    setSignupLoggingIn(_state, _action) {
      const newState : SignupStateLoggingIn = ({
        status: 'logging_in',
      });

      return newState;
    },
  },
});// -- end signupSlice

export const {
  setSignupInactive,
  setSignupError,
  setSignupRequestingWhiteboardTransferAuth,
  setSignupRequesting,
  setSignupPendingConfirmation,
  setSignupRequestingConfirmation,
  setSignupRequestingWhiteboardTransfer,
  setSignupRenamingWhiteboard,
  setSignupRequestingWhiteboardRename,
  setSignupLoggingIn,
} = signupSlice.actions;

export type SignupActions =
  | ReturnType<typeof setSignupInactive>
  | ReturnType<typeof setSignupError>
  | ReturnType<typeof setSignupRequestingWhiteboardTransferAuth>
  | ReturnType<typeof setSignupRequesting>
  | ReturnType<typeof setSignupPendingConfirmation>
  | ReturnType<typeof setSignupRequestingConfirmation>
  | ReturnType<typeof setSignupRequestingWhiteboardTransfer>
  | ReturnType<typeof setSignupRenamingWhiteboard>
  | ReturnType<typeof setSignupRequestingWhiteboardRename>
  | ReturnType<typeof setSignupLoggingIn>
;

export default signupSlice.reducer;
