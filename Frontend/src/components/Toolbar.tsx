import React, {
  useContext,
} from 'react';

import WhiteboardContext from '@/context/WhiteboardContext';

import { getToolChoiceLabel, getTooltip } from '@/components/Tool';

import type { ToolChoice } from '@/components/Tool';

import type { LucideIcon } from 'lucide-react';
import TooltipHover from './TooltipHover';

interface ToolbarProps {
  toolChoice: ToolChoice;
  onToolChange: (choice: ToolChoice) => void;
}

interface ToolbarButtonProps {
  label: LucideIcon;
  variant: 'default' | 'selected';
  onClick?: () => void;
  tooltip: string;
}
const tools: ToolChoice[] = [
  "hand",
  "vector",
  "rect",
  "ellipse",
  "text",
  "create_canvas",
];

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ label, variant, onClick, tooltip }, ref) => {
    const Icon = label;
    
    return (
      <TooltipHover text={tooltip}>
        <button
          ref={ref}
          onClick={onClick}
          className={`p-2 place-items-center rounded-xl hover:cursor-pointer ${variant === 'selected' && 'text-header-button-text-hover bg-header-button-background border-1 border-border'} hover:bg-header-button-background-hover hover:text-header-button-text-hover`}
        >
          <Icon />
        </button>
      </TooltipHover>
    )
  }
);

function Toolbar({ toolChoice, onToolChange }: ToolbarProps) {
  const context = useContext(WhiteboardContext);
  if (!context) {
    throw new Error('No WhiteboardContext provided');
  }

  const renderToolChoice = (choice: ToolChoice): React.JSX.Element => (
    <ToolbarButton
      key={choice}
      label={getToolChoiceLabel(choice)}
      variant={choice === toolChoice ? 'selected' : 'default'}
      onClick={() => onToolChange(choice)}
      tooltip={getTooltip(choice)}
    />
  );

  return (
    <div className="max-w-40 flex flex-col flex-shrink-0 text-center p-2 rounded-lg shadow-2xl backdrop-blur-md bg-bar-background/80 border-1 border-border">
      <h2 className="text-md text-h1-text font-bold mb-1">Tools</h2>
      {tools.map((tool) => renderToolChoice(tool))}

      {/** Additional, non-tool choices **/}

      {/** Import Image Button - Future implementation **/}
      {/* <ToolbarButton
        label="Import Image"
        variant="default"
      /> */}
    </div>
  )
}

export default Toolbar;
