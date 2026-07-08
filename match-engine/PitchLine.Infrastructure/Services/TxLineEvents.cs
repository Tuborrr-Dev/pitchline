using System.Text.Json.Serialization;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// A single event from /api/scores/stream — matches the actual TxLINE wire format.
/// Action = event type ("goal", "shot", "yellowCard", "redCard", "halfTime", "fullTime" etc.)
/// Scores are derived from Stats: key "1" = home goals, key "2" = away goals.
/// Minute is derived from Clock.Seconds / 60.
/// Participant: 1 = home team, 2 = away team.
/// </summary>
public record ScoreUpdate(
    [property: JsonPropertyName("FixtureId")] int FixtureId,
    [property: JsonPropertyName("Action")] string? Action,
    [property: JsonPropertyName("GameState")] string? GameState,
    [property: JsonPropertyName("StatusId")] int? StatusId,
    [property: JsonPropertyName("Participant")] int? Participant,
    [property: JsonPropertyName("Confirmed")] bool Confirmed,
    [property: JsonPropertyName("Clock")] ScoreClock? Clock,
    [property: JsonPropertyName("Stats")] Dictionary<string, int>? Stats,
    [property: JsonPropertyName("Ts")] long Ts
)
{
    // Goals are stat keys "1" (home) and "2" (away)
    public int HomeScore => Stats?.GetValueOrDefault("1", 0) ?? 0;
    public int AwayScore => Stats?.GetValueOrDefault("2", 0) ?? 0;

    // Minute from clock seconds, capped display at 90+
    public string Minute => Clock is null ? "" : $"{(int)(Clock.Seconds / 60)}";

    // Terminal actions take precedence over StatusId — the API can send StatusId=1
    // (scheduled) alongside a finalisation action for pre-tournament fixtures.
    private static readonly HashSet<string> TerminalActions =
        ["game_finalised", "fullTime", "game_abandoned", "game_cancelled"];

    public string Phase => Action is not null && TerminalActions.Contains(Action)
        ? "Finished"
        : StatusId switch
        {
            1  => "Scheduled",
            2  => "1st Half",
            3  => "Half Time",
            4  => "2nd Half",
            5  => "Finished",
            6  => "Waiting for Extra Time",
            7  => "Extra Time 1st Half",
            8  => "Extra Time Half Time",
            9  => "Extra Time 2nd Half",
            10 => "Finished After Extra Time",
            11 => "Waiting for Penalties",
            12 => "Penalty Shootout",
            13 => "Finished After Penalties",
            14 => "Interrupted",
            15 => "Abandoned",
            16 => "Cancelled",
            17 => "Coverage Cancelled",
            18 => "Coverage Suspended",
            _  => GameState ?? ""
        };

    // Participant 1 = home, 2 = away — normalise to string for matchContext helpers
    public string? TeamId => Participant?.ToString();
}

public record ScoreClock(
    [property: JsonPropertyName("Running")] bool Running,
    [property: JsonPropertyName("Seconds")] int Seconds
);

/// <summary>
/// Raw event from /api/odds/stream — matches the actual TxLINE wire format.
/// Prices are integers in thousandths: 5582 = 5.582 decimal odds.
/// Only 1X2_PARTICIPANT_RESULT with MarketPeriod=null is full-match win probability.
/// </summary>
public record OddsUpdate(
    [property: JsonPropertyName("FixtureId")] int FixtureId,
    [property: JsonPropertyName("SuperOddsType")] string SuperOddsType,
    [property: JsonPropertyName("MarketPeriod")] string? MarketPeriod,
    [property: JsonPropertyName("PriceNames")] string[] PriceNames,
    [property: JsonPropertyName("Prices")] int[] Prices,
    [property: JsonPropertyName("Pct")] string[] Pct,
    [property: JsonPropertyName("Ts")] long Ts
)
{
    private const string FullMatchResult = "1X2_PARTICIPANT_RESULT";

    public bool IsFullMatchResult =>
        SuperOddsType == FullMatchResult && MarketPeriod is null
        && Prices.Length == PriceNames.Length && Prices.Length > 0;

    public decimal HomeDecimalOdds => Prices[Array.IndexOf(PriceNames, "part1")] / 1000m;
    public decimal DrawDecimalOdds => Prices[Array.IndexOf(PriceNames, "draw")] / 1000m;
    public decimal AwayDecimalOdds => Prices[Array.IndexOf(PriceNames, "part2")] / 1000m;

    /// <summary>
    /// Use Pct from the API when available (already de-margined).
    /// Falls back to calculating from Prices if Pct is missing or incomplete.
    /// </summary>
    public (decimal Home, decimal Draw, decimal Away) ToImpliedProbabilities()
    {
        if (Pct is { Length: 3 } &&
            decimal.TryParse(Pct[0], out var h) &&
            decimal.TryParse(Pct[1], out var d) &&
            decimal.TryParse(Pct[2], out var a))
        {
            return (Math.Round(h, 1), Math.Round(d, 1), Math.Round(a, 1));
        }

        var rawHome = 1m / HomeDecimalOdds;
        var rawDraw = 1m / DrawDecimalOdds;
        var rawAway = 1m / AwayDecimalOdds;
        var sum = rawHome + rawDraw + rawAway;

        var home = Math.Round(rawHome / sum * 100, 1);
        var away = Math.Round(rawAway / sum * 100, 1);
        var draw = Math.Round(100m - home - away, 1);

        return (home, draw, away);
    }
}

public record FixtureInfo(
    int FixtureId,
    string HomeName,
    string AwayName,
    int HomeId,
    int AwayId,
    DateTimeOffset KickOff
);

public record EnrichedOddsUpdate(OddsUpdate Odds, FixtureInfo Fixture);
public record EnrichedScoreUpdate(ScoreUpdate Score, FixtureInfo Fixture);

/// <summary>Contract between ingestion layer and the rest of the app.</summary>
public interface IMatchEventBus
{
    Task PublishScoreUpdateAsync(EnrichedScoreUpdate update, CancellationToken ct = default);
    Task PublishOddsUpdateAsync(EnrichedOddsUpdate update, CancellationToken ct = default);
}
