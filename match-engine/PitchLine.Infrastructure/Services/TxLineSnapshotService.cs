using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Redis;
using Pitchline.Infrastructure.Postgres;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Seeds Redis from Postgres — no TxODDS HTTP calls.
/// </summary>
public class TxLineSnapshotService(
    MatchStateRepository repo,
    PostgresRepository pg,
    ILogger<TxLineSnapshotService> logger)
{
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly ILogger<TxLineSnapshotService> _logger = logger;

    /// <summary>
    /// Warms Redis for a single fixture from Postgres state.
    /// </summary>
    public async Task SeedFromSnapshotAsync(string fixtureId, CancellationToken ct = default)
    {
        if (!int.TryParse(fixtureId, out var fixtureNumber))
        {
            _logger.LogWarning("[SNAPSHOT] Invalid fixture id {FixtureId}", fixtureId);
            return;
        }

        var meta = await _pg.GetFixtureMetaAsync(fixtureId, ct);
        if (meta is null)
        {
            _logger.LogWarning("[SNAPSHOT] No fixture meta for {FixtureId} — skipping", fixtureId);
            return;
        }

        var state = await _pg.GetStateAsync(fixtureNumber, ct);
        if (state is not null)
        {
            await _repo.UpdateStateFromOddsAsync(
                new EnrichedOddsUpdate(
                    new OddsUpdate(fixtureNumber, null, "1X2_PARTICIPANT_RESULT", null,
                        ["part1", "draw", "part2"], [0, 0, 0], [],
                        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
                    new FixtureInfo(fixtureNumber, meta.HomeName, meta.AwayName,
                        int.Parse(meta.HomeId), int.Parse(meta.AwayId),
                        meta.Participant1IsHome, meta.KickOff)),
                state.HomePct, state.DrawPct, state.AwayPct);
        }

        _logger.LogDebug("[SNAPSHOT] Redis warmed from DB for {FixtureId}", fixtureId);
    }

    /// <summary>
    /// Warms Redis for all known fixtures from Postgres.
    /// </summary>
    public async Task SeedAllFixturesAsync(CancellationToken ct = default)
    {
        var fixtureIds = await _repo.GetAllFixtureIdsAsync(ct);
        foreach (var fixtureId in fixtureIds)
            await SeedFromSnapshotAsync(fixtureId, ct);
    }
}
