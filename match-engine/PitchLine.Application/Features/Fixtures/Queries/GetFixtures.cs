using MediatR;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Features.Fixtures;

// ── Queries ────────────────────────────────────────────────────────────────────

public record GetFixturesQuery : IRequest<GetFixturesResult>;
public record GetFinishedFixturesQuery : IRequest<GetFixturesResult>;

// ── Result ────────────────────────────────────────────────────────────────────

public record GetFixturesResult(IEnumerable<FixtureDto> Fixtures);

public record FixtureDto(
    string FixtureId,
    string HomeName,
    string AwayName,
    string HomeId,
    string AwayId,
    DateTimeOffset KickOff,
    // Live state — null if match hasn't started yet
    int? HomeScore,
    int? AwayScore,
    string? Phase,
    string? Minute,
    decimal? HomePct,
    decimal? DrawPct,
    decimal? AwayPct
);

// ── Handlers ───────────────────────────────────────────────────────────────────

public class GetFixturesHandler : IRequestHandler<GetFixturesQuery, GetFixturesResult>
{
    private readonly IMatchStateRepository _repo;

    public GetFixturesHandler(IMatchStateRepository repo) => _repo = repo;

    public async Task<GetFixturesResult> Handle(GetFixturesQuery request, CancellationToken ct)
    {
        // Get all fixtures with state in a single bulk query
        var fixturesWithState = await _repo.GetFixturesWithStateAsync(ct);

        var dtos = new List<FixtureDto>();

        foreach (var item in fixturesWithState)
        {
            var meta = item.Meta;
            var state = item.State;

            dtos.Add(new FixtureDto(
                FixtureId: meta.FixtureId,
                HomeName: meta.HomeName,
                AwayName: meta.AwayName,
                HomeId: meta.HomeId,
                AwayId: meta.AwayId,
                KickOff: meta.KickOff,
                HomeScore: state?.HomeScore,
                AwayScore: state?.AwayScore,
                Phase: string.IsNullOrEmpty(state?.Phase)
                    ? (meta.KickOff > DateTimeOffset.UtcNow ? "Scheduled" : "Finished")
                    : state.Phase,
                Minute: state?.Minute,
                HomePct: state?.HomePct,
                DrawPct: state?.DrawPct,
                AwayPct: state?.AwayPct
            ));
        }

        // Live matches first, then upcoming sorted by kickoff. Exclude finished.
        var filtered = dtos
            .Where(f => f.Phase != "Finished" && f.Phase != "FT")
            .OrderByDescending(f => f.Phase != "Scheduled")
            .ThenBy(f => f.KickOff);

        return new GetFixturesResult(filtered);
    }
}

public class GetFinishedFixturesHandler : IRequestHandler<GetFinishedFixturesQuery, GetFixturesResult>
{
    private readonly IMatchStateRepository _repo;

    public GetFinishedFixturesHandler(IMatchStateRepository repo) => _repo = repo;

    public async Task<GetFixturesResult> Handle(GetFinishedFixturesQuery request, CancellationToken ct)
    {
        var fixturesWithState = await _repo.GetFixturesWithStateAsync(ct);

        var dtos = new List<FixtureDto>();

        foreach (var item in fixturesWithState)
        {
            var meta = item.Meta;
            var state = item.State;

            var resolvedPhase = string.IsNullOrEmpty(state?.Phase)
                ? (meta.KickOff > DateTimeOffset.UtcNow ? "Scheduled" : "Finished")
                : state.Phase;

            if (resolvedPhase == "Finished" || resolvedPhase == "FT")
            {
                dtos.Add(new FixtureDto(
                    FixtureId: meta.FixtureId,
                    HomeName: meta.HomeName,
                    AwayName: meta.AwayName,
                    HomeId: meta.HomeId,
                    AwayId: meta.AwayId,
                    KickOff: meta.KickOff,
                    HomeScore: state?.HomeScore,
                    AwayScore: state?.AwayScore,
                    Phase: resolvedPhase,
                    Minute: state?.Minute,
                    HomePct: state?.HomePct,
                    DrawPct: state?.DrawPct,
                    AwayPct: state?.AwayPct
                ));
            }
        }

        // Finished matches sorted newest to oldest (kickoff descending)
        var sorted = dtos.OrderByDescending(f => f.KickOff);

        return new GetFixturesResult(sorted);
    }
}

