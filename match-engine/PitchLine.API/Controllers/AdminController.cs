using MediatR;
using Microsoft.AspNetCore.Mvc;
using Pitchline.Features.Admin;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    [HttpPost("seed-history/{competitionId:int}")]
    public IActionResult SeedHistory(int competitionId, CancellationToken cancellationToken)
    {
        _ = Task.Run(() => _mediator.Send(new SeedHistoryCommand(competitionId), cancellationToken), cancellationToken);
        return Accepted(new { message = "Historical odds seeding started", competitionId });
    }
}
