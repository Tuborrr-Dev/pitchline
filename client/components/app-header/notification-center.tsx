"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Activity, Bell, CheckCheck, Flame, PauseCircle, Settings2, Trash2, TrendingUp, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNotifications } from "@/context/notification-provider";
import { MatchNotificationItem, NotificationType } from "@/lib/types/notification";
import { cn } from "@/lib/utils";

type FilterTab = "All" | "Goal" | "PeakSwing" | "VolatilitySpike" | "MarketFreeze";

function getItemIcon(type: NotificationType) {
  switch (type) {
    case "Goal":
      return <Flame className="h-3.5 w-3.5 text-emerald-400" />;
    case "PeakSwing":
      return <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />;
    case "VolatilitySpike":
      return <Activity className="h-3.5 w-3.5 text-amber-400" />;
    case "MarketFreeze":
      return <PauseCircle className="h-3.5 w-3.5 text-rose-400" />;
    default:
      return <Bell className="h-3.5 w-3.5 text-slate-400" />;
  }
}

export function NotificationCenter() {
  const { notifications, unreadCount, preferences, markAllAsRead, clearAll, updatePreferences } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "All") return true;
    return item.type === activeTab;
  });

  const handleOpenToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleItemClick = (item: MatchNotificationItem) => {
    if (item.fixtureId) {
      router.push(`/match/${item.fixtureId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleOpenToggle}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-bg)] text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-white",
          isOpen && "border-emerald-500/60 bg-slate-900 text-white shadow-lg shadow-emerald-500/10",
        )}
        title="Live Notifications"
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[10px] font-bold text-slate-950 shadow-md animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 top-11 z-[999] w-[340px] sm:w-[380px] overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-slate-950/95 p-0 shadow-2xl backdrop-blur-xl"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-[var(--terminal-border)] bg-slate-900/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm tracking-wide text-slate-100">MATCH FEED</span>
                {notifications.length > 0 && (
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                    {notifications.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => updatePreferences({ audioEnabled: !preferences.audioEnabled })}
                  className={cn(
                    "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                    preferences.audioEnabled && "text-emerald-400",
                  )}
                  title={preferences.audioEnabled ? "Mute Audio Cues" : "Unmute Audio Cues"}
                >
                  {preferences.audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                    showSettings && "bg-slate-800 text-emerald-400",
                  )}
                  title="Filter Settings"
                >
                  <Settings2 className="h-4 w-4" />
                </button>

                <button
                  onClick={clearAll}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Clear All Notifications"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Settings drawer */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-[var(--terminal-border)] bg-slate-900/60 p-3 text-xs text-slate-300"
                >
                  <div className="font-semibold mb-2 text-slate-200">Alert Toggles</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.goalAlerts}
                        onChange={(e) => updatePreferences({ goalAlerts: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0"
                      />
                      <span>Goal Alerts</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.peakSwingAlerts}
                        onChange={(e) => updatePreferences({ peakSwingAlerts: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <span>Peak Swing Alerts</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.volatilityAlerts}
                        onChange={(e) => updatePreferences({ volatilityAlerts: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0"
                      />
                      <span>Volatility Spikes</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.freezeAlerts}
                        onChange={(e) => updatePreferences({ freezeAlerts: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0"
                      />
                      <span>Market Suspensions</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category Filter Tabs */}
            <div className="flex border-b border-[var(--terminal-border)] bg-slate-900/40 px-2 py-1.5 overflow-x-auto">
              {(["All", "Goal", "PeakSwing", "VolatilitySpike", "MarketFreeze"] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap",
                    activeTab === tab
                      ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50",
                  )}
                >
                  {tab === "All"
                    ? "All"
                    : tab === "Goal"
                      ? "⚽ Goals"
                      : tab === "PeakSwing"
                        ? "⚡ Swings"
                        : tab === "VolatilitySpike"
                          ? "📊 Volatility"
                          : "⏸️ Freeze"}
                </button>
              ))}
            </div>

            {/* List Body */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/40">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <Bell className="h-6 w-6 mb-2 opacity-40" />
                  <span>No live events recorded yet in session</span>
                </div>
              ) : (
                filteredNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group flex items-start gap-3 p-3 transition-colors hover:bg-slate-900/60 cursor-pointer"
                  >
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900">
                      {getItemIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-200 truncate">{item.title}</span>
                        <span className="font-mono text-[10px] text-slate-500">{item.minute}</span>
                      </div>
                      <p className="mt-0.5 font-sans text-xs text-slate-400 line-clamp-2">{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="flex items-center justify-between border-t border-[var(--terminal-border)] bg-slate-900/80 px-3 py-2 text-[11px] text-slate-400">
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 hover:text-slate-200 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mark all as read</span>
                </button>
                <span>Live SignalR Feed</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
