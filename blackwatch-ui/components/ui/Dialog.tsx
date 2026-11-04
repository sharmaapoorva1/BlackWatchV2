"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Shared overlay layer for every modal surface (centered dialog, top-anchored
// command palette, right-hand sheet). One z-index pair means a dialog opened
// from inside a sheet (e.g. an IP lookup) always stacks above it, because
// portals mount in open order.

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-[60] bg-black/60", className)} {...props} />
));
DialogOverlay.displayName = "DialogOverlay";

const dialogContentVariants = cva(
  "fixed z-[61] border border-line bg-surface-1 shadow-2xl focus:outline-none",
  {
    variants: {
      placement: {
        center:
          "left-1/2 top-1/2 max-h-[90vh] w-[min(900px,95vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-md",
        top: "left-1/2 top-[12vh] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-md",
        right: "inset-y-0 right-0 flex w-[min(30rem,100vw)] flex-col border-y-0 border-r-0",
      },
    },
    defaultVariants: { placement: "center" },
  },
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

/** Modal surface. `placement`: `center` (default), `top` (palette) or `right` (sheet). */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, placement, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(dialogContentVariants({ placement }), className)} {...props}>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
