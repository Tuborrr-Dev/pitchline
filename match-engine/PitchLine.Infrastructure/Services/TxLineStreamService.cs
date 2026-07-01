using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Long-running BackgroundService that opens both SSE streams concurrently,
/// parses every event, and forwards to IMatchEventBus for downstream handling
/// (Redis state + WebSocket broadcast + annotation engine).
/// </summary>
public class TxLineStreamService(
    SseClient sse,
    IMatchEventBus bus,
    ILogger<TxLineStreamService> logger,
    IConfiguration config) : BackgroundService
{
    // ── Verify these paths against your API reference dashboard ───────────
    private const string ScoresStreamPath = "/api/scores/stream";
    private const string OddsStreamPath   = "/api/odds/stream";
    // ───────────────────────────────────────────────────────────────────────

    private readonly SseClient _sse = sse;
    private readonly IMatchEventBus _bus = bus;
    private readonly ILogger<TxLineStreamService> _logger = logger;
    private readonly string _apiToken = config["TxLine:ApiToken"]
                    ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");

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
                await foreach (var evt in _sse.StreamAsync(path, _apiToken, ct))
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

            attempt++;
            var delaySeconds = Math.Min(30, Math.Pow(2, attempt)); // 2s, 4s, 8s … capped at 30s
            _logger.LogInformation("[{Path}] Reconnecting in {Delay}s", path, delaySeconds);
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────

    private async Task HandleScoreEventAsync(SseEvent evt, CancellationToken ct)
    {
        _logger.LogDebug("[SCORES] Raw event type={Type} data={Data}", evt.EventType, evt.Data);

        var update = JsonSerializer.Deserialize<ScoreUpdate>(evt.Data, JsonOptions);
        if (update is null) return;

        await _bus.PublishScoreUpdateAsync(update, ct);
    }

    private async Task HandleOddsEventAsync(SseEvent evt, CancellationToken ct)
    {
        _logger.LogDebug("[ODDS] Raw event type={Type} data={Data}", evt.EventType, evt.Data);

        var update = JsonSerializer.Deserialize<OddsUpdate>(evt.Data, JsonOptions);
        if (update is null) return;

        await _bus.PublishOddsUpdateAsync(update, ct);
    }

    // ── JSON options ──────────────────────────────────────────────────────

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition  = JsonIgnoreCondition.WhenWritingNull,
        NumberHandling  = JsonNumberHandling.AllowReadingFromString,
    };
}
