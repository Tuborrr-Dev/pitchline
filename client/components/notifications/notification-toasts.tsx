"use client";

import { Activity, AlertTriangle, Flame, PauseCircle, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { useNotifications } from "@/context/notification-provider";
import type { MatchNotificationItem, NotificationType } from "@/lib/types/notification";
import { cn } from "@/lib/utils";

function getNotificationConfig(type: NotificationType) {
  switch (type) {
    case "Goal":
      return {
        icon: Flame,
        border: "border-emerald-500/50",
        iconTone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
        progress: "bg-emerald-500",
      };
    case "PeakSwing":
      return {
        icon: TrendingUp,
        border: "border-cyan-500/50",
        iconTone: "border-cyan-500/40 bg-cyan-500/15 text-cyan-400",
        progress: "bg-cyan-500",
      };
    case "VolatilitySpike":
      return {
        icon: Activity,
        border: "border-amber-500/50",
        iconTone: "border-amber-500/40 bg-amber-500/15 text-amber-400",
        progress: "bg-amber-500",
      };
    case "MarketFreeze":
      return {
        icon: PauseCircle,
        border: "border-rose-500/50",
        iconTone: "border-rose-500/40 bg-rose-500/15 text-rose-400",
        progress: "bg-rose-500",
      };
    default:
      return {
        icon: AlertTriangle,
        border: "border-[var(--terminal-border)]",
        iconTone: "border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]",
        progress: "bg-[var(--terminal-text-muted)]",
      };
  }
}

function NotificationToast({
  item,
  onDismiss,
}: {
  item: MatchNotificationItem;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const config = getNotificationConfig(item.type);
  const Icon = config.icon;

  function handleOpenChange(open: boolean) {
    if (!open) {
      onDismiss();
    }
  }

  function handleClick() {
    if (!item.fixtureId) return;
    router.push(`/match/${item.fixtureId}`);
    onDismiss();
  }

  return (
    <Toast
      duration={5500}
      onClick={handleClick}
      onOpenChange={handleOpenChange}
      className={cn("cursor-pointer", config.border)}
    >
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", config.iconTone)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ToastTitle>{item.title}</ToastTitle>
          <span className="shrink-0 rounded border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--terminal-text-muted)]">
            {item.minute}
          </span>
        </div>
        <ToastDescription>{item.message}</ToastDescription>
      </div>

      <ToastClose
        onClick={(event) => {
          event.stopPropagation();
        }}
      />

      <div className={cn("absolute bottom-0 left-0 h-[2px] w-full origin-left animate-[shrink_5.5s_linear_forwards] opacity-80", config.progress)} />
    </Toast>
  );
}

export function NotificationToasts() {
  const { activeToasts, dismissToast } = useNotifications();

  return (
    <ToastProvider>
      {activeToasts.map((toast) => (
        <NotificationToast key={toast.id} item={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
