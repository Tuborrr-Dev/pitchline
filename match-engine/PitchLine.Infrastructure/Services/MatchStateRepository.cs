using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.TxLine;
using StackExchange.Redis;
using System.Text.Json;

namespace Pitchline.Infrastructure.Redis;

/// <summary>
/// All Redis reads and writes for Pitchline.
/// Keys:
///   fixture:{id}:meta          Hash  — team names, kickoff (from fixtures snapshot)
///   fixture:{id}:state         Hash  — current score, phase, minute, probabilities
///   fixture:{id}:events        List  — append-only score event log
///   fixture:{id}:odds-history  List  — append-only probability snapshots (chart points)
/// </summary>
public class MatchStateRepository(IConnectionMultiplexer redis, ILogger<MatchStateRepository> logger)
{
    private readonly IDatabase _db = redis.GetDatabase();
    private readonly ILogger<MatchStateRepository> _logger = logger;

    // ── Fixture metadata (written by FixtureMetadataService every 5 min) ────
    public async Task SaveFixtureMetaAsync(FixtureInfo fixture)
    {
        var key = $"fixture:{fixture.FixtureId}:meta";

        await _db.HashSetAsync(key,
        [
            new("fixtureId", fixture.FixtureId),
            new("homeName",  fixture.HomeName),
            new("awayName",  fixture.AwayName),
            new("homeId",    fixture.HomeId),
            new("awayId",    fixture.AwayId),
            new("kickOff",   fixture.KickOff.ToString("O")),
        ]);

        // Expire metadata 6 hours after kickoff — keeps Redis clean
        await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));

        _logger.LogDebug("[REDIS] Saved fixture meta for {FixtureId}", fixture.FixtureId);
    }

    public async Task<FixtureInfo?> GetFixtureMetaAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:meta";
        var fields = await _db.HashGetAllAsync(key);
        if (fields.Length == 0) return null;

        var map = fields.ToDictionary(f => f.Name.ToString(), f => f.Value.ToString());
        return new FixtureInfo(
            FixtureId: int.Parse(map["fixtureId"]),
            HomeName: map["homeName"],
            AwayName: map["awayName"],
            HomeId: int.Parse(map["homeId"]),
            AwayId: int.Parse(map["awayId"]),
            KickOff: DateTimeOffset.Parse(map["kickOff"])
        );
    }

    public async Task SaveAllFixturesAsync(IEnumerable<FixtureInfo> fixtures)
    {
        foreach (var f in fixtures)
            await SaveFixtureMetaAsync(f);
    }

    // ── Current match state (overwritten on every event) ─────────────────────

    public async Task<MatchState?> GetStateAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:state";
        var fields = await _db.HashGetAllAsync(key);
        if (fields.Length == 0) return null;

        var map = fields.ToDictionary(f => f.Name.ToString(), f => f.Value.ToString());
        return new MatchState(
            FixtureId: fixtureId,
            HomeName: map.GetValueOrDefault("homeName", ""),
            AwayName: map.GetValueOrDefault("awayName", ""),
            HomeScore: int.Parse(map.GetValueOrDefault("homeScore", "0")),
            AwayScore: int.Parse(map.GetValueOrDefault("awayScore", "0")),
            Phase: map.GetValueOrDefault("phase", ""),
            Minute: map.GetValueOrDefault("minute", ""),
            HomePct: decimal.Parse(map.GetValueOrDefault("homePct", "0")),
            DrawPct: decimal.Parse(map.GetValueOrDefault("drawPct", "0")),
            AwayPct: decimal.Parse(map.GetValueOrDefault("awayPct", "0")),
            RedCardActive: bool.Parse(map.GetValueOrDefault("redCardActive", "false"))
        );
    }

    public async Task UpdateStateFromScoreAsync(EnrichedScoreUpdate enriched)
    {
        var key = $"fixture:{enriched.Score.FixtureId}:state";

        await _db.HashSetAsync(key, new HashEntry[]
        {
            new("homeName",      enriched.Fixture.HomeName),
            new("awayName",      enriched.Fixture.AwayName),
            new("homeScore",     enriched.Score.HomeScore),
            new("awayScore",     enriched.Score.AwayScore),
            new("phase",         enriched.Score.Phase),
            new("minute",        enriched.Score.Minute),
            new("redCardActive", enriched.Score.Action == "redCard" ? "true" :
                                 await GetRedCardStateAsync(enriched.Score.FixtureId)),
        });
    }

    public async Task UpdateStateFromOddsAsync(EnrichedOddsUpdate enriched, decimal homePct, decimal drawPct, decimal awayPct)
    {
        var key = $"fixture:{enriched.Odds.FixtureId}:state";

        await _db.HashSetAsync(key, new HashEntry[]
        {
            new("homePct", homePct.ToString()),
            new("drawPct", drawPct.ToString()),
            new("awayPct", awayPct.ToString()),
        });
    }

    // ── Event log (append-only, powers history scrub) ─────────────────────────

    public async Task AppendScoreEventAsync(EnrichedScoreUpdate enriched)
    {
        var key = $"fixture:{enriched.Score.FixtureId}:events";
        var payload = JsonSerializer.Serialize(new
        {
            action    = enriched.Score.Action,
            homeName  = enriched.Fixture.HomeName,
            awayName  = enriched.Fixture.AwayName,
            homeScore = enriched.Score.HomeScore,
            awayScore = enriched.Score.AwayScore,
            minute    = enriched.Score.Minute,
            gameState = enriched.Score.Phase,
            ts        = enriched.Score.Ts,
        });

        await _db.ListRightPushAsync(key, payload);
        await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));
    }

    public async Task<IEnumerable<string>> GetEventLogAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:events";
        var values = await _db.ListRangeAsync(key, 0, -1); // all items
        return values.Select(v => v.ToString());
    }

    // ── Odds history (append-only, powers the chart line) ─────────────────────

    public async Task AppendOddsSnapshotAsync(EnrichedOddsUpdate enriched, decimal homePct, decimal drawPct, decimal awayPct)
    {
        var key = $"fixture:{enriched.Odds.FixtureId}:odds-history";
        var payload = JsonSerializer.Serialize(new
        {
            homePct,
            drawPct,
            awayPct,
            ts = enriched.Odds.Ts,
        });

        await _db.ListRightPushAsync(key, payload);
        await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));
    }

    public async Task<IEnumerable<string>> GetOddsHistoryAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:odds-history";
        var values = await _db.ListRangeAsync(key, 0, -1);
        return values.Select(v => v.ToString());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Read previous score from Redis BEFORE writing the new state.
    /// Used to compute scoreBefore for the annotation payload.
    /// </summary>
    public async Task<string> GetScoreBeforeAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:state";
        var home = await _db.HashGetAsync(key, "homeScore");
        var away = await _db.HashGetAsync(key, "awayScore");
        return $"{(home.HasValue ? (int)home : 0)}-{(away.HasValue ? (int)away : 0)}";
    }

    /// <summary>
    /// Read previous probability from Redis BEFORE writing the new odds.
    /// Used to compute probabilityDelta for the annotation payload.
    /// </summary>
    public async Task<decimal> GetPreviousHomePctAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:state";
        var val = await _db.HashGetAsync(key, "homePct");
        return val.HasValue ? decimal.Parse(val!) : 0m;
    }

    private async Task<string> GetRedCardStateAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:state";
        var val = await _db.HashGetAsync(key, "redCardActive");
        return val.HasValue ? val.ToString() : "false";
    }
}

// ── State record returned by GET /api/match/{id} ──────────────────────────────

public record MatchState(
    int FixtureId,
    string HomeName,
    string AwayName,
    int HomeScore,
    int AwayScore,
    string Phase,
    string Minute,
    decimal HomePct,
    decimal DrawPct,
    decimal AwayPct,
    bool RedCardActive
);
