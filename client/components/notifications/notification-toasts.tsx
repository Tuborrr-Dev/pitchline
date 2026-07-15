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
        bgGradient: "from-emerald-950/90 via-slate-900/95 to-emerald-900/40",
        borderColor: "border-emerald-500/50",
        glowColor: "shadow-emerald-500/20",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
        progressBg: "bg-emerald-500",
      };
    case "PeakSwing":
      return {
        icon: TrendingUp,
        bgGradient: "from-cyan-950/90 via-slate-900/95 to-indigo-950/40",
        borderColor: "border-cyan-500/50",
        glowColor: "shadow-cyan-500/20",
        badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        progressBg: "bg-cyan-500",
      };
    case "VolatilitySpike":
      return {
        icon: Activity,
        bgGradient: "from-amber-950/90 via-slate-900/95 to-orange-950/40",
        borderColor: "border-amber-500/50",
        glowColor: "shadow-amber-500/20",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        progressBg: "bg-amber-500",
      };
    case "MarketFreeze":
      return {
        icon: PauseCircle,
        bgGradient: "from-rose-950/90 via-slate-900/95 to-red-950/40",
        borderColor: "border-rose-500/50",
        glowColor: "shadow-rose-500/20",
        badgeBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
        progressBg: "bg-rose-500",
      };
    default:
      return {
        icon: AlertTriangle,
        bgGradient: "from-slate-900/95 to-slate-950/90",
        borderColor: "border-slate-700/50",
        glowColor: "shadow-slate-500/10",
        badgeBg: "bg-slate-700/30 text-slate-300 border-slate-600/40",
        progressBg: "bg-slate-400",
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
      className={`pointer-events-auto relative group flex flex-col overflow-hidden rounded-xl border ${config.borderColor} bg-gradient-to-r ${config.bgGradient} backdrop-blur-md p-3.5 shadow-xl ${config.glowColor} cursor-pointer transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${config.badgeBg}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-xs text-slate-100 truncate">{item.title}</span>
            <span className="shrink-0 text-[10px] font-mono text-slate-400 bg-slate-950/50 px-1.5 py-0.5 rounded border border-slate-800">
              {item.minute}
            </span>
          </div>

          <p className="mt-1 font-sans text-xs text-slate-300 line-clamp-2 leading-relaxed">{item.message}</p>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 w-full max-w-sm px-4 sm:px-0 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {activeToasts.map((toast) => (
          <ToastCard key={toast.id} item={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
