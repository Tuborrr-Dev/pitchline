using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Fetches the full historical score sequence for every known fixture
/// from the TxLINE /api/scores/historical/{fixtureId} endpoint and
/// replays all events through the live event pipeline.
///
/// Only covers matches whose kickoff was between 2 weeks and 6 hours ago
/// — this is the window the TxLINE historical endpoint covers.
/// </summary>
public class HistoricalScoreReplayService(
    HttpClient http,
    IMatchEventBus bus,
    FixtureMetadataService fixtures,
    PostgresRepository pg,
    MatchStateRepository repo,
    ILogger<HistoricalScoreReplayService> logger,
    IConfiguration config)
{
    private readonly HttpClient _http = http;
    private readonly IMatchEventBus _bus = bus;
    private readonly FixtureMetadataService _fixtures = fixtures;
    private readonly PostgresRepository _pg = pg;
    private readonly MatchStateRepository _repo = repo;
    private readonly ILogger<HistoricalScoreReplayService> _logger = logger;
    private readonly string _apiToken = config["TxLine:ApiToken"]
        ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
    private readonly string _jwt = config["TxLine:Jwt"]
        ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");

    private static readonly HashSet<string> SkippedActions =
    [
        "coverage_update", "comment", "connected", "disconnected",
        "venue", "pitch", "weather", "players_warming_up", "jersey",
        "lineups", "players_on_the_pitch", "clock_adjustment", "standby"
    ];

    private static readonly HashSet<string> GoalActions = ["goal", "ownGoal"];

    private static readonly HashSet<string> TerminalActions =
        ["fullTime", "game_finalised", "game_abandoned", "game_cancelled"];

    // ── Public entry points ───────────────────────────────────────────────────

    /// <summary>
    /// Iterates every known fixture ID from Postgres and replays each one.
    /// Only fixtures within the TxLINE historical window (2 weeks → 6 hours ago) will return events.
    /// speedMultiplier=0 means no delay between events (instant replay).
    /// </summary>
    public async Task<HistoricalReplayResult> ReplayAllAsync(double speedMultiplier = 0, CancellationToken ct = default)
    {
        var fixtureIds = await _pg.GetAllFixtureIdsAsync(ct);
        _logger.LogInformation("[HISTORICAL] Starting replay for {Count} fixtures", fixtureIds.Count);

        var results = new List<FixtureReplayStatus>();

        foreach (var fixtureId in fixtureIds)
        {
            ct.ThrowIfCancellationRequested();
            var status = await ReplayFixtureAsync(fixtureId, speedMultiplier, ct);
            results.Add(status);
        }

        var success = results.Count(r => r.EventsReplayed > 0);
        var skipped = results.Count(r => r.EventsReplayed == 0 && r.Error is null);
        var failed  = results.Count(r => r.Error is not null);

        _logger.LogInformation("[HISTORICAL] Replay complete — {Success} replayed, {Skipped} skipped (no data), {Failed} failed",
            success, skipped, failed);

        return new HistoricalReplayResult(results);
    }

    /// <summary>
    /// Replays a single fixture by ID.
    /// </summary>
    public async Task<FixtureReplayStatus> ReplayFixtureAsync(string fixtureId, double speedMultiplier = 0, CancellationToken ct = default)
    {
        try
        {
            // 1. Fetch events from TxLINE historical endpoint
            var events = await FetchHistoricalEventsAsync(fixtureId, ct);
            if (events.Length == 0)
            {
                _logger.LogDebug("[HISTORICAL] No events returned for {FixtureId} (outside window or no data)", fixtureId);
                return new FixtureReplayStatus(fixtureId, 0, null);
            }

            // 2. Resolve fixture metadata
            var fixture = await _fixtures.GetAsync(int.Parse(fixtureId), ct)
                       ?? await _repo.GetFixtureMetaAsync(int.Parse(fixtureId));

            if (fixture is null)
            {
                _logger.LogWarning("[HISTORICAL] No fixture meta for {FixtureId} — skipping", fixtureId);
                return new FixtureReplayStatus(fixtureId, 0, "No fixture metadata found");
            }

            _logger.LogInformation("[HISTORICAL] Replaying {Count} events for {Home} vs {Away} (fixture={FixtureId})",
                events.Length, fixture.HomeName, fixture.AwayName, fixtureId);

            // 3. Walk events in order and publish
            int replayed = 0;
            long? prevTs = null;

            foreach (var e in events)
            {
                ct.ThrowIfCancellationRequested();

                var action = e.TryGetProperty("Action", out var actionEl) ? actionEl.GetString() : null;
                if (action is null || SkippedActions.Contains(action)) continue;

                var ts = e.TryGetProperty("Ts", out var tsEl) ? tsEl.GetInt64() : 0;

                // Proportional delay between events
                if (prevTs.HasValue && speedMultiplier > 0 && ts > 0)
                {
                    var gapMs = (int)((ts - prevTs.Value) / speedMultiplier);
                    if (gapMs > 0)
                        await Task.Delay(Math.Min(gapMs, 5000), ct);
                }

                if (ts > 0) prevTs = ts;

                // Only publish goals and terminal (match-ending) events
                if (!GoalActions.Contains(action) && !TerminalActions.Contains(action)) continue;

                try
                {
                    var scoreUpdate = JsonSerializer.Deserialize<ScoreUpdate>(e.GetRawText());
                    if (scoreUpdate is null) continue;

                    var enriched = new EnrichedScoreUpdate(scoreUpdate, fixture);
                    await _bus.PublishScoreUpdateAsync(enriched, ct);
                    replayed++;

                    _logger.LogDebug("[HISTORICAL] Published {Action} @ {Minute}' fixture={FixtureId}",
                        action, scoreUpdate.Minute, fixtureId);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[HISTORICAL] Failed to publish event {Action} for {FixtureId}", action, fixtureId);
                }
            }

            _logger.LogInformation("[HISTORICAL] Completed replay for {FixtureId} — {Replayed} events published", fixtureId, replayed);
            return new FixtureReplayStatus(fixtureId, replayed, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[HISTORICAL] Replay failed for {FixtureId}", fixtureId);
            return new FixtureReplayStatus(fixtureId, 0, ex.Message);
        }
    }

    // ── TxLINE HTTP fetch ─────────────────────────────────────────────────────

    private async Task<JsonElement[]> FetchHistoricalEventsAsync(string fixtureId, CancellationToken ct)
    {
        try
        {
            var uri = new Uri(
                _http.BaseAddress ?? new Uri("https://txline.txodds.com"),
                $"/api/scores/historical/{fixtureId}");

            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            req.Headers.Authorization = new("Bearer", _jwt);
            req.Headers.Add("X-Api-Token", _apiToken);

            using var resp = await _http.SendAsync(req, ct);
            var body = await resp.Content.ReadAsStringAsync(ct);

            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("[HISTORICAL] {FixtureId} returned {Status}: {Body}", fixtureId, (int)resp.StatusCode, body);
                return [];
            }

            if (string.IsNullOrWhiteSpace(body))
            {
                _logger.LogWarning("[HISTORICAL] {FixtureId} returned an empty response body", fixtureId);
                return [];
            }

            try
            {
                return ParseHistoricalResponse(body);
            }
            catch (JsonException ex)
            {
                var truncatedBody = body.Length > 1024 ? body.Substring(0, 1024) + "..." : body;
                _logger.LogWarning(ex, "[HISTORICAL] Failed to parse historical events JSON for {FixtureId}: {Body}", fixtureId, truncatedBody);
                return [];
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HISTORICAL] Failed to fetch events for {FixtureId}", fixtureId);
            return [];
        }
    }

    private static JsonElement[] ParseHistoricalResponse(string body)
    {
        var trimmed = body.TrimStart();
        if (trimmed.StartsWith("[") || trimmed.StartsWith("{"))
        {
            return ParseJsonPayload(trimmed);
        }

        // Support SSE-style payloads where each event is prefixed with `data:`
        if (body.Contains("data:", StringComparison.Ordinal))
        {
            var events = new List<JsonElement>();
            var sb = new System.Text.StringBuilder();

            using var reader = new StringReader(body);
            string? line;
            while ((line = reader.ReadLine()) is not null)
            {
                if (line.StartsWith("data:", StringComparison.Ordinal))
                {
                    sb.AppendLine(line[5..].TrimStart());
                    continue;
                }

                if (string.IsNullOrWhiteSpace(line))
                {
                    if (sb.Length > 0)
                    {
                        events.AddRange(ParseJsonPayload(sb.ToString()));
                        sb.Clear();
                    }
                    continue;
                }
            }

            if (sb.Length > 0)
            {
                events.AddRange(ParseJsonPayload(sb.ToString()));
            }

            return events.ToArray();
        }

        return [];
    }

    private static JsonElement[] ParseJsonPayload(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        return root.ValueKind switch
        {
            JsonValueKind.Array => root.EnumerateArray().Select(e => e.Clone()).ToArray(),
            JsonValueKind.Object => new[] { root.Clone() },
            _ => []
        };
    }
}

// ── Result records ────────────────────────────────────────────────────────────

public record HistoricalReplayResult(IReadOnlyList<FixtureReplayStatus> Fixtures)
{
    public int TotalReplayed => Fixtures.Sum(f => f.EventsReplayed);
    public int SuccessCount  => Fixtures.Count(f => f.EventsReplayed > 0);
    public int SkippedCount  => Fixtures.Count(f => f.EventsReplayed == 0 && f.Error is null);
    public int FailedCount   => Fixtures.Count(f => f.Error is not null);
}

public record FixtureReplayStatus(string FixtureId, int EventsReplayed, string? Error);
