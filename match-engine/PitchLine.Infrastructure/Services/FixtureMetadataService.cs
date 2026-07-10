using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

public class FixtureMetadataService(
    HttpClient http,
    MatchStateRepository repo,
    PostgresRepository pg,
    ILogger<FixtureMetadataService> logger,
    IConfiguration config)
{
    private readonly HttpClient _http = http;
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly ILogger<FixtureMetadataService> _logger = logger;
    private readonly string _apiToken = config["TxLine:ApiToken"]
                    ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
    private readonly string _jwt = config["TxLine:Jwt"]
                    ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");

    // In-memory — fast lookup during stream handling
    private readonly Dictionary<int, FixtureInfo> _cache = [];
    private readonly SemaphoreSlim _lock = new(1, 1);

    public async Task RefreshAsync(CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/fixtures/snapshot?competitionId=72");
        req.Headers.Authorization = new("Bearer", _jwt);
        req.Headers.Add("X-Api-Token", _apiToken);

        var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();

        var raw = await resp.Content.ReadAsStringAsync(ct);
        _logger.LogInformation("[FIXTURES] raw response: {Raw}", raw);

        var fixtures = JsonSerializer.Deserialize<JsonElement>(raw);

        await _lock.WaitAsync(ct);
        try
        {
            _cache.Clear();
            foreach (var fixture in fixtures.EnumerateArray())
            {
                try
                {
                    var competitionId = fixture.GetProperty("CompetitionId").GetInt32();
                    if (competitionId != 72) continue;

                    var id = fixture.GetProperty("FixtureId").GetInt32();
                    var isP1Home = fixture.GetProperty("Participant1IsHome").GetBoolean();
                    var p1Name = fixture.GetProperty("Participant1").GetString()!;
                    var p2Name = fixture.GetProperty("Participant2").GetString()!;
                    var p1Id = fixture.GetProperty("Participant1Id").GetInt32();
                    var p2Id = fixture.GetProperty("Participant2Id").GetInt32();

                    var kickOff = DateTimeOffset.FromUnixTimeMilliseconds(fixture.GetProperty("StartTime").GetInt64());

                    _cache[id] = new FixtureInfo(
                        FixtureId: id,
                        HomeName: isP1Home ? p1Name : p2Name,
                        AwayName: isP1Home ? p2Name : p1Name,
                        HomeId: isP1Home ? p1Id : p2Id,
                        AwayId: isP1Home ? p2Id : p1Id,
                        KickOff: kickOff
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Skipping malformed fixture: {Raw}", fixture.GetRawText());
                }
            }

            // Persist to Redis + Postgres
            await _repo.SaveAllFixturesAsync(_cache.Values);
            foreach (var f in _cache.Values)
                _ = _pg.UpsertFixtureMetaAsync(f);
            _logger.LogInformation("[FIXTURES] persisted {Count} fixtures to Redis", _cache.Count);

            _logger.LogInformation("Fixture cache refreshed — {Count} fixtures loaded", _cache.Count);
        }
        finally
        {
            _lock.Release();
        }
    }

    public FixtureInfo? Get(int fixtureId)
        => _cache.TryGetValue(fixtureId, out var info) ? info : null;
}