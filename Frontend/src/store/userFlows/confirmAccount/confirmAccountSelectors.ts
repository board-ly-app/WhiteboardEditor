import {
  type RootState,
} from '@/store';

import {
  type ConfirmAccountState,
} from './confirmAccountSlice';

export const selectConfirmAccountFlowState = (
  state: RootState
): ConfirmAccountState => {
  return state.confirmAccountFlow;
};// -- end selectConfirmAccountFlowState
