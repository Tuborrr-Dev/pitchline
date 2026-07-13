using Microsoft.AspNetCore.Mvc;
using Pitchline.Infrastructure.TxLine;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SimulateController(
    MatchReplayService replay,
    HistoricalScoreReplayService historicalReplay) : ControllerBase
{
    private readonly MatchReplayService _replay = replay;
    private readonly HistoricalScoreReplayService _historicalReplay = historicalReplay;

    /// <summary>
    /// POST /api/simulate/replay
    /// Streams a saved match JSON through the live event pipeline.
    /// speed=10 means 10x faster than real time. speed=0 = no delay.
    /// </summary>
    [HttpPost("replay")]
    public async Task<IActionResult> Replay([FromBody] ReplayRequest req, CancellationToken ct)
    {
        if (!System.IO.File.Exists(req.FilePath))
            return NotFound(new { message = $"File not found: {req.FilePath}" });

        _ = Task.Run(() => _replay.ReplayAsync(req.FilePath, req.Speed, ct), ct);

        return Accepted(new { message = "Replay started", file = req.FilePath, speed = req.Speed });
    }

    /// <summary>
    /// POST /api/simulate/replay-historical
    /// Fetches score history from TxLINE for every known fixture and
    /// replays all events through the live pipeline.
    /// Only fixtures whose kickoff was between 2 weeks and 6 hours ago will have data.
    /// speed=0 = no delay (default). speed=10 = 10x real-time gap.
    /// </summary>
    [HttpPost("replay-historical")]
    public IActionResult ReplayHistorical([FromBody] HistoricalReplayRequest req, CancellationToken ct)
    {
        _ = Task.Run(() => _historicalReplay.ReplayAllAsync(req.Speed, ct), ct);

        return Accepted(new
        {
            message = "Historical replay started for all known fixtures",
            speed   = req.Speed,
            note    = "Only fixtures with kickoff between 2 weeks and 6 hours ago will return events from TxLINE."
        });
    }

    /// <summary>
    /// POST /api/simulate/replay-historical/{fixtureId}
    /// Fetches and replays score history for a single fixture.
    /// </summary>
    [HttpPost("replay-historical/{fixtureId}")]
    public IActionResult ReplayHistoricalFixture(string fixtureId, [FromBody] HistoricalReplayRequest req, CancellationToken ct)
    {
        _ = Task.Run(async () =>
        {
            var result = await _historicalReplay.ReplayFixtureAsync(fixtureId, req.Speed, ct);
            return result;
        }, ct);

        return Accepted(new
        {
            message   = $"Historical replay started for fixture {fixtureId}",
            fixtureId,
            speed     = req.Speed
        });
    }
}

public record ReplayRequest(string FilePath, double Speed = 10);
public record HistoricalReplayRequest(double Speed = 0);
