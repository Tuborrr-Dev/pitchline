using System.Text.Json;
using Microsoft.Extensions.Logging;
using Npgsql;
using Pitchline.Infrastructure.TxLine;
using Pitchline.Infrastructure.Redis;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Infrastructure.Postgres;

/// <summary>
/// Persists all match data to Postgres using raw SQL.
/// Runs in parallel with Redis — Redis stays for fast reads,
/// Postgres is the durable store.
/// Tables are created on startup if they don't exist.
/// </summary>
public class PostgresRepository(NpgsqlDataSource db, ILogger<PostgresRepository> logger)
{
    private readonly NpgsqlDataSource _db = db;
    private readonly ILogger<PostgresRepository> _logger = logger;

    // ── Schema bootstrap ──────────────────────────────────────────────────────


    public async Task EnsureTablesAsync()
    {
        await using var cmd = _db.CreateCommand("""
            CREATE TABLE IF NOT EXISTS fixture_meta (
                fixture_id   TEXT PRIMARY KEY,
                home_name    TEXT NOT NULL,
                away_name    TEXT NOT NULL,
                home_id      TEXT NOT NULL,
                away_id      TEXT NOT NULL,
                participant_1_is_home BOOLEAN NOT NULL DEFAULT TRUE,
                kick_off     TIMESTAMPTZ NOT NULL,
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE fixture_meta ADD COLUMN IF NOT EXISTS participant_1_is_home BOOLEAN NOT NULL DEFAULT TRUE;

            CREATE TABLE IF NOT EXISTS fixture_state (
                fixture_id    TEXT PRIMARY KEY,
                home_name     TEXT,
                away_name     TEXT,
                home_score    INT NOT NULL DEFAULT 0,
                away_score    INT NOT NULL DEFAULT 0,
                phase         TEXT,
                minute        TEXT,
                home_pct      NUMERIC(5,1),
                draw_pct      NUMERIC(5,1),
                away_pct      NUMERIC(5,1),
                opening_home_pct NUMERIC(5,1),
                red_card_active BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS score_events (
                id           BIGSERIAL PRIMARY KEY,
                fixture_id   TEXT NOT NULL,
                action       TEXT,
                home_name    TEXT,
                away_name    TEXT,
                home_score   INT,
                away_score   INT,
                minute       TEXT,
                phase        TEXT,
                ts           BIGINT,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS odds_history (
                id           BIGSERIAL PRIMARY KEY,
                fixture_id   TEXT NOT NULL,
                home_pct     NUMERIC(5,1),
                draw_pct     NUMERIC(5,1),
                away_pct     NUMERIC(5,1),
                ts           BIGINT,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            DELETE FROM odds_history a
            USING odds_history b
            WHERE a.id < b.id
              AND a.fixture_id = b.fixture_id
              AND a.ts = b.ts;

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND indexname = 'odds_history_fixture_ts_idx'
                ) THEN
                    CREATE UNIQUE INDEX odds_history_fixture_ts_idx
                        ON odds_history (fixture_id, ts);
                END IF;
            END $$;
        """);

        await cmd.ExecuteNonQueryAsync();
        _logger.LogInformation("[POSTGRES] Tables ready");
    }

    // ── Fixture meta ──────────────────────────────────────────────────────────

