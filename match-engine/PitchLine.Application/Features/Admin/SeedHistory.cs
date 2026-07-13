using MediatR;
using PitchLine.Application.Common.Interfaces;

namespace Pitchline.Features.Admin;

public record SeedHistoryCommand(int CompetitionId) : IRequest;

public class SeedHistoryHandler(IHistoricalOddsSeedService seedService) : IRequestHandler<SeedHistoryCommand>
{
    private readonly IHistoricalOddsSeedService _seedService = seedService;

    public async Task Handle(SeedHistoryCommand request, CancellationToken cancellationToken)
    {
        await _seedService.SeedHistoryAsync(request.CompetitionId, cancellationToken);
    }
}
