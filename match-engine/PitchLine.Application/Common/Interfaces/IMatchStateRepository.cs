namespace PitchLine.Application.Common.Interfaces;

public interface IMatchStateRepository
{
    Task<IReadOnlyList<string>> GetAllFixtureIdsAsync(CancellationToken cancellationToken = default);
    Task<FixtureMetaSummary?> GetFixtureMetaAsync(string fixtureId, CancellationToken cancellationToken = default);
    Task<MatchStateSummary?> GetStateAsync(string fixtureId, CancellationToken cancellationToken = default);
    Task<IEnumerable<string>> GetOddsHistoryAsync(string fixtureId, CancellationToken cancellationToken = default);
    Task<IEnumerable<string>> GetEventLogAsync(string fixtureId, CancellationToken cancellationToken = default);
}
public record FixtureMetaSummary(
    string FixtureId,
    string HomeName,
    string AwayName,
    string HomeId,
    string AwayId,
    bool Participant1IsHome,
    DateTimeOffset KickOff);
public record MatchStateSummary(
    string FixtureId,
    string HomeName,
    string AwayName,
    int HomeScore,
    int AwayScore,
    string Phase,
    string Minute,
    decimal HomePct,
    decimal DrawPct,
    decimal AwayPct,
    bool RedCardActive);
