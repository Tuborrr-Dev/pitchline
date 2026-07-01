using System.Text.Json.Serialization;

namespace Pitchline.Infrastructure.TxLine;

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: These shapes are based on the PRD + TxLINE docs.
// Once you receive real events from the stream, log evt.Data raw first,
// then adjust property names to match the actual JSON payload.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// A single event from /api/scores/stream.
/// Carries match state changes: goals, cards, phase changes, VAR, etc.
/// </summary>
public record ScoreUpdate(
    [property: JsonPropertyName("fixtureId")]  string FixtureId,
    [property: JsonPropertyName("eventType")]  string EventType,   // "goal" | "yellowCard" | "redCard" | "halfTime" | "fullTime" | etc.
    [property: JsonPropertyName("homeScore")]  int    HomeScore,
    [property: JsonPropertyName("awayScore")]  int    AwayScore,
    [property: JsonPropertyName("minute")]     string Minute,       // e.g. "67" or "90+3"
    [property: JsonPropertyName("teamId")]     string? TeamId,      // which team the event belongs to
    [property: JsonPropertyName("playerId")]   string? PlayerId,
    [property: JsonPropertyName("phase")]      string? Phase,       // "H1" | "H2" | "ET" | "PE"
    [property: JsonPropertyName("timestamp")]  DateTimeOffset Timestamp
);

/// <summary>
/// A single event from /api/odds/stream.
/// Carries consensus decimal odds for all three outcomes.
/// </summary>
public record OddsUpdate(
    [property: JsonPropertyName("fixtureId")] string  FixtureId,
    [property: JsonPropertyName("home")]      decimal HomeDecimalOdds,
    [property: JsonPropertyName("draw")]      decimal DrawDecimalOdds,
    [property: JsonPropertyName("away")]      decimal AwayDecimalOdds,
    [property: JsonPropertyName("timestamp")] DateTimeOffset Timestamp
)
{
    /// <summary>
    /// De-margined implied probabilities as per PRD Section 10 formula.
    /// Raw = 1/odds; normalise by sum to strip bookmaker margin.
    /// </summary>
    public (decimal Home, decimal Draw, decimal Away) ToImpliedProbabilities()
    {
        var rawHome = 1m / HomeDecimalOdds;
        var rawDraw = 1m / DrawDecimalOdds;
        var rawAway = 1m / AwayDecimalOdds;
        var sum     = rawHome + rawDraw + rawAway;

        var home = Math.Round(rawHome / sum * 100, 1);
        var away = Math.Round(rawAway / sum * 100, 1);
        // Draw is the residual — ensures home + draw + away == 100.0 exactly
        var draw = Math.Round(100m - home - away, 1);

        return (home, draw, away);
    }
}

/// <summary>Contract between ingestion layer and the rest of the app.</summary>
public interface IMatchEventBus
{
    Task PublishScoreUpdateAsync(ScoreUpdate update, CancellationToken ct = default);
    Task PublishOddsUpdateAsync(OddsUpdate update,   CancellationToken ct = default);
}
