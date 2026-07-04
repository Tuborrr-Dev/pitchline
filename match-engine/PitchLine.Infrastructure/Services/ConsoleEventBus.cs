using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Temporary IMatchEventBus implementation that just logs events to the console.
/// Use this for Day 1 verification — replace with the real Redis + WS bus later.
/// </summary>
public class ConsoleEventBus(ILogger<ConsoleEventBus> logger) : IMatchEventBus
{
    private readonly ILogger<ConsoleEventBus> _logger = logger;

    public Task PublishScoreUpdateAsync(EnrichedScoreUpdate update, CancellationToken ct = default)
    {
        _logger.LogInformation(
            "[SCORE ⚽] fixture={FixtureId} {Home} vs {Away} | action={Action} score={HomeScore}-{AwayScore} min={Minute} state={GameState}",
            update.Score.FixtureId, update.Fixture.HomeName, update.Fixture.AwayName,
            update.Score.Action, update.Score.HomeScore, update.Score.AwayScore,
            update.Score.Minute, update.Score.Phase);

        return Task.CompletedTask;
    }

    public Task PublishOddsUpdateAsync(EnrichedOddsUpdate update, CancellationToken ct = default)
    {
        var (home, draw, away) = update.Odds.ToImpliedProbabilities();

        _logger.LogInformation(
            "[ODDS 📊] fixture={FixtureId} {Home} vs {Away} | odds H={HomeOdds} D={DrawOdds} A={AwayOdds} | prob H={HomePct}% D={DrawPct}% A={AwayPct}%",
            update.Odds.FixtureId, update.Fixture.HomeName, update.Fixture.AwayName,
            update.Odds.HomeDecimalOdds.ToString("F2"),
            update.Odds.DrawDecimalOdds.ToString("F2"),
            update.Odds.AwayDecimalOdds.ToString("F2"),
            home, draw, away);

        return Task.CompletedTask;
    }
}
