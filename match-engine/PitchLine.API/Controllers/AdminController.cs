using MediatR;
using Microsoft.AspNetCore.Mvc;
using Pitchline.Features.Admin;
using PitchLine.Application.Common.Interfaces;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController(IMediator mediator, IMatchStateRepository repo) : ControllerBase
{
    private readonly IMediator _mediator = mediator;
    private readonly IMatchStateRepository _repo = repo;

    [HttpPost("seed-history/{competitionId:int}")]
    public IActionResult SeedHistory(int competitionId, CancellationToken cancellationToken)
    {
        _ = Task.Run(() => _mediator.Send(new SeedHistoryCommand(competitionId), cancellationToken), cancellationToken);
        return Accepted(new { message = "Historical odds seeding started", competitionId });
    }

    [HttpPost("rehydrate-redis")]
    public async Task<IActionResult> RehydrateRedis(CancellationToken cancellationToken)
    {
        var syncedCount = await _repo.SyncPostgresToRedisAsync(cancellationToken);
        return Ok(new { message = "Redis rehydration complete", syncedCount });
    }
}
