using System.Runtime.CompilerServices;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Raw SSE reader. Reads any SSE stream line-by-line and yields parsed events.
/// HttpClient MUST be configured with Timeout = InfiniteTimeSpan before passing in.
/// </summary>
public class SseClient
{
    private readonly HttpClient _http;
    private readonly ILogger<SseClient> _logger;

    public SseClient(HttpClient http, ILogger<SseClient> logger)
    {
        _http   = http;
        _logger = logger;
    }

    /// <summary>
    /// Opens a long-lived GET to <paramref name="path"/> and yields SSE events
    /// until the stream closes or <paramref name="ct"/> is cancelled.
    /// </summary>
    public async IAsyncEnumerable<SseEvent> StreamAsync(
        string path,
        string apiToken,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization    = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiToken);
        request.Headers.Accept.ParseAdd("text/event-stream");
        request.Headers.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true };

        using var response = await _http.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead, // don't buffer — start reading immediately
            ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("SSE {Path} returned {Status}: {Body}", path, (int)response.StatusCode, body);
            response.EnsureSuccessStatusCode(); // throws, triggers retry in the caller
        }

        _logger.LogInformation("SSE stream connected: {Path}", path);

        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var reader = new StreamReader(stream);

        // SSE spec state machine
        string?       eventType   = null;
        string?       lastEventId = null;
        var           dataBuffer  = new System.Text.StringBuilder();

        while (!ct.IsCancellationRequested)
        {
            string? line;
            try
            {
                line = await reader.ReadLineAsync(ct);
            }
            catch (Exception ex) when (ex is IOException or TaskCanceledException)
            {
                _logger.LogWarning("SSE {Path} read interrupted: {Msg}", path, ex.Message);
                yield break;
            }

            if (line is null)
            {
                // Server closed the stream cleanly
                _logger.LogWarning("SSE {Path} stream closed by server", path);
                yield break;
            }

            // ── SSE line parsing (per W3C spec) ──────────────────────────────
            if (line.StartsWith(':'))
            {
                // Comment or heartbeat — reset timeout, ignore payload
                continue;
            }

            if (line.Length == 0)
            {
                // Blank line = dispatch accumulated event
                if (dataBuffer.Length > 0)
                {
                    // SSE spec: strip trailing newline from data
                    if (dataBuffer[^1] == '\n')
                        dataBuffer.Remove(dataBuffer.Length - 1, 1);

                    yield return new SseEvent(
                        EventType: eventType,
                        Data:      dataBuffer.ToString(),
                        Id:        lastEventId
                    );
                }

                // Reset for next event
                eventType  = null;
                dataBuffer.Clear();
                continue;
            }

            // Field parsing
            if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                var value = line.Length > 6 ? line[5..].TrimStart() : string.Empty;
                dataBuffer.AppendLine(value);
            }
            else if (line.StartsWith("event:", StringComparison.Ordinal))
            {
                eventType = line[6..].Trim();
            }
            else if (line.StartsWith("id:", StringComparison.Ordinal))
            {
                lastEventId = line[3..].Trim();
            }
            // retry: field is informational only, we handle backoff ourselves
        }
    }
}

/// <summary>Parsed SSE event with all three optional fields.</summary>
public record SseEvent(string? EventType, string Data, string? Id);