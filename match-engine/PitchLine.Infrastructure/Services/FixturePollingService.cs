// FixturePollingService.cs
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Pitchline.Infrastructure.TxLine;

public class FixturePollingService : BackgroundService
{
    private readonly FixtureMetadataService _metadata;
    private readonly TxLineSnapshotService _snapshot;
    private readonly ILogger<FixturePollingService> _logger;

    public FixturePollingService(
        FixtureMetadataService metadata,
        TxLineSnapshotService snapshot,
        ILogger<FixturePollingService> logger)
    {
        _metadata = metadata;
        _snapshot = snapshot;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        // Load immediately on startup so cache is warm before streams start
        await _metadata.RefreshAsync(ct);

        // Then refresh every 5 minutes (matches PRD Section 10)
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        while (await timer.WaitForNextTickAsync(ct))
        {
            try { await _metadata.RefreshAsync(ct); }
            catch (Exception ex) { _logger.LogError(ex, "Fixture refresh failed"); }
        }
    }
}