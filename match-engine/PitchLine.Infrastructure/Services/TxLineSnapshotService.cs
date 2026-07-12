using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

public class TxLineSnapshotService
{
    private readonly HttpClient _http;
    private readonly MatchStateRepository _repo;
    private readonly ILogger<TxLineSnapshotService> _logger;
    private readonly string _apiToken;
    private readonly string _jwt;

    public TxLineSnapshotService(
        HttpClient http,
        MatchStateRepository repo,
        ILogger<TxLineSnapshotService> logger,
        IConfiguration config)
    {
        _http = http;
        _repo = repo;
        _logger = logger;
        _apiToken = config["TxLine:ApiToken"]
            ?? throw new InvalidOperationException("TxLine:ApiToken is not configured.");
        _jwt = config["TxLine:Jwt"]
            ?? throw new InvalidOperationException("TxLine:Jwt is not configured.");
    }

    /// <summary>
    /// Fetches the current odds snapshot for a fixture and seeds Redis so the match and history endpoints have probabilities.
    /// </summary>
    public async Task SeedFromSnapshotAsync(string fixtureId, CancellationToken ct = default)
    {
        try
        {
            if (!int.TryParse(fixtureId, out var fixtureNumber))
            {
                _logger.LogWarning("[SNAPSHOT] Invalid fixture id {FixtureId}", fixtureId);
                return;
            }

            var requestUri = new Uri(
                _http.BaseAddress ?? new Uri("https://txline.txodds.com"),
                $"/api/odds/snapshot/{fixtureId}");
 
            using var req = new HttpRequestMessage(HttpMethod.Get, requestUri);
            req.Headers.Authorization = new("Bearer", _jwt);
            req.Headers.Add("X-Api-Token", _apiToken);

            using var resp = await _http.SendAsync(req, ct);
            resp.EnsureSuccessStatusCode();

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            var json = await JsonSerializer.DeserializeAsync<JsonElement>(stream, cancellationToken: ct);

            _logger.LogDebug("[SNAPSHOT] Raw odds for {FixtureId}: {Json}", fixtureId, json.GetRawText());

            if (!TryReadOddsPayload(json, out var homeOdds, out var drawOdds, out var awayOdds, out var pct))
            {
                _logger.LogWarning("[SNAPSHOT] Could not parse odds payload for {FixtureId}: {Json}", fixtureId, json.GetRawText());
                return;
            }

            var oddsUpdate = new OddsUpdate(
                FixtureId: fixtureNumber,
                SuperOddsType: "1X2_PARTICIPANT_RESULT",
                MarketPeriod: null,
                PriceNames: ["part1", "draw", "part2"],
                Prices: [ToPrice(homeOdds), ToPrice(drawOdds), ToPrice(awayOdds)],
                Pct: pct,
                Ts: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            );

            var fixture = await _repo.GetFixtureMetaAsync(fixtureNumber);
            if (fixture is null)
            {
                _logger.LogWarning("[SNAPSHOT] No fixture meta for {FixtureId} — skipping seed", fixtureId);
                return;
            }

            // Don't fetch odds for finished matches
            var state = await _repo.GetStateAsync(fixtureNumber);
            if (state?.Phase?.Equals("Finished", StringComparison.OrdinalIgnoreCase) == true)
            {
                _logger.LogDebug("[SNAPSHOT] Skipping finished fixture {FixtureId}", fixtureId);
                return;
            }

            var enriched = new EnrichedOddsUpdate(oddsUpdate, fixture);
            var (home, draw, away) = oddsUpdate.ToImpliedProbabilities();

            await _repo.UpdateStateFromOddsAsync(enriched, home, draw, away);
            await _repo.AppendOddsSnapshotAsync(enriched, home, draw, away);

            var openingHomePct = await _repo.GetOpeningHomePctAsync(fixtureId);
            if (!openingHomePct.HasValue)
            {
                await _repo.SaveOpeningHomePctAsync(fixtureId, home);
            }

            _logger.LogInformation(
                "[SNAPSHOT] Seeded {FixtureId} — home={Home}% draw={Draw}% away={Away}%",
                fixtureId, home, draw, away);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[SNAPSHOT] Failed to seed odds for {FixtureId}", fixtureId);
        }
    }

    /// <summary>
    /// Seeds all fixtures that are already known to the repository.
    /// </summary>
    public async Task SeedAllFixturesAsync(CancellationToken ct = default)
    {
        var fixtureIds = await _repo.GetAllFixtureIdsAsync(ct);
        foreach (var fixtureId in fixtureIds)
        {
            await SeedFromSnapshotAsync(fixtureId, ct);
        }
    }

    private static bool TryReadOddsPayload(JsonElement json, out decimal home, out decimal draw, out decimal away, out string[] pct)
    {
        home = draw = away = 0m;
        pct = [];

        if (json.ValueKind != JsonValueKind.Array) return false;

        JsonElement? selected = null;
        foreach (var item in json.EnumerateArray())
        {
            if (!item.TryGetProperty("SuperOddsType", out var superType) ||
                superType.GetString() != "1X2_PARTICIPANT_RESULT") continue;

            var hasNullMarketPeriod = !item.TryGetProperty("MarketPeriod", out var marketPeriod) ||
                marketPeriod.ValueKind == JsonValueKind.Null ||
                string.IsNullOrWhiteSpace(marketPeriod.GetString());

            if (selected is null || hasNullMarketPeriod) selected = item;
        }

        if (selected is null) return false;

        var market = selected.Value;

        if (!market.TryGetProperty("Prices", out var prices) || prices.GetArrayLength() < 3) return false;
        if (!market.TryGetProperty("PriceNames", out var priceNames)) return false;

        var index1    = FindPriceIndex(priceNames, "part1");
        var indexDraw = FindPriceIndex(priceNames, "draw");
        var index2    = FindPriceIndex(priceNames, "part2");

        if (index1 < 0 || indexDraw < 0 || index2 < 0) return false;

        home = GetPriceValue(prices[index1]);
        draw = GetPriceValue(prices[indexDraw]);
        away = GetPriceValue(prices[index2]);

        // Read Pct if present
        if (market.TryGetProperty("Pct", out var pctEl) && pctEl.ValueKind == JsonValueKind.Array && pctEl.GetArrayLength() == 3)
            pct = [pctEl[0].GetString()!, pctEl[1].GetString()!, pctEl[2].GetString()!];

        return true;
    }

    private static int FindPriceIndex(JsonElement priceNames, string name)
    {
        for (var i = 0; i < priceNames.GetArrayLength(); i++)
        {
            if (priceNames[i].ValueKind == JsonValueKind.String && priceNames[i].GetString() == name)
            {
                return i;
            }
        }

        return -1;
    }

    private static decimal GetPriceValue(JsonElement price)
    {
        if (price.ValueKind == JsonValueKind.Number && price.TryGetDecimal(out var decimalValue))
        {
            return decimalValue;
        }

        if (price.ValueKind == JsonValueKind.String && decimal.TryParse(price.GetString(), out decimalValue))
        {
            return decimalValue;
        }

        return 0m;
    }

    private static int ToPrice(decimal odds) => (int)Math.Round(odds * 1000m);
}
