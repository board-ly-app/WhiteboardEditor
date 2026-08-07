import {
  type RootState,
} from '@/store';

import {
  type CreateCanvasState,
} from './createCanvasSlice';

export const selectCreateCanvasFlowState = (
  state: RootState
): CreateCanvasState => {
  return state.createCanvasFlow;
};// -- end selectCreateCanvasFlowState
