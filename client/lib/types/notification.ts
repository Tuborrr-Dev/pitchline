export type NotificationType = "Goal" | "PeakSwing" | "VolatilitySpike" | "MarketFreeze";
export type NotificationSeverity = "Info" | "Success" | "Warning" | "Critical";

export interface MatchNotificationItem {
  id: string;
  fixtureId: string;
  homeName: string;
  awayName: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  minute: string;
  timestamp: number;
  read: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  audioEnabled: boolean;
  goalAlerts: boolean;
  peakSwingAlerts: boolean;
  volatilityAlerts: boolean;
  freezeAlerts: boolean;
}
