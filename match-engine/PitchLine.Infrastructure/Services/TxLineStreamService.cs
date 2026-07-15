using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Long-running BackgroundService that opens both SSE streams concurrently,
/// parses every event, and forwards to IMatchEventBus for downstream handling
/// (Redis state + WebSocket broadcast + annotation engine).
/// </summary>
public class TxLineStreamService(
    SseClient sse,
    IMatchEventBus bus,
    FixtureMetadataService fixtures,
    TxLineSnapshotService snapshot,
    IMatchStateRepository repo,
    ILogger<TxLineStreamService> logger,
    IConfiguration config) : BackgroundService
{
    // ── Verify these paths against your API reference dashboard ───────────
    private const string ScoresStreamPath = "/api/scores/stream";
    private const string OddsStreamPath = "/api/odds/stream";
    // ───────────────────────────────────────────────────────────────────────

    private readonly SseClient _sse = sse;
    private readonly IMatchEventBus _bus = bus;
    private readonly FixtureMetadataService _fixtures = fixtures;
    private readonly TxLineSnapshotService _snapshot = snapshot;
    private readonly IMatchStateRepository _repo = repo;
    private readonly ILogger<TxLineStreamService> _logger = logger;
    private readonly IConfiguration _config = config;
    private readonly string _apiToken = config["TxLine:ApiToken"]
                    ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
    private readonly string _jwt = config["TxLine:Jwt"]
                    ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");


    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("TxLineStreamService starting — connecting both SSE streams");

        // Both streams run independently; if one drops it reconnects without
        // affecting the other.
        var scoresTask = ConsumeWithRetryAsync(
            ScoresStreamPath, HandleScoreEventAsync, stoppingToken);

        var oddsTask = ConsumeWithRetryAsync(
            OddsStreamPath, HandleOddsEventAsync, stoppingToken);

        await Task.WhenAll(scoresTask, oddsTask);

        _logger.LogInformation("TxLineStreamService stopped");
    }

    // ── Reconnect loop ────────────────────────────────────────────────────

    private async Task ConsumeWithRetryAsync(
        string path,
        Func<SseEvent, CancellationToken, Task> handler,
        CancellationToken ct)
    {
        var attempt = 0;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await foreach (var evt in _sse.StreamAsync(path, _jwt, _apiToken, ct))
                {
                    attempt = 0; // successful message → reset backoff counter

                    try
                    {
                        await handler(evt, ct);
                    }
                    catch (Exception ex)
                    {
                        // Handler errors must NOT kill the stream loop
                        _logger.LogError(ex, "[{Path}] Handler error on event: {Data}", path, evt.Data);
                    }
                }

                // Stream ended cleanly — fall through to reconnect
                _logger.LogWarning("[{Path}] Stream ended cleanly, reconnecting", path);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // App shutting down — exit cleanly
                break;
            }
            catch (HttpRequestException ex) when
                ((int)(ex.StatusCode ?? 0) == 401)
            {
                // Token expired — you'll need to re-activate here.
                // For the hackathon, crash loud so you know immediately.
                _logger.LogCritical("[{Path}] 401 Unauthorized — apiToken is expired or invalid. Re-activate via /api/token/activate", path);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[{Path}] Stream error (attempt {Attempt})", path, attempt + 1);
            }

            if (ct.IsCancellationRequested)
            {
                break;
            }

            attempt++;
            if (path == OddsStreamPath)
            {
                try
                {
                    _logger.LogInformation("[{Path}] Reconnected — resyncing odds snapshot", path);
                    var ids = await _repo.GetAllFixtureIdsAsync(ct);
                    foreach (var id in ids)
                    {
                        await _snapshot.SeedFromSnapshotAsync(id, ct);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[{Path}] Snapshot resync failed", path);
                }
            }

            var delaySeconds = Math.Min(30, Math.Pow(2, attempt)); // 2s, 4s, 8s … capped at 30s
            _logger.LogInformation("[{Path}] Reconnecting in {Delay}s", path, delaySeconds);
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────

    private async Task HandleScoreEventAsync(SseEvent evt, CancellationToken ct)
    {
        if (evt.EventType == "heartbeat") return;

        _logger.LogDebug("[SCORE] Received event: {Data}", evt.Data);

        var update = JsonSerializer.Deserialize<ScoreUpdate>(evt.Data, JsonOptions);
        if (update is null) return;

        var fixture = await _fixtures.GetAsync(update.FixtureId, ct);
        if (fixture is null && _fixtures.CanRefresh)
        {
            _logger.LogWarning("Unknown fixtureId {Id}, refreshing metadata", update.FixtureId);
            await _fixtures.RefreshAsync(ct);
            fixture = await _fixtures.GetAsync(update.FixtureId, ct);
        }

        if (fixture is null)
        {
            _logger.LogWarning("Skipping score event for unknown fixtureId {Id}", update.FixtureId);
            return;
        }

        var enforceKickoff = _config.GetValue<bool>("TxLine:EnforceKickoffCheck", true);
        if (enforceKickoff && DateTimeOffset.UtcNow < fixture.KickOff)
        {
            _logger.LogInformation("[SCORE] Ignoring event for fixture {FixtureId}: kickoff time {KickOff} not reached yet (now: {Now})",
                update.FixtureId, fixture.KickOff, DateTimeOffset.UtcNow);
            return;
        }

        await _bus.PublishScoreUpdateAsync(new EnrichedScoreUpdate(update, fixture), ct);
    }

    private async Task HandleOddsEventAsync(SseEvent evt, CancellationToken ct)
    {
        if (evt.EventType == "heartbeat") return;

        var update = JsonSerializer.Deserialize<OddsUpdate>(evt.Data, JsonOptions);
        if (update is null || !update.IsFullMatchResult) return;

        var fixture = await _fixtures.GetAsync(update.FixtureId, ct);
        if (fixture is null && _fixtures.CanRefresh)
        {
            _logger.LogWarning("Unknown fixtureId {Id}, refreshing metadata for odds", update.FixtureId);
            await _fixtures.RefreshAsync(ct);
            fixture = await _fixtures.GetAsync(update.FixtureId, ct);
        }

        if (fixture is null) return;

        var enforceKickoff = _config.GetValue<bool>("TxLine:EnforceKickoffCheck", true);
        if (enforceKickoff && DateTimeOffset.UtcNow < fixture.KickOff)
        {
            _logger.LogInformation("[ODDS] Ignoring event for fixture {FixtureId}: kickoff time {KickOff} not reached yet (now: {Now})",
                update.FixtureId, fixture.KickOff, DateTimeOffset.UtcNow);
            return;
        }

        await _bus.PublishOddsUpdateAsync(new EnrichedOddsUpdate(update, fixture), ct);
    }

    // ── JSON options ──────────────────────────────────────────────────────

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };
}
