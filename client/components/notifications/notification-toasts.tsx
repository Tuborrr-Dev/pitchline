"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, Flame, PauseCircle, TrendingUp, X } from "lucide-react";
import { useEffect } from "react";

import { useNotifications } from "@/context/notification-provider";
import { MatchNotificationItem, NotificationType } from "@/lib/types/notification";

function getNotificationConfig(type: NotificationType) {
  switch (type) {
    case "Goal":
      return {
        icon: Flame,
        bgSurface: "bg-[var(--terminal-panel)]",
        borderColor: "border-emerald-500/50",
        glowColor: "shadow-emerald-500/20",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        progressBg: "bg-emerald-500",
      };
    case "PeakSwing":
      return {
        icon: TrendingUp,
        bgSurface: "bg-[var(--terminal-panel)]",
        borderColor: "border-cyan-500/50",
        glowColor: "shadow-cyan-500/20",
        badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        progressBg: "bg-cyan-500",
      };
    case "VolatilitySpike":
      return {
        icon: Activity,
        bgSurface: "bg-[var(--terminal-panel)]",
        borderColor: "border-amber-500/50",
        glowColor: "shadow-amber-500/20",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        progressBg: "bg-amber-500",
      };
    case "MarketFreeze":
      return {
        icon: PauseCircle,
        bgSurface: "bg-[var(--terminal-panel)]",
        borderColor: "border-rose-500/50",
        glowColor: "shadow-rose-500/20",
        badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        progressBg: "bg-rose-500",
      };
    default:
      return {
        icon: AlertTriangle,
        bgSurface: "bg-[var(--terminal-panel)]",
        borderColor: "border-[var(--terminal-border)]",
        glowColor: "shadow-slate-500/10",
        badgeBg: "bg-[var(--terminal-surface)] text-[var(--terminal-text)] border-[var(--terminal-border)]",
        progressBg: "bg-[var(--terminal-text-muted)]",
      };
  }
}

function ToastCard({ item, onDismiss }: { item: MatchNotificationItem; onDismiss: () => void }) {
  const router = useRouter();
  const config = getNotificationConfig(item.type);
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.fixtureId) {
      router.push(`/match/${item.fixtureId}`);
      onDismiss();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: 50 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={handleCardClick}
      className={`pointer-events-auto group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border ${config.borderColor} ${config.bgSurface} p-3.5 text-[var(--terminal-text)] shadow-xl ${config.glowColor} backdrop-blur-md transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${config.badgeBg}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 pr-5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-[var(--terminal-text-strong)]">{item.title}</span>
            <span className="shrink-0 rounded border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--terminal-text-muted)]">
              {item.minute}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed text-[var(--terminal-text-muted)]">{item.message}</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute right-2.5 top-2.5 rounded-md p-1 text-[var(--terminal-text-muted)] transition-colors hover:bg-[var(--terminal-hover)] hover:text-[var(--terminal-text-strong)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress timer bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 5.5, ease: "linear" }}
        className={`absolute bottom-0 left-0 right-0 h-[3px] origin-left ${config.progressBg} opacity-80`}
      />
    </motion.div>
  );
}

export function NotificationToasts() {
  const { activeToasts, dismissToast } = useNotifications();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0">
      <AnimatePresence mode="popLayout">
        {activeToasts.map((toast) => (
          <ToastCard key={toast.id} item={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
