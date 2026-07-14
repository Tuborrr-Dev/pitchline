using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

/// <summary>
/// Service to replay historical odds updates for a fixture ID (or all fixtures).
/// Reads from Postgres odds_history first, and if unavailable, fetches updates from TxLINE API.
/// Emits updates through IMatchEventBus (SignalR, Postgres, Redis) at simulated speed.
/// </summary>
public class HistoricalOddsReplayService(
    HttpClient http,
    IMatchEventBus bus,
    FixtureMetadataService fixtures,
    PostgresRepository pg,
    MatchStateRepository repo,
    ILogger<HistoricalOddsReplayService> logger,
    IConfiguration config)
{
    private readonly HttpClient _http = http;
    private readonly IMatchEventBus _bus = bus;
    private readonly FixtureMetadataService _fixtures = fixtures;
    private readonly PostgresRepository _pg = pg;
    private readonly MatchStateRepository _repo = repo;
    private readonly ILogger<HistoricalOddsReplayService> _logger = logger;
    private readonly string _apiToken = config["TxLine:ApiToken"]
        ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
    private readonly string _jwt = config["TxLine:Jwt"]
        ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");

    /// <summary>
    /// Replays historical odds updates for all known fixtures that have odds history or fixture metadata.
    /// </summary>
    public async Task<HistoricalOddsReplayResult> ReplayAllAsync(double speedMultiplier = 1.0, CancellationToken ct = default)
    {
        var fixtureIds = await _pg.GetAllFixtureIdsAsync(ct);
        _logger.LogInformation("[HISTORICAL-ODDS] Starting odds replay for {Count} fixtures", fixtureIds.Count);

        var results = new List<FixtureOddsReplayStatus>();

        foreach (var fixtureId in fixtureIds)
        {
            ct.ThrowIfCancellationRequested();
            var status = await ReplayFixtureAsync(fixtureId, speedMultiplier, ct);
            results.Add(status);
        }

        var success = results.Count(r => r.UpdatesReplayed > 0);
        var skipped = results.Count(r => r.UpdatesReplayed == 0 && r.Error is null);
        var failed  = results.Count(r => r.Error is not null);

        _logger.LogInformation("[HISTORICAL-ODDS] Replay complete — {Success} replayed, {Skipped} skipped, {Failed} failed",
            success, skipped, failed);

        return new HistoricalOddsReplayResult(results);
    }

    /// <summary>
    /// Replays historical odds updates for a single fixture ID.
    /// </summary>
    public async Task<FixtureOddsReplayStatus> ReplayFixtureAsync(string fixtureId, double speedMultiplier = 1.0, CancellationToken ct = default)
    {
        try
        {
            if (!int.TryParse(fixtureId, out var parsedFixtureId))
            {
                return new FixtureOddsReplayStatus(fixtureId, 0, "Invalid fixture ID");
            }

            // 1. Resolve fixture metadata
            var fixture = await _fixtures.GetAsync(parsedFixtureId, ct)
                       ?? await _repo.GetFixtureMetaAsync(parsedFixtureId);

            if (fixture is null)
            {
                _logger.LogWarning("[HISTORICAL-ODDS] No fixture metadata found for {FixtureId} — skipping", fixtureId);
                return new FixtureOddsReplayStatus(fixtureId, 0, "No fixture metadata found");
            }

            // 2. Try fetching stored odds from Postgres first
            var snapshots = (await _pg.GetOddsHistoryAsync(fixtureId, ct)).ToList();
            var updatesToReplay = new List<OddsUpdate>();

            if (snapshots.Count > 0)
            {
                _logger.LogInformation("[HISTORICAL-ODDS] Loaded {Count} odds snapshots from Postgres for fixture {FixtureId}", snapshots.Count, fixtureId);
                foreach (var snapshot in snapshots)
                {
                    var ts = snapshot.Timestamp.ToUnixTimeMilliseconds();
                    var pct = new[]
                    {
                        snapshot.HomePct.ToString("F1", System.Globalization.CultureInfo.InvariantCulture),
                        snapshot.DrawPct.ToString("F1", System.Globalization.CultureInfo.InvariantCulture),
                        snapshot.AwayPct.ToString("F1", System.Globalization.CultureInfo.InvariantCulture)
                    };

                    updatesToReplay.Add(new OddsUpdate(
                        FixtureId: parsedFixtureId,
                        SuperOddsType: "1X2_PARTICIPANT_RESULT",
                        MarketPeriod: null,
                        PriceNames: ["part1", "draw", "part2"],
                        Prices: [],
                        Pct: pct,
                        Ts: ts
                    ));
                }
            }
            else
            {
                _logger.LogInformation("[HISTORICAL-ODDS] No Postgres history for fixture {FixtureId}, fetching live updates from TxLINE API...", fixtureId);
                updatesToReplay = await FetchTxLineOddsAsync(fixture, ct);
            }

            if (updatesToReplay.Count == 0)
            {
                _logger.LogInformation("[HISTORICAL-ODDS] No odds updates found for fixture {FixtureId}", fixtureId);
                return new FixtureOddsReplayStatus(fixtureId, 0, null);
            }

            _logger.LogInformation("[HISTORICAL-ODDS] Replaying {Count} odds updates for {Home} vs {Away} (fixture={FixtureId})",
                updatesToReplay.Count, fixture.HomeName, fixture.AwayName, fixtureId);

            // 3. Replay loop with configurable speed multiplier
            int replayed = 0;
            long? prevTs = null;

            foreach (var update in updatesToReplay)
            {
                ct.ThrowIfCancellationRequested();

                if (prevTs.HasValue && speedMultiplier > 0 && update.Ts > prevTs.Value)
                {
                    var gapMs = (int)((update.Ts - prevTs.Value) / speedMultiplier);
                    if (gapMs > 0)
                    {
                        await Task.Delay(Math.Min(gapMs, 5000), ct);
                    }
                }

                prevTs = update.Ts;

                var enriched = new EnrichedOddsUpdate(update, fixture);
                await _bus.PublishOddsUpdateAsync(enriched, ct);
                replayed++;
            }

            _logger.LogInformation("[HISTORICAL-ODDS] Completed odds replay for fixture {FixtureId} — {Count} updates replayed", fixtureId, replayed);
            return new FixtureOddsReplayStatus(fixtureId, replayed, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[HISTORICAL-ODDS] Replay failed for fixture {FixtureId}", fixtureId);
            return new FixtureOddsReplayStatus(fixtureId, 0, ex.Message);
        }
    }

    private async Task<List<OddsUpdate>> FetchTxLineOddsAsync(FixtureInfo fixture, CancellationToken ct)
    {
        var list = new List<OddsUpdate>();

        for (var intervalIndex = 0; intervalIndex < 26; intervalIndex++)
        {
            ct.ThrowIfCancellationRequested();

            var slotTime = fixture.KickOff.UtcDateTime.AddMinutes(intervalIndex * 5);
            var epochDay = (int)(new DateTimeOffset(slotTime).ToUnixTimeSeconds() / 86400);
            var hourOfDay = slotTime.Hour;
            var interval = slotTime.Minute / 5;

            var requestUri = new Uri(
                _http.BaseAddress ?? new Uri("https://txline.txodds.com"),
                $"/api/odds/updates/{epochDay}/{hourOfDay}/{interval}?fixtureId={fixture.FixtureId}");

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
                request.Headers.Authorization = new("Bearer", _jwt);
                request.Headers.Add("X-Api-Token", _apiToken);

                using var response = await _http.SendAsync(request, ct);
                if (!response.IsSuccessStatusCode) continue;

                var bodyText = await response.Content.ReadAsStringAsync(ct);
                if (string.IsNullOrWhiteSpace(bodyText)) continue;

                var updates = JsonSerializer.Deserialize<List<OddsUpdate>>(bodyText);
                if (updates is not null)
                {
                    list.AddRange(updates.Where(IsCandidate));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[HISTORICAL-ODDS] Failed to fetch interval {Interval} for fixture {FixtureId}", intervalIndex, fixture.FixtureId);
            }
        }

        return list.OrderBy(u => u.Ts).ToList();
    }

    private static bool IsCandidate(OddsUpdate update)
    {
        if (!update.IsFullMatchResult || update.Prices.Length != 3 || update.Pct is not { Length: 3 })
        {
            return false;
        }

        if (!update.PriceNames.Contains("part1", StringComparer.OrdinalIgnoreCase) ||
            !update.PriceNames.Contains("draw", StringComparer.OrdinalIgnoreCase) ||
            !update.PriceNames.Contains("part2", StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        return update.Pct.All(p => !string.IsNullOrWhiteSpace(p) && !p.Equals("NA", StringComparison.OrdinalIgnoreCase));
    }
}

public record HistoricalOddsReplayResult(IReadOnlyList<FixtureOddsReplayStatus> Fixtures)
{
    public int TotalReplayed => Fixtures.Sum(f => f.UpdatesReplayed);
    public int SuccessCount  => Fixtures.Count(f => f.UpdatesReplayed > 0);
    public int SkippedCount  => Fixtures.Count(f => f.UpdatesReplayed == 0 && f.Error is null);
    public int FailedCount   => Fixtures.Count(f => f.Error is not null);
}

public record FixtureOddsReplayStatus(string FixtureId, int UpdatesReplayed, string? Error);
