import {
  type PayloadAction,
  createSlice,
} from '@reduxjs/toolkit';

import {
  type PatchPermanentUserReqPayloadInitial,
  type PatchPermanentUserResPayload,
} from '@/types/APIProtocol';

export interface UpdateAccountPayloadPendingSubmission {
  error?: {
    kind: 'user' | 'system';
    reason?: string;
  };
}

export interface UpdateAccountStatePendingSubmission
extends UpdateAccountPayloadPendingSubmission {
  status: 'pending_submission';
}

export interface UpdateAccountPayloadSubmitting {
  payload: PatchPermanentUserReqPayloadInitial;
}

export interface UpdateAccountStateSubmitting
extends UpdateAccountPayloadSubmitting {
  status: 'submitting';
}

export interface UpdateAccountPayloadPendingConfirmation {
  email?: string;
  initConfirmationToken?: string;
  error?: {
    kind: 'user' | 'system';
    reason?: string;
  };
}

export interface UpdateAccountStatePendingConfirmation
extends UpdateAccountPayloadPendingConfirmation {
  status: 'pending_confirmation';
}

export interface UpdateAccountPayloadRequestingConfirmation {
  confirmationToken: string;
  email?: string;
}

export interface UpdateAccountStateRequestingConfirmation
extends UpdateAccountPayloadRequestingConfirmation {
  status: 'requesting_confirmation';
}

export interface UpdateAccountPayloadConfirmed {
  userData: PatchPermanentUserResPayload;
}

export interface UpdateAccountStateConfirmed
extends UpdateAccountPayloadConfirmed {
  status: 'confirmed';
}

export type UpdateAccountState =
  | UpdateAccountStatePendingSubmission
  | UpdateAccountStateSubmitting
  | UpdateAccountStatePendingConfirmation
  | UpdateAccountStateRequestingConfirmation
  | UpdateAccountStateConfirmed
;

const initialState : UpdateAccountState = ({
  status: 'pending_submission',
});

const updateAccountSlice = createSlice({
  name: 'userFlows/updateAccount',
  initialState: initialState as UpdateAccountState,
  reducers: {
    setUpdateAccountPendingSubmission(
      _state,
      action: PayloadAction<UpdateAccountPayloadPendingSubmission>
    ) {
      const newState : UpdateAccountStatePendingSubmission = ({
        ...action.payload,
        status: 'pending_submission',
      });

      return newState;
    },
    setUpdateAccountSubmitting(
      _state,
      action: PayloadAction<UpdateAccountPayloadSubmitting>
    ) {
      const newState : UpdateAccountStateSubmitting = ({
        ...action.payload,
        status: 'submitting',
      });

      return newState;
    },
    setUpdateAccountPendingConfirmation(
      _state,
      action: PayloadAction<UpdateAccountPayloadPendingConfirmation>
    ) {
      const newState : UpdateAccountStatePendingConfirmation = ({
        ...action.payload,
        status: 'pending_confirmation',
      });

      return newState;
    },
    setUpdateAccountRequestingConfirmation(
      _state,
      action: PayloadAction<UpdateAccountPayloadRequestingConfirmation>
    ) {
      const newState : UpdateAccountStateRequestingConfirmation = ({
        ...action.payload,
        status: 'requesting_confirmation',
      });

      return newState;
    },
    setUpdateAccountConfirmed(
      _state,
      action: PayloadAction<UpdateAccountPayloadConfirmed>
    ) {
      const newState : UpdateAccountStateConfirmed = ({
        ...action.payload,
        status: 'confirmed',
      });

      return newState;
    },
  },
});// -- end const updateAccountSlice

export const {
  setUpdateAccountPendingSubmission,
  setUpdateAccountSubmitting,
  setUpdateAccountPendingConfirmation,
  setUpdateAccountRequestingConfirmation,
  setUpdateAccountConfirmed,
} = updateAccountSlice.actions;

export type UpdateAccountActions =
  | ReturnType<typeof setUpdateAccountPendingSubmission>
  | ReturnType<typeof setUpdateAccountSubmitting>
  | ReturnType<typeof setUpdateAccountPendingConfirmation>
  | ReturnType<typeof setUpdateAccountRequestingConfirmation>
  | ReturnType<typeof setUpdateAccountConfirmed>
;

export default updateAccountSlice.reducer;
