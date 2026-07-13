using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PitchLine.Application.Common.Interfaces;
using Pitchline.Infrastructure.Postgres;

namespace Pitchline.Infrastructure.TxLine;

public class HistoricalOddsSeedService(
    HttpClient http,
    PostgresRepository pg,
    ILogger<HistoricalOddsSeedService> logger,
    IConfiguration configuration) : IHistoricalOddsSeedService
{
    private readonly HttpClient _http = http;
    private readonly PostgresRepository _pg = pg;
    private readonly ILogger<HistoricalOddsSeedService> _logger = logger;
    private readonly string _apiToken = configuration["TxLine:ApiToken"]
            ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
    private readonly string _jwt = configuration["TxLine:Jwt"]
            ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");

    public async Task SeedHistoryAsync(int competitionId, CancellationToken ct = default)
    {
        var fixtures = await _pg.GetFinishedFixturesMissingOddsHistoryAsync(competitionId, ct);

        if (fixtures.Count == 0)
        {
            _logger.LogInformation("[SEED] No finished unseeded fixtures found for competition {CompetitionId}", competitionId);
            return;
        }

        foreach (var fixture in fixtures)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                _logger.LogInformation(
                    "[SEED] Starting fixture {FixtureId} — {Home} vs {Away}",
                    fixture.FixtureId,
                    fixture.HomeName,
                    fixture.AwayName);

                var snapshots = new List<OddsSnapshot>();

                for (var intervalIndex = 0; intervalIndex < 26; intervalIndex++)
                {
                    ct.ThrowIfCancellationRequested();

                    if (intervalIndex > 0)
                    {
                        await Task.Delay(TimeSpan.FromMilliseconds(100), ct);
                    }

                    var slotTime = fixture.KickOff.UtcDateTime.AddMinutes(intervalIndex * 5);
                    var epochDay = (int)(new DateTimeOffset(slotTime).ToUnixTimeSeconds() / 86400);
                    var hourOfDay = slotTime.Hour;
                    var interval = slotTime.Minute / 5;

                    var requestUri = new Uri(
                        _http.BaseAddress ?? new Uri("https://txline.txodds.com"),
                        $"/api/odds/updates/{epochDay}/{hourOfDay}/{interval}?fixtureId={fixture.FixtureId}");

                    using var request = new HttpRequestMessage(HttpMethod.Get, requestUri);
                    request.Headers.Authorization = new("Bearer", _jwt);
                    request.Headers.Add("X-Api-Token", _apiToken);

                    using var response = await _http.SendAsync(request, ct);
                    if (!response.IsSuccessStatusCode)
                    {
                        var body = await response.Content.ReadAsStringAsync(ct);
                        _logger.LogWarning(
                            "[SEED] Interval epoch={EpochDay} hour={HourOfDay} interval={Interval} returned {StatusCode} for fixture {FixtureId}: {Body}",
                            epochDay,
                            hourOfDay,
                            interval,
                            (int)response.StatusCode,
                            fixture.FixtureId,
                            body);
                        continue;
                    }

                    var bodyText = await response.Content.ReadAsStringAsync(ct);
                    if (string.IsNullOrWhiteSpace(bodyText))
                    {
                        continue;
                    }

                    var updates = JsonSerializer.Deserialize<List<OddsUpdate>>(bodyText);
                    var intervalSnapshots = (updates ?? [])
                        .Where(IsCandidate)
                        .Select(update =>
                        {
                            var probs = update.ToImpliedProbabilities();
                            return new OddsSnapshot(
                                HomePct: probs.Home,
                                DrawPct: probs.Draw,
                                AwayPct: probs.Away,
                                Timestamp: DateTimeOffset.FromUnixTimeMilliseconds(update.Ts));
                        })
                        .ToList();

                    snapshots.AddRange(intervalSnapshots);
                    _logger.LogInformation(
                        "[SEED] Interval epoch={EpochDay} hour={HourOfDay} interval={Interval} → {Count} snapshots",
                        epochDay,
                        hourOfDay,
                        interval,
                        intervalSnapshots.Count);
                }

                var inserted = await _pg.BulkInsertOddsHistoryAsync(fixture.FixtureId, snapshots, ct);
                _logger.LogInformation("[SEED] ✅ Inserted {Count} snapshots for fixture {FixtureId}", inserted, fixture.FixtureId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SEED] ❌ Failed fixture {FixtureId} — {Message}", fixture.FixtureId, ex.Message);
            }

            await Task.Delay(TimeSpan.FromMilliseconds(200), ct);
        }
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
