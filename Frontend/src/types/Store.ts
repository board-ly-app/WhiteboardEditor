// === Store.ts ================================================================
//
// Defines types as stored in the redux state store.
//
// =============================================================================

import {
  type WhiteboardAttribs,
} from '@/types/WebSocketProtocol';

import {
  type ToolChoice,
} from '@/components/Tool';

export type ZoomFocusEnum =
  | 'center'
  | 'pointer'
;

// Contains all data held for a whiteboard in the state store
export interface WhiteboardState extends WhiteboardAttribs {
  currentZoom: number;
  currentZoomFocus: ZoomFocusEnum;
  currentTool: ToolChoice;
  tooltipText: string;
  editingText: string;
}
