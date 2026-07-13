using MediatR;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Features.Match;

// ── Query ─────────────────────────────────────────────────────────────────────

public record GetMatchQuery(string FixtureId) : IRequest<GetMatchResult?>;

// ── Result ────────────────────────────────────────────────────────────────────

public record GetMatchResult(
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
    bool RedCardActive,
    DateTimeOffset KickOff
);

// ── Handler ───────────────────────────────────────────────────────────────────

public class GetMatchHandler : IRequestHandler<GetMatchQuery, GetMatchResult?>
{
    private readonly IMatchStateRepository _repo;

    public GetMatchHandler(IMatchStateRepository repo) => _repo = repo;

    public async Task<GetMatchResult?> Handle(GetMatchQuery request, CancellationToken ct)
    {
        var state = await _repo.GetStateAsync(request.FixtureId, ct);
        if (state is null) return null;

        var meta = await _repo.GetFixtureMetaAsync(request.FixtureId, ct);

        return new GetMatchResult(
            FixtureId: request.FixtureId,
            HomeName: state.HomeName,
            AwayName: state.AwayName,
            HomeScore: state.HomeScore,
            AwayScore: state.AwayScore,
            Phase: state.Phase,
            Minute: state.Minute,
            HomePct: state.HomePct,
            DrawPct: state.DrawPct,
            AwayPct: state.AwayPct,
            RedCardActive: state.RedCardActive,
            KickOff: meta?.KickOff ?? DateTimeOffset.MinValue
        );
    }
}

