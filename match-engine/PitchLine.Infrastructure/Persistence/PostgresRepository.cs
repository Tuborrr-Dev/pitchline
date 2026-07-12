using System.Text.Json;
using Microsoft.Extensions.Logging;
using Npgsql;
using Pitchline.Infrastructure.TxLine;

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
                kick_off     TIMESTAMPTZ NOT NULL,
                updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

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
                INSERT INTO fixture_meta (fixture_id, home_name, away_name, home_id, away_id, kick_off, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (fixture_id) DO UPDATE
                SET home_name  = EXCLUDED.home_name,
                    away_name  = EXCLUDED.away_name,
                    home_id    = EXCLUDED.home_id,
                    away_id    = EXCLUDED.away_id,
                    kick_off   = EXCLUDED.kick_off,
                    updated_at = NOW();
            """);
            cmd.Parameters.AddWithValue(fixture.FixtureId.ToString());
            cmd.Parameters.AddWithValue(fixture.HomeName);
            cmd.Parameters.AddWithValue(fixture.AwayName);
            cmd.Parameters.AddWithValue(fixture.HomeId.ToString());
            cmd.Parameters.AddWithValue(fixture.AwayId.ToString());
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
}
