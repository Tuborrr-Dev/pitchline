using MediatR;
using Microsoft.AspNetCore.Mvc;
using Pitchline.Features.Fixtures;
using Pitchline.Infrastructure.TxLine;

namespace PitchLine.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FixturesController(IMediator mediator, FixtureMetadataService fixtureMetadata) : ControllerBase
{
    private readonly IMediator _mediator = mediator;
    private readonly FixtureMetadataService _fixtureMetadata = fixtureMetadata;

    [HttpGet]
    public async Task<ActionResult<GetFixturesResult>> Get(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetFixturesQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("finished")]
    public async Task<ActionResult<GetFixturesResult>> GetFinished(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetFinishedFixturesQuery(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("debug/cache/{fixtureId}")]
    public async Task<ActionResult> DebugCache(int fixtureId, CancellationToken cancellationToken)
    {
        var fixture = await _fixtureMetadata.GetAsync(fixtureId, cancellationToken);
        if (fixture is null) return NotFound(new { fixtureId, cached = false });
        return Ok(new { cached = true, fixture });
    }
}
