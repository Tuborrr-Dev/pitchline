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

    // Debug — check what's in the in-memory fixture cache
    [HttpGet("debug/cache/{fixtureId}")]
    public ActionResult DebugCache(int fixtureId)
    {
        var fixture = _fixtureMetadata.Get(fixtureId);
        if (fixture is null) return NotFound(new { fixtureId, cached = false });
        return Ok(new { cached = true, fixture });
    }
}
