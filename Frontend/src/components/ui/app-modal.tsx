import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
} as const;

export type AppModalSize = keyof typeof SIZE_CLASSES;

export interface AppModalProps {
  /** Whether the modal is currently open. */
  open: boolean;
  /** Called when the open state should change (backdrop click, esc, close button). */
  onOpenChange: (open: boolean) => void;
  /** Heading rendered in the modal header (required for accessibility). */
  title: React.ReactNode;
  /** Optional supporting text rendered beneath the title. */
  description?: React.ReactNode;
  /** Optional action buttons rendered in the footer. */
  footer?: React.ReactNode;
  /** Controls the max width of the modal. Defaults to "md". */
  size?: AppModalSize;
  /** Whether to show the top-right close button. Defaults to true. */
  showCloseButton?: boolean;
  /** Optional trigger element; wrapped in DialogTrigger when provided. */
  trigger?: React.ReactNode;
  /** Extra classes merged onto the content container. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * Generic application modal built on the shadcn Dialog primitives. Provides a
 * consistent header / body / footer layout, backdrop, animations, focus trap,
 * esc-to-close, and a top-right close button across the whole app.
 */
export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  showCloseButton = true,
  trigger,
  className,
  children,
}: AppModalProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(SIZE_CLASSES[size], className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export default AppModal;
