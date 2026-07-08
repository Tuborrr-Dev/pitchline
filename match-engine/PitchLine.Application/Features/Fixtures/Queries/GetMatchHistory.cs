using MediatR;
using PitchLine.Application.Common.Interfaces;
using System.Text.Json;

namespace Pitchline.Features.Match;

// ── Query ─────────────────────────────────────────────────────────────────────

public record GetMatchHistoryQuery(string FixtureId) : IRequest<GetMatchHistoryResult?>;

// ── Result ────────────────────────────────────────────────────────────────────

public record GetMatchHistoryResult(
    string FixtureId,
    string HomeName,
    string AwayName,
    IEnumerable<OddsSnapshot> OddsHistory,   // chart line data points
    IEnumerable<ScoreEventDto> Events         // event timeline icons
);

public record OddsSnapshot(
    decimal HomePct,
    decimal DrawPct,
    decimal AwayPct,
    DateTimeOffset Timestamp
);

public record ScoreEventDto(
    string EventType,
    int HomeScore,
    int AwayScore,
    string? Minute,
    string? Phase,
    DateTimeOffset Timestamp
);

// ── Handler ───────────────────────────────────────────────────────────────────

public class GetMatchHistoryHandler : IRequestHandler<GetMatchHistoryQuery, GetMatchHistoryResult?>
{
    private readonly IMatchStateRepository _repo;

    public GetMatchHistoryHandler(IMatchStateRepository repo) => _repo = repo;

    public async Task<GetMatchHistoryResult?> Handle(GetMatchHistoryQuery request, CancellationToken ct)
    {
        var meta = await _repo.GetFixtureMetaAsync(request.FixtureId, ct);
        if (meta is null) return null;

        // Read raw JSON strings from Redis lists
        var rawOdds = await _repo.GetOddsHistoryAsync(request.FixtureId, ct);
        var rawEvents = await _repo.GetEventLogAsync(request.FixtureId, ct);

        // Deserialize odds snapshots
        var oddsHistory = rawOdds
            .Select(json => JsonSerializer.Deserialize<OddsSnapshot>(json, JsonOptions))
            .Where(s => s is not null)
            .Select(s => s!);

        // Deserialize score events
        var events = rawEvents
            .Select(json => JsonSerializer.Deserialize<ScoreEventDto>(json, JsonOptions))
            .Where(e => e is not null)
            .Select(e => e!);

        return new GetMatchHistoryResult(
            FixtureId: request.FixtureId,
            HomeName: meta.HomeName,
            AwayName: meta.AwayName,
            OddsHistory: oddsHistory,
            Events: events
        );
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };
}