    public async Task UpsertFixtureMetaAsync(FixtureInfo fixture)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO fixture_meta (fixture_id, home_name, away_name, home_id, away_id, participant_1_is_home, kick_off, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (fixture_id) DO UPDATE
                SET home_name             = EXCLUDED.home_name,
                    away_name             = EXCLUDED.away_name,
                    home_id               = EXCLUDED.home_id,
                    away_id               = EXCLUDED.away_id,
                    participant_1_is_home = EXCLUDED.participant_1_is_home,
                    kick_off              = EXCLUDED.kick_off,
                    updated_at            = NOW();
            """);
            cmd.Parameters.AddWithValue(fixture.FixtureId.ToString());
            cmd.Parameters.AddWithValue(fixture.HomeName);
            cmd.Parameters.AddWithValue(fixture.AwayName);
            cmd.Parameters.AddWithValue(fixture.HomeId.ToString());
            cmd.Parameters.AddWithValue(fixture.AwayId.ToString());
            cmd.Parameters.AddWithValue(fixture.Participant1IsHome);
            cmd.Parameters.AddWithValue(fixture.KickOff.UtcDateTime);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] UpsertFixtureMeta failed for {FixtureId}", fixture.FixtureId);
        }
    }

    // ── Score state ───────────────────────────────────────────────────────────

    public async Task UpsertStateFromScoreAsync(EnrichedScoreUpdate enriched)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO fixture_state (fixture_id, home_name, away_name, home_score, away_score, phase, minute, red_card_active, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (fixture_id) DO UPDATE
                SET home_name       = EXCLUDED.home_name,
                    away_name       = EXCLUDED.away_name,
                    home_score      = EXCLUDED.home_score,
                    away_score      = EXCLUDED.away_score,
                    phase           = EXCLUDED.phase,
                    minute          = EXCLUDED.minute,
                    red_card_active = EXCLUDED.red_card_active,
                    updated_at      = NOW();
            """);
            cmd.Parameters.AddWithValue(enriched.Score.FixtureId.ToString());
            cmd.Parameters.AddWithValue(enriched.Fixture.HomeName);
            cmd.Parameters.AddWithValue(enriched.Fixture.AwayName);
            cmd.Parameters.AddWithValue(enriched.HomeScore);
            cmd.Parameters.AddWithValue(enriched.AwayScore);
            cmd.Parameters.AddWithValue(enriched.Score.Phase);
            cmd.Parameters.AddWithValue(enriched.Score.Minute);
            cmd.Parameters.AddWithValue(enriched.Score.Action == "redCard");
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] UpsertStateFromScore failed for {FixtureId}", enriched.Score.FixtureId);
        }
    }

    // ── Odds state ────────────────────────────────────────────────────────────

    public async Task UpsertStateFromOddsAsync(int fixtureId, decimal homePct, decimal drawPct, decimal awayPct)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO fixture_state (fixture_id, home_pct, draw_pct, away_pct, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (fixture_id) DO UPDATE
                SET home_pct   = EXCLUDED.home_pct,
                    draw_pct   = EXCLUDED.draw_pct,
                    away_pct   = EXCLUDED.away_pct,
                    updated_at = NOW();
            """);
            cmd.Parameters.AddWithValue(fixtureId.ToString());
            cmd.Parameters.AddWithValue(homePct);
            cmd.Parameters.AddWithValue(drawPct);
            cmd.Parameters.AddWithValue(awayPct);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] UpsertStateFromOdds failed for {FixtureId}", fixtureId);
        }
    }

    public async Task UpsertOpeningHomePctAsync(string fixtureId, decimal homePct)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO fixture_state (fixture_id, opening_home_pct, updated_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (fixture_id) DO UPDATE
                SET opening_home_pct = COALESCE(fixture_state.opening_home_pct, EXCLUDED.opening_home_pct),
                    updated_at       = NOW();
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            cmd.Parameters.AddWithValue(homePct);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] UpsertOpeningHomePct failed for {FixtureId}", fixtureId);
        }
    }

    // ── Score events (append-only) ────────────────────────────────────────────

    public async Task AppendScoreEventAsync(EnrichedScoreUpdate enriched)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO score_events (fixture_id, action, home_name, away_name, home_score, away_score, minute, phase, ts)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
            """);
            cmd.Parameters.AddWithValue(enriched.Score.FixtureId.ToString());
            cmd.Parameters.AddWithValue((object?)enriched.Score.Action ?? DBNull.Value);
            cmd.Parameters.AddWithValue(enriched.Fixture.HomeName);
            cmd.Parameters.AddWithValue(enriched.Fixture.AwayName);
            cmd.Parameters.AddWithValue(enriched.HomeScore);
            cmd.Parameters.AddWithValue(enriched.AwayScore);
            cmd.Parameters.AddWithValue(enriched.Score.Minute);
            cmd.Parameters.AddWithValue(enriched.Score.Phase);
            cmd.Parameters.AddWithValue(enriched.Score.Ts);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] AppendScoreEvent failed for {FixtureId}", enriched.Score.FixtureId);
        }
    }

    // ── Odds history (append-only) ────────────────────────────────────────────

    public async Task AppendOddsSnapshotAsync(int fixtureId, decimal homePct, decimal drawPct, decimal awayPct, long ts)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                INSERT INTO odds_history (fixture_id, home_pct, draw_pct, away_pct, ts)
                VALUES ($1, $2, $3, $4, $5);
            """);
            cmd.Parameters.AddWithValue(fixtureId.ToString());
            cmd.Parameters.AddWithValue(homePct);
            cmd.Parameters.AddWithValue(drawPct);
            cmd.Parameters.AddWithValue(awayPct);
            cmd.Parameters.AddWithValue(ts);
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] AppendOddsSnapshot failed for {FixtureId}", fixtureId);
        }
    }
    public async Task<int> BulkInsertOddsHistoryAsync(int fixtureId, IReadOnlyCollection<Pitchline.Infrastructure.TxLine.OddsSnapshot> snapshots, CancellationToken cancellationToken = default)
    {
        if (snapshots.Count == 0)
        {
            return 0;
        }

        await using var connection = await _db.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var inserted = 0;
            foreach (var snapshot in snapshots)
            {
                await using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = """
                    INSERT INTO odds_history (fixture_id, home_pct, draw_pct, away_pct, ts, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW())
                    ON CONFLICT (fixture_id, ts) DO NOTHING;
                """;
                cmd.Parameters.AddWithValue(fixtureId.ToString());
                cmd.Parameters.AddWithValue(snapshot.HomePct);
                cmd.Parameters.AddWithValue(snapshot.DrawPct);
                cmd.Parameters.AddWithValue(snapshot.AwayPct);
                cmd.Parameters.AddWithValue(snapshot.Timestamp.ToUnixTimeMilliseconds());
                var affected = await cmd.ExecuteNonQueryAsync(cancellationToken);
                inserted += affected;
            }

            await transaction.CommitAsync(cancellationToken);
            return inserted;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger.LogError(ex, "[POSTGRES] BulkInsertOddsHistoryAsync failed for {FixtureId}", fixtureId);
            throw;
        }
    }

    public async Task<IReadOnlyList<FixtureInfo>> GetFinishedFixturesMissingOddsHistoryAsync(int competitionId, CancellationToken cancellationToken = default)
    {
        var list = new List<FixtureInfo>();
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT m.fixture_id, m.home_name, m.away_name, m.home_id, m.away_id, m.participant_1_is_home, m.kick_off
                FROM fixture_meta m
                WHERE m.kick_off < NOW()
                  AND m.fixture_id NOT IN (
                      SELECT DISTINCT fixture_id FROM odds_history
                  )
                ORDER BY m.kick_off ASC;
            """);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                list.Add(new FixtureInfo(
                    FixtureId: int.Parse(reader.GetString(0)),
                    HomeName: reader.GetString(1),
                    AwayName: reader.GetString(2),
                    HomeId: int.Parse(reader.GetString(3)),
                    AwayId: int.Parse(reader.GetString(4)),
                    Participant1IsHome: reader.GetBoolean(5),
                    KickOff: reader.GetFieldValue<DateTimeOffset>(6)));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetFinishedFixturesMissingOddsHistoryAsync failed for competition {CompetitionId}", competitionId);
        }

        return list;
    }

    // ── Source of Truth Reads ────────────────────────────────────────────────

    public async Task<FixtureMetaSummary?> GetFixtureMetaAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT fixture_id, home_name, away_name, home_id, away_id, participant_1_is_home, kick_off
                FROM fixture_meta
                WHERE fixture_id = $1
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                return new FixtureMetaSummary(
                    FixtureId: reader.GetString(0),
                    HomeName: reader.GetString(1),
                    AwayName: reader.GetString(2),
                    HomeId: reader.GetString(3),
                    AwayId: reader.GetString(4),
                    Participant1IsHome: reader.GetBoolean(5),
                    KickOff: reader.GetFieldValue<DateTimeOffset>(6)
                );
            }
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetFixtureMetaAsync failed for {FixtureId}", fixtureId);
            return null;
        }
    }

    public async Task<FixtureInfo?> GetFixtureMetaAsync(int fixtureId, CancellationToken cancellationToken = default)
    {
        var meta = await GetFixtureMetaAsync(fixtureId.ToString(), cancellationToken);
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

    public async Task<MatchStateSummary?> GetStateAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT fixture_id, home_name, away_name, home_score, away_score, phase, minute, home_pct, draw_pct, away_pct, red_card_active
                FROM fixture_state
                WHERE fixture_id = $1
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                return new MatchStateSummary(
                    FixtureId: reader.GetString(0),
                    HomeName: reader.IsDBNull(1) ? "" : reader.GetString(1),
                    AwayName: reader.IsDBNull(2) ? "" : reader.GetString(2),
                    HomeScore: reader.GetInt32(3),
                    AwayScore: reader.GetInt32(4),
                    Phase: reader.IsDBNull(5) ? "" : reader.GetString(5),
                    Minute: reader.IsDBNull(6) ? "" : reader.GetString(6),
                    HomePct: reader.IsDBNull(7) ? 0m : reader.GetDecimal(7),
                    DrawPct: reader.IsDBNull(8) ? 0m : reader.GetDecimal(8),
                    AwayPct: reader.IsDBNull(9) ? 0m : reader.GetDecimal(9),
                    RedCardActive: reader.GetBoolean(10)
                );
            }
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetStateAsync failed for {FixtureId}", fixtureId);
            return null;
        }
    }

    public async Task<MatchState?> GetStateAsync(int fixtureId, CancellationToken cancellationToken = default)
    {
        var state = await GetStateAsync(fixtureId.ToString(), cancellationToken);
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

    public async Task<string> GetScoreBeforeAsync(int fixtureId, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT home_score, away_score
                FROM fixture_state
                WHERE fixture_id = $1
            """);
            cmd.Parameters.AddWithValue(fixtureId.ToString());
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                var home = reader.GetInt32(0);
                var away = reader.GetInt32(1);
                return $"{home}-{away}";
            }
            return "0-0";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetScoreBeforeAsync failed for {FixtureId}", fixtureId);
            return "0-0";
        }
    }

    public async Task<decimal> GetPreviousHomePctAsync(int fixtureId, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT home_pct
                FROM fixture_state
                WHERE fixture_id = $1
            """);
            cmd.Parameters.AddWithValue(fixtureId.ToString());
            var val = await cmd.ExecuteScalarAsync(cancellationToken);
            if (val is decimal decVal) return decVal;
            if (val != null && val != DBNull.Value && decimal.TryParse(val.ToString(), out var parsed)) return parsed;
            return 0m;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetPreviousHomePctAsync failed for {FixtureId}", fixtureId);
            return 0m;
        }
    }

    public async Task<decimal?> GetOpeningHomePctAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT opening_home_pct
                FROM fixture_state
                WHERE fixture_id = $1
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            var val = await cmd.ExecuteScalarAsync(cancellationToken);
            if (val is decimal decVal) return decVal;
            if (val != null && val != DBNull.Value && decimal.TryParse(val.ToString(), out var parsed)) return parsed;
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetOpeningHomePctAsync failed for {FixtureId}", fixtureId);
            return null;
        }
    }

    public async Task<IEnumerable<OddsSnapshot>> GetOddsHistoryAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var list = new List<OddsSnapshot>();
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT home_pct, draw_pct, away_pct, ts
                FROM odds_history
                WHERE fixture_id = $1
                ORDER BY ts ASC
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                list.Add(new OddsSnapshot(
                    HomePct: reader.GetDecimal(0),
                    DrawPct: reader.GetDecimal(1),
                    AwayPct: reader.GetDecimal(2),
                    Timestamp: DateTimeOffset.FromUnixTimeMilliseconds(reader.GetInt64(3))
                ));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetOddsHistoryAsync failed for {FixtureId}", fixtureId);
        }
        return list;
    }

    public async Task<IEnumerable<ScoreEvent>> GetScoreHistoryAsync(string fixtureId, CancellationToken cancellationToken = default)
    {
        var list = new List<ScoreEvent>();
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT action, home_name, away_name, home_score, away_score, minute, phase, ts
                FROM score_events
                WHERE fixture_id = $1
                ORDER BY ts ASC
            """);
            cmd.Parameters.AddWithValue(fixtureId);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                list.Add(new ScoreEvent(
                    EventType: reader.IsDBNull(0) ? "" : reader.GetString(0),
                    HomeName: reader.IsDBNull(1) ? "" : reader.GetString(1),
                    AwayName: reader.IsDBNull(2) ? "" : reader.GetString(2),
                    HomeScore: reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
                    AwayScore: reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                    Minute: reader.IsDBNull(5) ? "" : reader.GetString(5),
                    Phase: reader.IsDBNull(6) ? "" : reader.GetString(6),
                    Ts: reader.IsDBNull(7) ? 0 : reader.GetInt64(7)
                ));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetScoreHistoryAsync failed for {FixtureId}", fixtureId);
        }
        return list;
    }

    public async Task<IReadOnlyList<string>> GetAllFixtureIdsAsync(CancellationToken cancellationToken = default)
    {
        var list = new List<string>();
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT fixture_id
                FROM fixture_meta
                ORDER BY fixture_id ASC
            """);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                list.Add(reader.GetString(0));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetAllFixtureIdsAsync failed");
        }
        return list;
    }

    public async Task<IReadOnlyList<FixtureMetaAndState>> GetFixturesWithStateAsync(CancellationToken cancellationToken = default)
    {
        var list = new List<FixtureMetaAndState>();
        try
        {
            await using var cmd = _db.CreateCommand("""
                SELECT 
                    m.fixture_id, m.home_name, m.away_name, m.home_id, m.away_id, m.participant_1_is_home, m.kick_off,
                    s.home_score, s.away_score, s.phase, s.minute, s.home_pct, s.draw_pct, s.away_pct, s.red_card_active
                FROM fixture_meta m
                LEFT JOIN fixture_state s ON m.fixture_id = s.fixture_id
                ORDER BY m.kick_off ASC, m.fixture_id ASC
            """);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var fId = reader.GetString(0);
                var homeName = reader.GetString(1);
                var awayName = reader.GetString(2);
                var homeId = reader.GetString(3);
                var awayId = reader.GetString(4);
                var p1Home = reader.GetBoolean(5);
                var kickOff = reader.GetFieldValue<DateTimeOffset>(6);

                var meta = new FixtureMetaSummary(fId, homeName, awayName, homeId, awayId, p1Home, kickOff);

                MatchStateSummary? state = null;
                if (!reader.IsDBNull(7) || !reader.IsDBNull(8))
                {
                    state = new MatchStateSummary(
                        FixtureId: fId,
                        HomeName: reader.IsDBNull(1) ? "" : reader.GetString(1),
                        AwayName: reader.IsDBNull(2) ? "" : reader.GetString(2),
                        HomeScore: reader.IsDBNull(7) ? 0 : reader.GetInt32(7),
                        AwayScore: reader.IsDBNull(8) ? 0 : reader.GetInt32(8),
                        Phase: reader.IsDBNull(9) ? "" : reader.GetString(9),
                        Minute: reader.IsDBNull(10) ? "" : reader.GetString(10),
                        HomePct: reader.IsDBNull(11) ? 0m : reader.GetDecimal(11),
                        DrawPct: reader.IsDBNull(12) ? 0m : reader.GetDecimal(12),
                        AwayPct: reader.IsDBNull(13) ? 0m : reader.GetDecimal(13),
                        RedCardActive: !reader.IsDBNull(14) && reader.GetBoolean(14)
                    );
                }

                list.Add(new FixtureMetaAndState(meta, state));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[POSTGRES] GetFixturesWithStateAsync failed");
        }
        return list;
    }
}


public record ScoreEvent(
    string EventType,
    string HomeName,
    string AwayName,
    int HomeScore,
    int AwayScore,
    string Minute,
    string Phase,
    long Ts
);
