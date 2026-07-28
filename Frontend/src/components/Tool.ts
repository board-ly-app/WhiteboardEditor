import {
  type LucideIcon,
  Hand,
  Minus,
  RectangleHorizontal,
  Circle,
  ALargeSmall,
  SquarePlus,
  BoxSelect,
  Image,
} from 'lucide-react';

export type ToolChoice =
  | 'hand'
  | 'rect'
  | 'ellipse'
  | 'vector'
  | 'text'
  | 'import_image'
  | 'create_canvas'
  | 'select'
;

const getToolChoiceLabel = (toolChoice: ToolChoice): LucideIcon => {
  switch (toolChoice) {
    case 'hand':
      return Hand;
    case 'rect':
      return RectangleHorizontal;
    case 'vector':
      return Minus;
    case 'ellipse':
      return Circle;
    case 'text':
      return ALargeSmall;
    case 'import_image':
      return Image;
    case 'create_canvas':
      return SquarePlus;
    case 'select':
      return BoxSelect;
    default:
      throw new Error(`Unrecognized tool choice: ${toolChoice}`);
  }// end switch (toolChoice)
};// end getToolChoiceLabel

export const getTooltip = (toolChoice: ToolChoice): string => {
  switch (toolChoice) {
    case 'hand':
      return "Move Shapes";
    case 'rect':
      return "Draw Rectangle";
    case 'vector':
      return "Draw Line";
    case 'ellipse':
      return "Draw Ellipse";
    case 'text':
      return "Add Text";
    case 'import_image':
      return "Import an Image";
    case 'create_canvas':
      return "Create a new Canvas";
    case 'select':
      return "Select Shape(s)";
    default:
      throw new Error(`Unrecognized tool choice: ${toolChoice}`);
  }
}

export {
  getToolChoiceLabel
};
