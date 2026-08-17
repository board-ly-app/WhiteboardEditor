import {
  type RootState,
} from '@/store';

import {
  type SignupState,
} from './signupSlice';

export const selectSignupFlowState = (
  state: RootState
): SignupState => {
  return state.signupFlow;
};// -- end selectSignupFlowState
