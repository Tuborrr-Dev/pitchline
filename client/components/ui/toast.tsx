"use client";

import { Toast as ToastPrimitives } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function ToastProvider({
  swipeDirection = "right",
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Provider>) {
  return <ToastPrimitives.Provider swipeDirection={swipeDirection} {...props} />;
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Viewport>) {
  return (
    <ToastPrimitives.Viewport
      className={cn(
        "fixed right-4 top-4 z-[9999] flex max-h-screen w-full flex-col gap-2.5 p-4 sm:max-w-sm",
        className,
      )}
      {...props}
    />
  );
}

function Toast({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Root>) {
  return (
    <ToastPrimitives.Root
      className={cn(
        "group pointer-events-auto relative grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 overflow-hidden rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-3.5 text-[var(--terminal-text)] shadow-xl shadow-[var(--terminal-shadow)] backdrop-blur-md transition-all",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
        "data-[state=closed]:translate-x-full data-[state=closed]:opacity-0 data-[state=open]:translate-x-0 data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Action>) {
  return (
    <ToastPrimitives.Action
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 text-xs font-medium text-[var(--terminal-text-strong)] transition-colors hover:bg-[var(--terminal-hover)]",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Close>) {
  return (
    <ToastPrimitives.Close
      className={cn(
        "rounded-md p-1 text-[var(--terminal-text-muted)] opacity-80 transition-colors hover:bg-[var(--terminal-hover)] hover:text-[var(--terminal-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)]",
        className,
      )}
      toast-close=""
      {...props}
    >
      <X className="h-3.5 w-3.5" />
    </ToastPrimitives.Close>
  );
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Title>) {
  return (
    <ToastPrimitives.Title
      className={cn("truncate text-xs font-semibold text-[var(--terminal-text-strong)]", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitives.Description>) {
  return (
    <ToastPrimitives.Description
      className={cn("mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--terminal-text-muted)]", className)}
      {...props}
    />
  );
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
