import {
  type RootState,
} from '@/store';

import {
  type UpdateAccountState,
} from './updateAccountSlice';

export const selectUpdateAccountState = (
  state: RootState,
): UpdateAccountState => {
  return state.updateAccountFlow;
};// -- end selectUpdateAccountState
