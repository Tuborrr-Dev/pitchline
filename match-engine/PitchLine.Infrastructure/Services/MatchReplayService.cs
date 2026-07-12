using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Replays a saved match JSON through the live event pipeline.
/// Events are emitted in Seq order with real timing gaps scaled by speedMultiplier.
/// speedMultiplier=1 = real time, 10 = 10x faster, 0 = no delay.
/// </summary>
public class MatchReplayService(
    IMatchEventBus bus,
    FixtureMetadataService fixtures,
    Pitchline.Infrastructure.Redis.MatchStateRepository repo,
    ILogger<MatchReplayService> logger)
{
    private readonly IMatchEventBus _bus = bus;
    private readonly FixtureMetadataService _fixtures = fixtures;
    private readonly Pitchline.Infrastructure.Redis.MatchStateRepository _repo = repo;
    private readonly ILogger<MatchReplayService> _logger = logger;

    private static readonly HashSet<string> SkippedActions =
    [
        "coverage_update", "comment", "connected", "disconnected",
        "venue", "pitch", "weather", "players_warming_up", "jersey",
        "lineups", "players_on_the_pitch", "clock_adjustment", "standby"
    ];

    private static readonly HashSet<string> GoalActions = ["goal", "ownGoal"];

    private static readonly HashSet<string> TerminalActions =
    [
        "fullTime", "game_finalised", "game_abandoned", "game_cancelled"
    ];

    public async Task ReplayAsync(string jsonFilePath, double speedMultiplier = 10, CancellationToken ct = default)
    {
        var json = await File.ReadAllTextAsync(jsonFilePath, ct);
        var events = JsonSerializer.Deserialize<JsonElement[]>(json)
            ?? throw new InvalidOperationException("Failed to deserialize replay file.");

        // Sort by Seq to guarantee order
        var ordered = events
            .Where(e => e.TryGetProperty("Seq", out _))
            .OrderBy(e => e.GetProperty("Seq").GetInt32())
            .ToList();

        if (ordered.Count == 0) return;

        var fixtureId = ordered[0].GetProperty("FixtureId").GetInt32();
        var fixture = await _fixtures.GetAsync(fixtureId, ct) ?? await _repo.GetFixtureMetaAsync(fixtureId);

        if (fixture is null)
        {
            _logger.LogWarning("[REPLAY] No fixture meta for {FixtureId} — cannot replay", fixtureId);
            return;
        }

        _logger.LogInformation("[REPLAY] Starting replay for fixture {FixtureId} ({Home} vs {Away}) — {Count} events at {Speed}x",
            fixtureId, fixture.HomeName, fixture.AwayName, ordered.Count, speedMultiplier);

        long? prevTs = null;

        foreach (var e in ordered)
        {
            ct.ThrowIfCancellationRequested();

            var action = e.TryGetProperty("Action", out var actionEl) ? actionEl.GetString() : null;
            if (action is null || SkippedActions.Contains(action)) continue;

            var ts = e.GetProperty("Ts").GetInt64();

            // Delay proportional to real gap between events
            if (prevTs.HasValue && speedMultiplier > 0)
            {
                var gapMs = (int)((ts - prevTs.Value) / speedMultiplier);
                if (gapMs > 0)
                    await Task.Delay(Math.Min(gapMs, 5000), ct);
            }

            prevTs = ts;

            // Publish goals and terminal events (fullTime, game_finalised, etc.)
            // so the match phase is correctly updated to "Finished" at the end of the replay
            if (!GoalActions.Contains(action) && !TerminalActions.Contains(action)) continue;

            try
            {
                var scoreUpdate = JsonSerializer.Deserialize<ScoreUpdate>(e.GetRawText());
                if (scoreUpdate is null) continue;

                var enriched = new EnrichedScoreUpdate(scoreUpdate, fixture);
                await _bus.PublishScoreUpdateAsync(enriched, ct);

                _logger.LogDebug("[REPLAY] {Action} @ {Minute}' fixture={FixtureId}",
                    action, scoreUpdate.Minute, fixtureId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[REPLAY] Failed to publish event {Action}", action);
            }
        }

        _logger.LogInformation("[REPLAY] Completed replay for fixture {FixtureId}", fixtureId);
    }
}
