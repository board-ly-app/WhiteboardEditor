// === shapeAttributesReducer ==================================================
//
// Controls the attributes that newly drawn shapes are given, independent of any
// single action. This includes colors, border widths, etc.
//
// =============================================================================

// -- local imports
import type {
  ShapeModelBase,
  TextAlign,
  TextVerticalAlign,
  ArrowTip,
} from '@/types/CanvasObjectModel';

// === ShapeAttributesState ====================================================
//
// Defines the basic attributes newly drawn shapes will have.
//
// =============================================================================
export type ShapeAttributesState = ShapeModelBase & {
  align: TextAlign;
  verticalAlign: TextVerticalAlign;
  arrowStart: ArrowTip;
  arrowEnd: ArrowTip;
  shadow: number;
  cornerRadius: number;
};

export type ShapeAttributesAction =
  | { type: 'SET_FILL_COLOR'; payload: string }
  | { type: 'SET_STROKE_COLOR'; payload: string }
  | { type: 'SET_STROKE_WIDTH'; payload: number }
  | { type: 'SET_FONT_SIZE'; payload: number }
  | { type: 'SET_FONT_COLOR'; payload: string }
  | { type: 'SET_TEXT_ALIGN'; payload: TextAlign }
  | { type: 'SET_TEXT_VERTICAL_ALIGN'; payload: TextVerticalAlign }
  | { type: 'SET_ARROW_START'; payload: ArrowTip }
  | { type: 'SET_ARROW_END'; payload: ArrowTip }
  | { type: 'SET_SHADOW'; payload: number }
  | { type: 'SET_CORNER_RADIUS'; payload: number }
;

const shapeAttributesReducer = (state: ShapeAttributesState, action: ShapeAttributesAction) => {
  switch (action.type) {
    case 'SET_FILL_COLOR':
      return ({ ...state, fillColor: action.payload });
    case 'SET_STROKE_COLOR':
      return ({ ...state, strokeColor: action.payload });
    case 'SET_STROKE_WIDTH':
      return ({ ...state, strokeWidth: action.payload });
    case 'SET_FONT_SIZE':
      return ({ ...state, fontSize: action.payload });
    case 'SET_FONT_COLOR':
      return ({ ...state, color: action.payload });
    case 'SET_TEXT_ALIGN':
      return ({ ...state, align: action.payload });
    case 'SET_TEXT_VERTICAL_ALIGN':
      return ({ ...state, verticalAlign: action.payload });
    case 'SET_ARROW_START':
      return ({ ...state, arrowStart: action.payload });
    case 'SET_ARROW_END':
      return ({ ...state, arrowEnd: action.payload });
    case 'SET_SHADOW':
      return ({ ...state, shadow: action.payload });
    case 'SET_CORNER_RADIUS':
      return ({ ...state, cornerRadius: action.payload });
    default:
      return state;
  }// end switch (action.type)
};

export default shapeAttributesReducer;
