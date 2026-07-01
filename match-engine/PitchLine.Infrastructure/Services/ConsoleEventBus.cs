using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Temporary IMatchEventBus implementation that just logs events to the console.
/// Use this for Day 1 verification — replace with the real Redis + WS bus later.
/// </summary>
public class ConsoleEventBus(ILogger<ConsoleEventBus> logger) : IMatchEventBus
{
    private readonly ILogger<ConsoleEventBus> _logger = logger;

    public Task PublishScoreUpdateAsync(ScoreUpdate update, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "[SCORE ⚽] fixture={FixtureId} event={EventType} score={Home}-{Away} min={Minute} phase={Phase}",
            update.FixtureId, update.EventType,
            update.HomeScore, update.AwayScore,
            update.Minute, update.Phase);

        return Task.CompletedTask;
    }

    public Task PublishOddsUpdateAsync(OddsUpdate update, CancellationToken ct = default)
    {
        var (home, draw, away) = update.ToImpliedProbabilities();

        _logger.LogInformation(
            "[ODDS 📊] fixture={FixtureId} home={Home}% draw={Draw}% away={Away}%  (raw: {RawHome}/{RawDraw}/{RawAway})",
            update.FixtureId,
            home, draw, away,
            update.HomeDecimalOdds, update.DrawDecimalOdds, update.AwayDecimalOdds);

        return Task.CompletedTask;
    }
}
