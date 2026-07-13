using MediatR;
using Microsoft.AspNetCore.Mvc;
using Pitchline.Features.Match;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchController(IMediator mediator) : ControllerBase
{
    private readonly IMediator _mediator = mediator;

    [HttpGet("{fixtureId}")]
    public async Task<ActionResult<GetMatchResult>> Get(string fixtureId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetMatchQuery(fixtureId), cancellationToken);

        if (result is null)
        {
            return NotFound(new { message = $"No active match found for fixture {fixtureId}" });
        }

        return Ok(result);
    }

    [HttpGet("{fixtureId}/history")]
    public async Task<ActionResult<GetMatchHistoryResult>> GetHistory(string fixtureId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetMatchHistoryQuery(fixtureId), cancellationToken);

        if (result is null)
        {
            return NotFound(new { message = $"No history found for fixture {fixtureId}" });
        }

        return Ok(result);
    }
}
