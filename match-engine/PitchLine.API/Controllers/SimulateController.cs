using Microsoft.AspNetCore.Mvc;
using Pitchline.Infrastructure.Redis;
using Pitchline.Infrastructure.TxLine;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SimulateController(
    IMatchEventBus bus,
    FixtureMetadataService fixtures,
    MatchStateRepository repo) : ControllerBase
{
    private readonly IMatchEventBus _bus = bus;
    private readonly FixtureMetadataService _fixtures = fixtures;
    private readonly MatchStateRepository _repo = repo;

    /// <summary>
    /// POST /api/simulate/score
    /// Fires a fake goal event through the full pipeline:
    /// Redis → SignalR → Annotation service
    /// </summary>
    [HttpPost("score")]
    public async Task<IActionResult> SimulateScore([FromBody] SimulateScoreRequest req, CancellationToken ct)
    {
        var fixture = _fixtures.Get(req.FixtureId)
                   ?? await _repo.GetFixtureMetaAsync(req.FixtureId);

        if (fixture is null)
            return NotFound(new { message = $"Fixture {req.FixtureId} not in cache or Redis." });

        var score = new ScoreUpdate(
            FixtureId: req.FixtureId,
            Action: req.Action ?? "goal",
            GameState: null,
            StatusId: req.StatusId ?? 2,
            Participant: req.Participant ?? 1,
            Confirmed: true,
            Clock: new ScoreClock(Running: true, Seconds: (req.Minute ?? 35) * 60),
            Stats: new Dictionary<string, int>
            {
                ["1"] = req.HomeScore ?? 1,
                ["2"] = req.AwayScore ?? 0,
            },
            Ts: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        );

        await _bus.PublishScoreUpdateAsync(new EnrichedScoreUpdate(score, fixture), ct);

        return Ok(new
        {
            message = "Score event fired",
            fixture = $"{fixture.HomeName} vs {fixture.AwayName}",
            action = score.Action,
            score = $"{score.HomeScore}-{score.AwayScore}",
            minute = score.Minute,
            phase = score.Phase,
        });
    }
}

public record SimulateScoreRequest(
    int FixtureId,
    string? Action,
    int? StatusId,
    int? Participant,
    int? Minute,
    int? HomeScore,
    int? AwayScore
);
