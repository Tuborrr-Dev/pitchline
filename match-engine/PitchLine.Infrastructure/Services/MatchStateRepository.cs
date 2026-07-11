using Microsoft.Extensions.Logging;
using PitchLine.Application.Common.Interfaces;
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
public class MatchStateRepository(IConnectionMultiplexer redis, ILogger<MatchStateRepository> logger) : IMatchStateRepository
{
    private readonly IConnectionMultiplexer _redis = redis;
    private readonly IDatabase _db = redis.GetDatabase();
    private readonly ILogger<MatchStateRepository> _logger = logger;
    public async Task<IReadOnlyList<string>> GetAllFixtureIdsAsync(CancellationToken cancellationToken = default)
    {
        var fixtureIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var endpoint in _redis.GetEndPoints())
        {
            var server = _redis.GetServer(endpoint);
            foreach (var key in server.Keys(pattern: "fixture:*:meta"))
            {
                var parts = key.ToString().Split(':', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2 && parts[0].Equals("fixture", StringComparison.OrdinalIgnoreCase))
                {
                    fixtureIds.Add(parts[1]);
                }
            }
        }

        return fixtureIds.OrderBy(id => id).ToList();
    }

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
            new("participant1IsHome", fixture.Participant1IsHome),
            new("kickOff",   fixture.KickOff.ToString("O")),
        ]);

        // Expire metadata 6 hours after kickoff — keeps Redis clean
        await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));

        _logger.LogDebug("[REDIS] Saved fixture meta for {FixtureId}", fixture.FixtureId);
    }

    public async Task<FixtureMetaSummary?> GetFixtureMetaAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:meta";
        var fields = await _db.HashGetAllAsync(key);
        if (fields.Length == 0) return null;

        var map = fields.ToDictionary(f => f.Name.ToString(), f => f.Value.ToString());
        return new FixtureMetaSummary(
            FixtureId: fixtureId,
            HomeName: map["homeName"],
            AwayName: map["awayName"],
            HomeId: map["homeId"],
            AwayId: map["awayId"],
            Participant1IsHome: ParseBool(map.GetValueOrDefault("participant1IsHome", "true")),
            KickOff: DateTimeOffset.Parse(map["kickOff"])
        );
    }

    public async Task<FixtureInfo?> GetFixtureMetaAsync(int fixtureId)
    {
        var meta = await GetFixtureMetaAsync(fixtureId.ToString());
        return meta is null
            ? null
            : new FixtureInfo(
                FixtureId: int.Parse(meta.FixtureId),
                HomeName: meta.HomeName,
                AwayName: meta.AwayName,
                HomeId: int.Parse(meta.HomeId),
                AwayId: int.Parse(meta.AwayId),
                Participant1IsHome: meta.Participant1IsHome,
                KickOff: meta.KickOff
            );
    }

    public async Task SaveAllFixturesAsync(IEnumerable<FixtureInfo> fixtures)
    {
        var batch = _db.CreateBatch();
        var tasks = fixtures.SelectMany(f =>
        {
            var key = $"fixture:{f.FixtureId}:meta";
            return new Task[]
            {
                batch.HashSetAsync(key,
                [
                    new("fixtureId",           f.FixtureId),
                    new("homeName",            f.HomeName),
                    new("awayName",            f.AwayName),
                    new("homeId",              f.HomeId),
                    new("awayId",              f.AwayId),
                    new("participant1IsHome",  f.Participant1IsHome),
                    new("kickOff",             f.KickOff.ToString("O")),
                ]),
                batch.KeyExpireAsync(key, TimeSpan.FromHours(6))
            };
        }).ToList();

        batch.Execute();
        await Task.WhenAll(tasks);
    }

    // ── Current match state (overwritten on every event) ─────────────────────

    public async Task<MatchStateSummary?> GetStateAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:state";
        var fields = await _db.HashGetAllAsync(key);
        if (fields.Length == 0) return null;

        var map = fields.ToDictionary(f => f.Name.ToString(), f => f.Value.ToString());
        return new MatchStateSummary(
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

    public async Task<MatchState?> GetStateAsync(int fixtureId)
    {
        var state = await GetStateAsync(fixtureId.ToString());
        return state is null
            ? null
            : new MatchState(
                FixtureId: fixtureId,
                HomeName: state.HomeName,
                AwayName: state.AwayName,
                HomeScore: state.HomeScore,
                AwayScore: state.AwayScore,
                Phase: state.Phase,
                Minute: state.Minute,
                HomePct: state.HomePct,
                DrawPct: state.DrawPct,
                AwayPct: state.AwayPct,
                RedCardActive: state.RedCardActive
            );
    }

    public async Task UpdateStateFromScoreAsync(EnrichedScoreUpdate enriched)
    {
        var key = $"fixture:{enriched.Score.FixtureId}:state";

        await _db.HashSetAsync(key, new HashEntry[]
        {
            new("homeName",      enriched.Fixture.HomeName),
            new("awayName",      enriched.Fixture.AwayName),
            new("homeScore",     enriched.HomeScore),
            new("awayScore",     enriched.AwayScore),
            new("phase",         enriched.Score.Phase),
            new("minute",        enriched.Score.Minute),
            new("redCardActive", enriched.Score.Action == "red_card" ? "true" :
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
    public async Task<decimal?> GetOpeningHomePctAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:state";
        var value = await _db.HashGetAsync(key, "openingHomePct");
        return value.HasValue && decimal.TryParse(value!, out var opening) ? opening : null;
    }

    public async Task SaveOpeningHomePctAsync(string fixtureId, decimal homePct, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:state";
        await _db.HashSetAsync(key, "openingHomePct", homePct.ToString());
    }

    // ── Event log (append-only, powers history scrub) ─────────────────────────

    public async Task AppendScoreEventAsync(EnrichedScoreUpdate enriched)
    {
        var key = $"fixture:{enriched.Score.FixtureId}:events";
        var payload = JsonSerializer.Serialize(new
        {
            eventType = enriched.Score.Action,
            homeName  = enriched.Fixture.HomeName,
            awayName  = enriched.Fixture.AwayName,
            homeScore = enriched.HomeScore,
            awayScore = enriched.AwayScore,
            minute    = enriched.Score.Minute,
            phase     = enriched.Score.Phase,
            timestamp = DateTimeOffset.FromUnixTimeMilliseconds(enriched.Score.Ts),
        });

        await _db.ListRightPushAsync(key, payload);
        await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));
    }

    public async Task<IEnumerable<string>> GetEventLogAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:events";
        var values = await _db.ListRangeAsync(key, 0, -1); // all items
        return values.Select(v => v.ToString());
    }

    public async Task<IEnumerable<string>> GetEventLogAsync(int fixtureId)
    {
        return await GetEventLogAsync(fixtureId.ToString());
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

    public async Task<IEnumerable<string>> GetOddsHistoryAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:odds-history";
        var values = await _db.ListRangeAsync(key, 0, -1);
        return values.Select(v => v.ToString());
    }
    public async Task<IEnumerable<string>> GetOddsHistoryAsync(int fixtureId)
    {
        return await GetOddsHistoryAsync(fixtureId.ToString());
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

    private static bool ParseBool(string value) =>
        value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase);

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
