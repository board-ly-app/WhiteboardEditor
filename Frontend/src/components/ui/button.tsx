import * as React from "react"

import {
  Slot,
} from "@radix-ui/react-slot"

import type {
  VariantProps,
} from "class-variance-authority"

import {
  LoaderCircle,
} from 'lucide-react';

import {
  cn,
} from "@/lib/utils"

import {
  buttonVariants,
} from "./button-variants"

export type ButtonStatus =
  | 'enabled'
  | 'disabled'
  // -- pending is meant to indicate that the action triggered by the button has
  // is pending completion
  | 'pending'
;

export type ButtonProps =
  & React.ComponentProps<"button">
  & VariantProps<typeof buttonVariants>
  & {
    status?: ButtonStatus;
    asChild?: boolean;
  }
;

const Button = ({
  className,
  variant,
  size,
  status = 'enabled',
  asChild = false,
  children,
  ...props
}: ButtonProps) => {
  const Comp = asChild ? Slot : "button"
  let isDisabled : boolean;
  let innerContent : typeof children;

  switch (status) {
    case 'enabled':
      isDisabled = false;
      innerContent = children;
      break;
    case 'disabled':
      isDisabled = true;
      innerContent = children;
      break;
    case 'pending':
      isDisabled = true;
      innerContent = (
        <>
          {children}
          <LoaderCircle className="animate-spin" />
        </>
      );
      break;
  }// -- end switch (status)

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={isDisabled}
      {...props}
    >
      {innerContent}
    </Comp>
  )
};// -- end Button

export { Button }
