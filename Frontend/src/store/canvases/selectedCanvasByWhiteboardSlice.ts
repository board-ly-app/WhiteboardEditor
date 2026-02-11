
// -- third-party imports
import {
  createSlice,
  type PayloadAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type WhiteboardIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

interface SelectedCanvasByWhiteboardState {
  selectedCanvasByWhiteboard: Record<WhiteboardIdType, CanvasIdType>;
  whiteboardBySelectedCanvas: Record<CanvasIdType, WhiteboardIdType>;
}

const selectedCanvasByWhiteboardSlice = createSlice({
  name: 'selectedCanvasByWhiteboard',
  initialState: {
    selectedCanvasByWhiteboard: {},
    whiteboardBySelectedCanvas: {},
  } as SelectedCanvasByWhiteboardState,
  reducers: {
    setSelectedCanvasByWhiteboard(
      state,
      action: PayloadAction<{ canvasId: CanvasIdType; whiteboardId: WhiteboardIdType; }>
    ) {
      const {
        selectedCanvasByWhiteboard,
        whiteboardBySelectedCanvas,
      } = state;
      const {
        canvasId,
        whiteboardId,
      } = action.payload;

      selectedCanvasByWhiteboard[whiteboardId] = canvasId;
      whiteboardBySelectedCanvas[canvasId] = whiteboardId;

      return state;
    },
    unselectCanvas(state, action: PayloadAction<CanvasIdType>) {
      const {
        whiteboardBySelectedCanvas,
        selectedCanvasByWhiteboard,
      } = state;
      const canvasId = action.payload;

      if (canvasId in whiteboardBySelectedCanvas) {
        delete selectedCanvasByWhiteboard[whiteboardBySelectedCanvas[canvasId]];
        delete whiteboardBySelectedCanvas[canvasId];
      }

      return state;
    },
    unselectCanvasByWhiteboard(state, action: PayloadAction<WhiteboardIdType>) {
      const {
        whiteboardBySelectedCanvas,
        selectedCanvasByWhiteboard,
      } = state;
      const whiteboardId = action.payload;

      if (whiteboardId in selectedCanvasByWhiteboard) {
        delete whiteboardBySelectedCanvas[selectedCanvasByWhiteboard[whiteboardId]];
        delete selectedCanvasByWhiteboard[whiteboardId];
      }

      return state;
    },
  },
  selectors: {
    selectSelectedCanvasByWhiteboard(state, whiteboardId: WhiteboardIdType): CanvasIdType | undefined {
      return state.selectedCanvasByWhiteboard[whiteboardId];
    },
  },
});

export const {
  setSelectedCanvasByWhiteboard,
  unselectCanvas,
  unselectCanvasByWhiteboard,
} = selectedCanvasByWhiteboardSlice.actions;

export const {
  selectSelectedCanvasByWhiteboard,
} = selectedCanvasByWhiteboardSlice.selectors;

export default selectedCanvasByWhiteboardSlice.reducer;
