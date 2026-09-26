using Microsoft.Extensions.Logging;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

public class FixtureMetadataService(
    MatchStateRepository repo,
    PostgresRepository pg,
    ILogger<FixtureMetadataService> logger)
{
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly ILogger<FixtureMetadataService> _logger = logger;

    private DateTimeOffset _lastRefreshedAt = DateTimeOffset.MinValue;
    public bool CanRefresh => DateTimeOffset.UtcNow - _lastRefreshedAt > TimeSpan.FromMinutes(5);

    /// <summary>
    /// Warms Redis from Postgres — no TxODDS HTTP call.
    /// </summary>
    public async Task RefreshAsync(CancellationToken ct = default)
    {
        _lastRefreshedAt = DateTimeOffset.UtcNow;
        var synced = await _repo.SyncPostgresToRedisAsync(ct);
        _logger.LogInformation("[FIXTURES] Synced {Count} fixtures from Postgres to Redis", synced);
    }

    public async Task<FixtureInfo?> GetAsync(int fixtureId, CancellationToken ct = default)
        => await _repo.GetFixtureMetaAsync(fixtureId);
}
