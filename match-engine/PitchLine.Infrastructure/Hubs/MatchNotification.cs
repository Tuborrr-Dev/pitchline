namespace Pitchline.Infrastructure.Hubs;

public enum NotificationType
{
    Goal,
    PeakSwing,
    VolatilitySpike,
    MarketFreeze
}

public enum NotificationSeverity
{
    Info,
    Success,
    Warning,
    Critical
}

public record MatchNotificationPayload(
    string Id,
    string FixtureId,
    string HomeName,
    string AwayName,
    NotificationType Type,
    NotificationSeverity Severity,
    string Title,
    string Message,
    string Minute,
    long Timestamp,
    object? Metadata
);
