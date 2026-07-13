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
    [property: JsonPropertyName("Score")] ScoreBlock? Score,
    [property: JsonPropertyName("Stats")] Dictionary<string, int>? Stats,
    [property: JsonPropertyName("Ts")] long Ts
)
{
    // Score.Participant1.Total.Goals is only present on goal events.
    // Stats["1"] / Stats["2"] are the running cumulative goal totals on all events.
    public int Participant1Goals =>
        Score?.Participant1?.Total?.Goals is int g1 and > 0 ? g1
        : Stats is not null && Stats.TryGetValue("1", out var s1) ? s1
        : 0;

    public int Participant2Goals =>
        Score?.Participant2?.Total?.Goals is int g2 and > 0 ? g2
        : Stats is not null && Stats.TryGetValue("2", out var s2) ? s2
        : 0;

    public string Minute => Clock is null ? "" : $"{(int)(Clock.Seconds / 60)}";

    private static readonly HashSet<string> TerminalActions =
        ["game_finalised", "game_abandoned", "game_cancelled"];

    public string Phase => Action is not null && TerminalActions.Contains(Action)
        ? "Finished"
        : StatusId switch
        {
            1 => "Scheduled",
            2 => "1st Half",
            3 => "Half Time",
            4 => "2nd Half",
            5 => "Finished",
            6 => "Waiting for Extra Time",
            7 => "Extra Time 1st Half",
            8 => "Extra Time Half Time",
            9 => "Extra Time 2nd Half",
            10 => "Finished After Extra Time",
            11 => "Waiting for Penalties",
            12 => "Penalty Shootout",
            13 => "Finished After Penalties",
            14 => "Interrupted",
            15 => "Abandoned",
            16 => "Cancelled",
            17 => "Coverage Cancelled",
            18 => "Coverage Suspended",
            100 => "Finished",              // <- added, covers bare status events
            _ => GameState ?? ""
        };

    public string? TeamId => Participant?.ToString();
}

public record ScoreBlock(
    [property: JsonPropertyName("Participant1")] ParticipantTotals? Participant1,
    [property: JsonPropertyName("Participant2")] ParticipantTotals? Participant2
);
public record ParticipantTotals([property: JsonPropertyName("Total")] TotalsBlock? Total);
public record TotalsBlock([property: JsonPropertyName("Goals")] int Goals);
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

    public decimal HomeDecimalOdds => (Prices is { Length: > 0 } && PriceNames is { Length: > 0 } && Array.IndexOf(PriceNames, "part1") is var i && i >= 0 && i < Prices.Length && Prices[i] > 0) ? Prices[i] / 1000m : 0m;
    public decimal DrawDecimalOdds => (Prices is { Length: > 0 } && PriceNames is { Length: > 0 } && Array.IndexOf(PriceNames, "draw") is var i && i >= 0 && i < Prices.Length && Prices[i] > 0) ? Prices[i] / 1000m : 0m;
    public decimal AwayDecimalOdds => (Prices is { Length: > 0 } && PriceNames is { Length: > 0 } && Array.IndexOf(PriceNames, "part2") is var i && i >= 0 && i < Prices.Length && Prices[i] > 0) ? Prices[i] / 1000m : 0m;

    /// <summary>
    /// Use Pct from the API when available (already de-margined).
    /// Falls back to calculating from Prices if Pct is missing or incomplete.
    /// </summary>
    public (decimal Home, decimal Draw, decimal Away) ToImpliedProbabilities()
    {
        if (Pct is { Length: 3 } && PriceNames is { Length: 3 })
        {
            var homeIdx = Array.IndexOf(PriceNames, "part1");
            var drawIdx = Array.IndexOf(PriceNames, "draw");
            var awayIdx = Array.IndexOf(PriceNames, "part2");

            if (homeIdx >= 0 && drawIdx >= 0 && awayIdx >= 0 &&
                decimal.TryParse(Pct[homeIdx], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var h) &&
                decimal.TryParse(Pct[drawIdx], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d) &&
                decimal.TryParse(Pct[awayIdx], System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var a))
            {
                return (Math.Round(h, 1), Math.Round(d, 1), Math.Round(a, 1));
            }
        }

        var hOdds = HomeDecimalOdds;
        var dOdds = DrawDecimalOdds;
        var aOdds = AwayDecimalOdds;

        if (hOdds > 0 && dOdds > 0 && aOdds > 0)
        {
            var rawHome = 1m / hOdds;
            var rawDraw = 1m / dOdds;
            var rawAway = 1m / aOdds;
            var sum = rawHome + rawDraw + rawAway;

            var home = Math.Round(rawHome / sum * 100, 1);
            var away = Math.Round(rawAway / sum * 100, 1);
            var draw = Math.Round(100m - home - away, 1);

            return (home, draw, away);
        }

        return (0m, 0m, 0m);
    }
}
public record OddsSnapshot(
    decimal HomePct,
    decimal DrawPct,
    decimal AwayPct,
    DateTimeOffset Timestamp
);

public record FixtureInfo(
    int FixtureId,
    string HomeName,
    string AwayName,
    int HomeId,
    int AwayId,
    bool Participant1IsHome,
    DateTimeOffset KickOff
);

public record EnrichedOddsUpdate(OddsUpdate Odds, FixtureInfo Fixture);
public record EnrichedScoreUpdate(ScoreUpdate Score, FixtureInfo Fixture)
{
    public int HomeScore => Fixture.Participant1IsHome ? Score.Participant1Goals : Score.Participant2Goals;
    public int AwayScore => Fixture.Participant1IsHome ? Score.Participant2Goals : Score.Participant1Goals;
}

/// <summary>Contract between ingestion layer and the rest of the app.</summary>
public interface IMatchEventBus
{
    Task PublishScoreUpdateAsync(EnrichedScoreUpdate update, CancellationToken ct = default);
    Task PublishOddsUpdateAsync(EnrichedOddsUpdate update, CancellationToken ct = default);
}
