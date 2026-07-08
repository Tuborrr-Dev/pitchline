using MediatR;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Features.Fixtures;

// ── Query ─────────────────────────────────────────────────────────────────────

public record GetFixturesQuery : IRequest<GetFixturesResult>;

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

// ── Handler ───────────────────────────────────────────────────────────────────

public class GetFixturesHandler : IRequestHandler<GetFixturesQuery, GetFixturesResult>
{
    private readonly IMatchStateRepository _repo;

    public GetFixturesHandler(IMatchStateRepository repo) => _repo = repo;

    public async Task<GetFixturesResult> Handle(GetFixturesQuery request, CancellationToken ct)
    {
        // Get all fixture IDs from Redis
        var fixtureIds = await _repo.GetAllFixtureIdsAsync(ct);

        var dtos = new List<FixtureDto>();

        foreach (var id in fixtureIds)
        {
            var meta = await _repo.GetFixtureMetaAsync(id, ct);
            if (meta is null) continue;

            // Enrich with live state if match is in progress
            var state = await _repo.GetStateAsync(id, ct);

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

        // Live matches first, then upcoming sorted by kickoff
        var sorted = dtos
            .OrderByDescending(f => f.Phase is not null)
            .ThenBy(f => f.KickOff);

        return new GetFixturesResult(sorted);
    }
}

