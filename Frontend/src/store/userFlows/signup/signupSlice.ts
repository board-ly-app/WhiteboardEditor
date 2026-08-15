import {
  createSlice,
  type PayloadAction
} from '@reduxjs/toolkit'

import {
  type WhiteboardIdType,
} from '@/types/WebSocketProtocol';

export interface SignupStateInactive {
  status: 'inactive';
}

export interface SignupPayloadRequesting {
  email: string;
  password: string;
}

export interface SignupStateRequesting extends SignupPayloadRequesting {
  status: 'pending';
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
  status: 'pending_whiteboard_rename';
}

export type SignupState =
  | SignupStateInactive
  | SignupStateRequesting
  | SignupStateRenamingWhiteboard
  | SignupStateRequestingWhiteboardRename
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
    setSignupRequesting(_state, action: PayloadAction<SignupPayloadRequesting>) {
      const newState : SignupStateRequesting = ({
        ...action.payload,
        status: 'pending',
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
        status: 'pending_whiteboard_rename',
      });

      return newState;
    },
  },
});// -- end signupSlice

export const {
  setSignupInactive,
  setSignupRequesting,
  setSignupRenamingWhiteboard,
  setSignupRequestingWhiteboardRename,
} = signupSlice.actions;

export type SignupActions =
  | ReturnType<typeof setSignupInactive>
  | ReturnType<typeof setSignupRequesting>
  | ReturnType<typeof setSignupRenamingWhiteboard>
  | ReturnType<typeof setSignupRequestingWhiteboardRename>
;

export default signupSlice.reducer;
