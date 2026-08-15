import {
  type RootState,
} from '@/store';

import {
  type LoginState,
} from './loginSlice';

export const selectLoginFlowState = (
  state: RootState
): LoginState => {
  return state.loginFlow;
};// -- end selectLoginFlowState
