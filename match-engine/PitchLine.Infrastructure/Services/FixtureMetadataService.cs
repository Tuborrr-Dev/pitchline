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
    TxLineSnapshotService snapshot,
    ILogger<FixtureMetadataService> logger,
    IConfiguration config)
{
    private readonly HttpClient _http = http;
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly TxLineSnapshotService _snapshot = snapshot;
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
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/fixtures/snapshot?startEpochDay=20615&competitionId=72");
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

                    // var phase = fixture.TryGetProperty("Phase", out var phaseEl) ? phaseEl.GetString() : null;
                    // if (phase?.Equals("Finished", StringComparison.OrdinalIgnoreCase) == true) continue;

                    var id = fixture.GetProperty("FixtureId").GetInt32();

                    // Skip if already seeded
                    var existing = await _repo.GetFixtureMetaAsync(id.ToString(), ct);
                    if (existing is not null)
                    {
                        // Still warm the in-memory cache
                        var isP1HomeEx = fixture.GetProperty("Participant1IsHome").GetBoolean();
                        var p1NameEx = fixture.GetProperty("Participant1").GetString()!;
                        var p2NameEx = fixture.GetProperty("Participant2").GetString()!;
                        var p1IdEx = fixture.GetProperty("Participant1Id").GetInt32();
                        var p2IdEx = fixture.GetProperty("Participant2Id").GetInt32();
                        var kickOffEx = DateTimeOffset.FromUnixTimeMilliseconds(fixture.GetProperty("StartTime").GetInt64());
                        _cache[id] = new FixtureInfo(
                            FixtureId: id,
                            HomeName: isP1HomeEx ? p1NameEx : p2NameEx,
                            AwayName: isP1HomeEx ? p2NameEx : p1NameEx,
                            HomeId: isP1HomeEx ? p1IdEx : p2IdEx,
                            AwayId: isP1HomeEx ? p2IdEx : p1IdEx,
                            Participant1IsHome: isP1HomeEx,
                            KickOff: kickOffEx
                        );
                        continue;
                    }

                    var isP1Home = fixture.GetProperty("Participant1IsHome").GetBoolean();
                    var p1Name = fixture.GetProperty("Participant1").GetString()!;
                    var p2Name = fixture.GetProperty("Participant2").GetString()!;
                    var p1Id = fixture.GetProperty("Participant1Id").GetInt32();
                    var p2Id = fixture.GetProperty("Participant2Id").GetInt32();
                    var kickOff = DateTimeOffset.FromUnixTimeMilliseconds(fixture.GetProperty("StartTime").GetInt64());

                    var info = new FixtureInfo(
                        FixtureId: id,
                        HomeName: isP1Home ? p1Name : p2Name,
                        AwayName: isP1Home ? p2Name : p1Name,
                        HomeId: isP1Home ? p1Id : p2Id,
                        AwayId: isP1Home ? p2Id : p1Id,
                        Participant1IsHome: isP1Home,
                        KickOff: kickOff
                    );

                    _cache[id] = info;

                    // Persist then seed odds — only for brand new fixtures
                    await _repo.SaveFixtureMetaAsync(info);
                    await _pg.UpsertFixtureMetaAsync(info);
                    await _snapshot.SeedFromSnapshotAsync(id.ToString(), ct);

                    _logger.LogInformation("[FIXTURES] new fixture seeded {FixtureId}", id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Skipping malformed fixture: {Raw}", fixture.GetRawText());
                }
            }

            _logger.LogInformation("[FIXTURES] cache ready — {Count} fixtures", _cache.Count);
        }
        finally
        {
            _lock.Release();
        }
    }

    public FixtureInfo? Get(int fixtureId)
        => _cache.TryGetValue(fixtureId, out var info) ? info : null;
}