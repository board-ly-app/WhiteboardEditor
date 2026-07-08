import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";

export interface AppPopoverProps {
  /** Whether the popover is currently open (controlled). */
  open?: boolean;
  /** Called when the open state should change. */
  onOpenChange?: (open: boolean) => void;
  /** Element that toggles the popover; wrapped in PopoverTrigger. */
  trigger: React.ReactNode;
  /** Optional heading rendered with the same typography as AppModal. */
  title?: React.ReactNode;
  /** Whether the popover traps focus / behaves modally. */
  modal?: boolean;
  /** Alignment of the content relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Offset (px) between the trigger and the content. */
  sideOffset?: number;
  /** Extra classes merged onto the content container. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * Generic application popover built on the shadcn Popover primitives. Shares the
 * same header typography as {@link AppModal} so anchored popovers read as part
 * of the same visual family as the app's modals.
 */
export function AppPopover({
  open,
  onOpenChange,
  trigger,
  title,
  modal,
  align,
  sideOffset,
  className,
  children,
}: AppPopoverProps): React.JSX.Element {
  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className={cn(className)}
      >
        {title && (
          <div className="flex flex-col gap-2 text-center mb-4">
            <h2 className="text-xl leading-none font-semibold">{title}</h2>
          </div>
        )}
        {children}
      </PopoverContent>
    </Popover>
  );
}

export default AppPopover;
