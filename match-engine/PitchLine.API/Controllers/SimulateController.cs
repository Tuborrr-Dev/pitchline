// using Microsoft.AspNetCore.Mvc;
// using Pitchline.Infrastructure.TxLine;

// namespace PitchLine.API.Controllers;

// [ApiController]
// [Route("api/[controller]")]
// public class SimulateController(MatchReplayService replay) : ControllerBase
// {
//     private readonly MatchReplayService _replay = replay;

//     /// <summary>
//     /// POST /api/simulate/replay
//     /// Streams a saved match JSON through the live event pipeline.
//     /// speed=10 means 10x faster than real time. speed=0 = no delay.
//     /// </summary>
//     [HttpPost("replay")]
//     public async Task<IActionResult> Replay([FromBody] ReplayRequest req, CancellationToken ct)
//     {
//         if (!System.IO.File.Exists(req.FilePath))
//             return NotFound(new { message = $"File not found: {req.FilePath}" });

//         _ = Task.Run(() => _replay.ReplayAsync(req.FilePath, req.Speed, ct), ct);

//         return Accepted(new { message = "Replay started", file = req.FilePath, speed = req.Speed });
//     }
// }

// public record ReplayRequest(string FilePath, double Speed = 10);
