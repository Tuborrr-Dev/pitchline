using Microsoft.Extensions.Logging;
using PitchLine.Application.Common.Interfaces;
using Pitchline.Infrastructure.TxLine;
using StackExchange.Redis;
using System.Text.Json;
using Pitchline.Infrastructure.Postgres;
using System.Linq;

namespace Pitchline.Infrastructure.Redis;

/// <summary>
/// All Redis reads and writes for Pitchline.
/// Keys:
///   fixture:{id}:meta          Hash  — team names, kickoff (from fixtures snapshot)
///   fixture:{id}:state         Hash  — current score, phase, minute, probabilities
///   fixture:{id}:events        List  — append-only score event log
///   fixture:{id}:odds-history  List  — append-only probability snapshots (chart points)
/// </summary>
public class MatchStateRepository(IConnectionMultiplexer redis, PostgresRepository pg, ILogger<MatchStateRepository> logger) : IMatchStateRepository
{
    private readonly IConnectionMultiplexer _redis = redis;
    private readonly IDatabase _db = redis.GetDatabase();
    private readonly PostgresRepository _pg = pg;
    private readonly ILogger<MatchStateRepository> _logger = logger;
    public async Task<IReadOnlyList<string>> GetAllFixtureIdsAsync(CancellationToken cancellationToken = default)
    {
        return await _pg.GetAllFixtureIdsAsync(cancellationToken);
    }

