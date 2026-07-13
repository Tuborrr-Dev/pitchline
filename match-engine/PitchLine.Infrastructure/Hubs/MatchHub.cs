using Microsoft.AspNetCore.SignalR;

namespace Pitchline.Api.Hubs;

public class MatchHub : Hub
{
    public async Task JoinFixture(string fixtureId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"fixture:{fixtureId}");
    }

    public async Task LeaveFixture(string fixtureId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"fixture:{fixtureId}");
    }
}
