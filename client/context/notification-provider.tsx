"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { createContext, useContext, useEffect, useCallback, useState } from "react";

import { getApiBaseUrl } from "@/config/api";
import { playAudioCue } from "@/lib/audio-cue";
import { MatchNotificationItem, NotificationPreferences, NotificationType } from "@/lib/types/notification";

interface NotificationContextType {
  notifications: MatchNotificationItem[];
  activeToasts: MatchNotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences;
  dismissToast: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
  addNotification: (item: Omit<MatchNotificationItem, "id" | "timestamp" | "read">) => void;
}

const defaultPreferences: NotificationPreferences = {
  audioEnabled: true,
  goalAlerts: true,
  peakSwingAlerts: true,
  volatilityAlerts: true,
  freezeAlerts: true,
};

const NotificationContext = createContext<NotificationContextType | null>(null);

const STORAGE_KEY = "pitchline_notifications_v1";
const PREFS_KEY = "pitchline_notification_prefs_v1";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<MatchNotificationItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const savedNotifs = localStorage.getItem(STORAGE_KEY);
      return savedNotifs ? JSON.parse(savedNotifs) : [];
    } catch {
      return [];
    }
  });
  const [activeToasts, setActiveToasts] = useState<MatchNotificationItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences;
    try {
      const savedPrefs = localStorage.getItem(PREFS_KEY);
      return savedPrefs ? { ...defaultPreferences, ...JSON.parse(savedPrefs) } : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  // Sync to localStorage
  const saveNotifications = (items: MatchNotificationItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    } catch {
      // Ignore storage errors
    }
  };

  const savePreferences = (prefs: NotificationPreferences) => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage errors
    }
  };

  const handleIncomingNotification = useCallback((rawNotif: Partial<MatchNotificationItem>) => {
    const type: NotificationType = rawNotif.type || "Goal";

    // Filter by preferences
    if (type === "Goal" && !preferences.goalAlerts) return;
    if (type === "PeakSwing" && !preferences.peakSwingAlerts) return;
    if (type === "VolatilitySpike" && !preferences.volatilityAlerts) return;
    if (type === "MarketFreeze" && !preferences.freezeAlerts) return;

    const notifItem: MatchNotificationItem = {
      id: rawNotif.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fixtureId: String(rawNotif.fixtureId || ""),
      homeName: rawNotif.homeName || "Home Team",
      awayName: rawNotif.awayName || "Away Team",
      type,
      severity: rawNotif.severity || "Info",
      title: rawNotif.title || "Match Alert",
      message: rawNotif.message || "",
      minute: rawNotif.minute || "0'",
      timestamp: rawNotif.timestamp || Date.now(),
      read: false,
      metadata: rawNotif.metadata,
    };

    setNotifications((prev) => {
      // Prevent duplicate notification IDs within brief window
      if (prev.some((item) => item.id === notifItem.id)) return prev;
      const updated = [notifItem, ...prev].slice(0, 50);
      saveNotifications(updated);
      return updated;
    });

    setActiveToasts((prev) => [notifItem, ...prev].slice(0, 4));

    if (preferences.audioEnabled) {
      playAudioCue(type);
    }
  }, [preferences]);

  // Global SignalR listener for live match notifications
  useEffect(() => {
    const hubUrl = `${getApiBaseUrl()}/hubs/match`;
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 1000, 3000, 5000, 10000])
      .configureLogging(LogLevel.Warning)
      .build();

    let isSubscribed = true;

    connection
      .start()
      .then(async () => {
        if (!isSubscribed) return;
        await connection.invoke("JoinLobby").catch(() => {});
      })
      .catch(() => {});

    connection.on("MatchNotification", (payload: Partial<MatchNotificationItem>) => {
      if (isSubscribed) {
        handleIncomingNotification(payload);
      }
    });

    return () => {
      isSubscribed = false;
      connection.off("MatchNotification");
      connection.stop().catch(() => {});
    };
  }, []);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((item) => ({ ...item, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const updatePreferences = (patch: Partial<NotificationPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      savePreferences(next);
      return next;
    });
  };

  const addNotification = (item: Omit<MatchNotificationItem, "id" | "timestamp" | "read">) => {
    handleIncomingNotification(item);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        activeToasts,
        unreadCount,
        preferences,
        dismissToast,
        markAllAsRead,
        clearAll,
        updatePreferences,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