    // ── Fixture metadata (written by FixtureMetadataService every 5 min) ────
    public async Task SaveFixtureMetaAsync(FixtureInfo fixture)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to save fixture meta for {FixtureId}", fixture.FixtureId);
        }
    }

    public async Task<FixtureMetaSummary?> GetFixtureMetaAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:meta";
        try
        {
            var fields = await _db.HashGetAllAsync(key);
            if (fields.Length > 0)
            {
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
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Timeout/error querying meta for {FixtureId}. Falling back to PostgreSQL.", fixtureId);
        }

        // Cache miss or Redis failure: load from Postgres
        var pgMeta = await _pg.GetFixtureMetaAsync(fixtureId, cancellationToken);
        if (pgMeta is not null)
        {
            // Populate cache (safe write)
            try
            {
                await SaveFixtureMetaAsync(new FixtureInfo(
                    FixtureId: int.Parse(pgMeta.FixtureId),
                    HomeName: pgMeta.HomeName,
                    AwayName: pgMeta.AwayName,
                    HomeId: int.Parse(pgMeta.HomeId),
                    AwayId: int.Parse(pgMeta.AwayId),
                    Participant1IsHome: pgMeta.Participant1IsHome,
                    KickOff: pgMeta.KickOff
                ));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[REDIS] Failed to populate meta cache for {FixtureId} after Postgres load.", fixtureId);
            }
            return pgMeta;
        }

        return null;
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
        try
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to save all fixtures batch");
        }
    }

    // ── Current match state (overwritten on every event) ─────────────────────

    public async Task<MatchStateSummary?> GetStateAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:state";
        try
        {
            var fields = await _db.HashGetAllAsync(key);
            if (fields.Length > 0)
            {
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
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Timeout/error querying state for {FixtureId}. Falling back to PostgreSQL.", fixtureId);
        }

        // Cache miss or Redis failure: load from Postgres
        var pgState = await _pg.GetStateAsync(fixtureId, cancellationToken);
        if (pgState is not null)
        {
            // Populate cache (safe write)
            try
            {
                await UpdateRedisStateAsync(pgState);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[REDIS] Failed to populate state cache for {FixtureId} after Postgres load.", fixtureId);
            }
            return pgState;
        }

        return null;
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
    private async Task UpdateRedisStateAsync(MatchStateSummary state)
    {
        try
        {
            var key = $"fixture:{state.FixtureId}:state";
            await _db.HashSetAsync(key, new HashEntry[]
            {
                new("homeName",      state.HomeName),
                new("awayName",      state.AwayName),
                new("homeScore",     state.HomeScore),
                new("awayScore",     state.AwayScore),
                new("phase",         state.Phase),
                new("minute",        state.Minute),
                new("homePct",       state.HomePct.ToString()),
                new("drawPct",       state.DrawPct.ToString()),
                new("awayPct",       state.AwayPct.ToString()),
                new("redCardActive", state.RedCardActive.ToString().ToLowerInvariant()),
            });
            await _db.KeyExpireAsync(key, TimeSpan.FromHours(6));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to update state cache for {FixtureId}", state.FixtureId);
        }
    }

    public async Task UpdateStateFromScoreAsync(EnrichedScoreUpdate enriched)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to update state from score for {FixtureId}", enriched.Score.FixtureId);
        }
    }

    public async Task UpdateStateFromOddsAsync(EnrichedOddsUpdate enriched, decimal homePct, decimal drawPct, decimal awayPct)
    {
        try
        {
            var key = $"fixture:{enriched.Odds.FixtureId}:state";

            await _db.HashSetAsync(key, new HashEntry[]
            {
                new("homePct", homePct.ToString()),
                new("drawPct", drawPct.ToString()),
                new("awayPct", awayPct.ToString()),
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to update state from odds for {FixtureId}", enriched.Odds.FixtureId);
        }
    }
    public async Task<decimal?> GetOpeningHomePctAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:state";
        var value = await _db.HashGetAsync(key, "openingHomePct");
        return value.HasValue && decimal.TryParse(value!, out var opening) ? opening : null;
    }

    public async Task SaveOpeningHomePctAsync(string fixtureId, decimal homePct, CancellationToken cancellationToken = default)
    {
        try
        {
            var key = $"fixture:{fixtureId}:state";
            await _db.HashSetAsync(key, "openingHomePct", homePct.ToString());
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to save opening home percentage for {FixtureId}", fixtureId);
        }
    }

    // ── Event log (append-only, powers history scrub) ─────────────────────────

    public async Task AppendScoreEventAsync(EnrichedScoreUpdate enriched)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to append score event for {FixtureId}", enriched.Score.FixtureId);
        }
    }

    public async Task<IEnumerable<string>> GetEventLogAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:events";
        var values = await _db.ListRangeAsync(key, 0, -1); // all items
        if (values.Length > 0)
        {
            return values.Select(v => v.ToString());
        }

        // Cache miss: load from Postgres
        var pgEvents = await _pg.GetScoreHistoryAsync(fixtureId, cancellationToken);
        if (pgEvents.Any())
        {
            var serialized = pgEvents.Select(e => JsonSerializer.Serialize(new
            {
                eventType = e.EventType,
                homeName  = e.HomeName,
                awayName  = e.AwayName,
                homeScore = e.HomeScore,
                awayScore = e.AwayScore,
                minute    = e.Minute,
                phase     = e.Phase,
                timestamp = DateTimeOffset.FromUnixTimeMilliseconds(e.Ts)
            })).ToList();

            // Populate Redis cache
            var batch = _db.CreateBatch();
            var tasks = new List<Task>();
            foreach (var payload in serialized)
            {
                tasks.Add(batch.ListRightPushAsync(key, payload));
            }
            tasks.Add(batch.KeyExpireAsync(key, TimeSpan.FromHours(6)));
            batch.Execute();
            await Task.WhenAll(tasks);

            return serialized;
        }

        return [];
    }

    public async Task<IEnumerable<string>> GetEventLogAsync(int fixtureId)
    {
        return await GetEventLogAsync(fixtureId.ToString());
    }

    // ── Odds history (append-only, powers the chart line) ─────────────────────

    public async Task AppendOddsSnapshotAsync(EnrichedOddsUpdate enriched, decimal homePct, decimal drawPct, decimal awayPct)
    {
        try
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
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to append odds snapshot for {FixtureId}", enriched.Odds.FixtureId);
        }
    }

    public async Task<IEnumerable<string>> GetOddsHistoryAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var key = $"fixture:{fixtureId}:odds-history";
        var values = await _db.ListRangeAsync(key, 0, -1);
        if (values.Length > 0)
        {
            return values.Select(v => v.ToString());
        }

        // Cache miss: load from Postgres
        var pgOdds = await _pg.GetOddsHistoryAsync(fixtureId, cancellationToken);
        if (pgOdds.Any())
        {
            var serialized = pgOdds.Select(o => JsonSerializer.Serialize(new
            {
                homePct = o.HomePct,
                drawPct = o.DrawPct,
                awayPct = o.AwayPct,
                timestamp = o.Timestamp
            })).ToList();

            // Populate Redis cache
            var batch = _db.CreateBatch();
            var tasks = new List<Task>();
            foreach (var payload in serialized)
            {
                tasks.Add(batch.ListRightPushAsync(key, payload));
            }
            tasks.Add(batch.KeyExpireAsync(key, TimeSpan.FromHours(6)));
            batch.Execute();
            await Task.WhenAll(tasks);

            return serialized;
        }

        return [];
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

    private static readonly JsonSerializerOptions LobbyJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<IReadOnlyList<FixtureMetaAndState>> GetFixturesWithStateAsync(CancellationToken cancellationToken = default)
    {
        var key = "lobby:fixtures";
        var cachedJson = await _db.StringGetAsync(key);
        if (cachedJson.HasValue)
        {
            try
            {
                var cachedList = JsonSerializer.Deserialize<IReadOnlyList<FixtureMetaAndState>>(cachedJson!, LobbyJsonOptions);
                if (cachedList is not null)
                {
                    return cachedList;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[REDIS] Failed to deserialize cached lobby fixtures.");
            }
        }

        // Cache miss: load from Postgres in a single query
        var list = await _pg.GetFixturesWithStateAsync(cancellationToken);

        // Serialize and save to Redis with 5s TTL
        try
        {
            var serialized = JsonSerializer.Serialize(list, LobbyJsonOptions);
            await _db.StringSetAsync(key, serialized, TimeSpan.FromSeconds(5));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to cache lobby fixtures.");
        }

        return list;
    }

    // ── Analytics support reads ───────────────────────────────────────────────

    /// <summary>
    /// Returns last N homePct values from odds-history for momentum + volatility calc.
    /// </summary>
    public async Task<List<decimal>> GetRecentHomePctHistoryAsync(int fixtureId, int count = 11)
    {
        var key = $"fixture:{fixtureId}:odds-history";
        var values = await _db.ListRangeAsync(key, -count, -1);

        return values
            .Select(v =>
            {
                var doc = JsonSerializer.Deserialize<JsonElement>(v.ToString());
                return doc.TryGetProperty("homePct", out var p) ? p.GetDecimal() : 0m;
            })
            .ToList();
    }

    /// <summary>
    /// Reads current peak swing from state hash.
    /// </summary>
    public async Task<(decimal Delta, string Minute)> GetPeakSwingAsync(int fixtureId)
    {
        var key = $"fixture:{fixtureId}:state";
        var delta = await _db.HashGetAsync(key, "peakSwingDelta");
        var minute = await _db.HashGetAsync(key, "peakSwingMinute");

        return (
            delta.HasValue ? decimal.Parse(delta!) : 0m,
            minute.HasValue ? minute.ToString() : "0"
        );
    }

    /// <summary>
    /// Persists new peak swing to state hash when a new record is set.
    /// </summary>
    public async Task UpdatePeakSwingAsync(int fixtureId, decimal delta, string minute)
    {
        try
        {
            var key = $"fixture:{fixtureId}:state";
            await _db.HashSetAsync(key, new HashEntry[]
            {
                new("peakSwingDelta",  delta.ToString()),
                new("peakSwingMinute", minute),
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[REDIS] Failed to update peak swing for {FixtureId}", fixtureId);
        }
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
