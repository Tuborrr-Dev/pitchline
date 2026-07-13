namespace PitchLine.Application.Common.Interfaces;

public interface IHistoricalOddsSeedService
{
    Task SeedHistoryAsync(int competitionId, CancellationToken ct = default);
}
