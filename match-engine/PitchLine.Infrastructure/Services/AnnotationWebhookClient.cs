using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Sends enriched score events to the annotation FastAPI service.
/// Fire-and-forget — never blocks the stream or SignalR broadcast.
/// </summary>
public class AnnotationWebhookClient(HttpClient http, ILogger<AnnotationWebhookClient> logger)
{
    private readonly HttpClient _http = http;
    private readonly ILogger<AnnotationWebhookClient> _logger = logger;

    public async Task SendScoreEventAsync(
        EnrichedScoreUpdate enriched,
        string scoreBefore,
        decimal probabilityDelta,
        MatchContextPayload matchContext)
    {
        var score = enriched.Score;

        // TeamId is "1" (home) or "2" (away) from Participant field
        var teamCode = score.TeamId == "1" ? enriched.Fixture.HomeName
                     : score.TeamId == "2" ? enriched.Fixture.AwayName
                     : "";

        var payload = new AnnotationPayload
        {
            EventId = $"evt_{Guid.NewGuid():N}",
            FixtureId = score.FixtureId.ToString(),
            MatchMinute = int.TryParse(score.Minute, out var min) ? min : 0,
            MatchPhase = score.Phase,
            EventType = score.Action ?? "",
            TeamCode = teamCode,
            PlayerName = "",
            ProbabilityDelta = probabilityDelta,
            ScoreBefore = scoreBefore,
            ScoreAfter = $"{score.HomeScore}-{score.AwayScore}",
            MatchContext = matchContext,
        };

        await PostAsync("/annotate", payload);
    }

    private async Task PostAsync<T>(string path, T payload)
    {
        try
        {
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            _logger.LogDebug("[ANNOTATION] → {Path} {Json}", path, json);

            var resp = await _http.PostAsync(path, content);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                _logger.LogWarning("[ANNOTATION] {Path} failed {Status}: {Body}", path, (int)resp.StatusCode, body);
            }
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("[ANNOTATION] {Path} timed out", path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ANNOTATION] {Path} threw — stream unaffected", path);
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
}

// ── Payload — matches AnnotationRequest in annotation-service/models.py ───────

public class AnnotationPayload
{
    [JsonPropertyName("eventId")] public string EventId { get; set; } = "";
    [JsonPropertyName("fixtureId")] public string FixtureId { get; set; } = "";
    [JsonPropertyName("matchMinute")] public int MatchMinute { get; set; }
    [JsonPropertyName("matchPhase")] public string MatchPhase { get; set; } = "";
    [JsonPropertyName("eventType")] public string EventType { get; set; } = "";
    [JsonPropertyName("teamCode")] public string TeamCode { get; set; } = "";
    [JsonPropertyName("playerName")] public string PlayerName { get; set; } = "";
    [JsonPropertyName("probability_delta")] public decimal ProbabilityDelta { get; set; }
    [JsonPropertyName("scoreBefore")] public string ScoreBefore { get; set; } = "";
    [JsonPropertyName("scoreAfter")] public string ScoreAfter { get; set; } = "";
    [JsonPropertyName("matchContext")] public MatchContextPayload MatchContext { get; set; } = new();
}

public class MatchContextPayload
{
    [JsonPropertyName("isComeback")] public bool IsComeback { get; set; }
    [JsonPropertyName("isLateGoal")] public bool IsLateGoal { get; set; }
    [JsonPropertyName("isEqualiser")] public bool IsEqualiser { get; set; }
    [JsonPropertyName("isWinningGoal")] public bool IsWinningGoal { get; set; }
    [JsonPropertyName("redCardActive")] public bool RedCardActive { get; set; }
}
