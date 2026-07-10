using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Pitchline.Api.Hubs;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;

namespace Pitchline.Infrastructure.TxLine;

public class SignalREventBus(
    IHubContext<MatchHub> hub,
    MatchStateRepository repo,
    PostgresRepository pg,
    AnnotationWebhookClient annotation,
    ILogger<SignalREventBus> logger) : IMatchEventBus
{
    private readonly IHubContext<MatchHub> _hub = hub;
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly AnnotationWebhookClient _annotation = annotation;
    private readonly ILogger<SignalREventBus> _logger = logger;

    public async Task PublishScoreUpdateAsync(EnrichedScoreUpdate enriched, CancellationToken ct = default)
    {
        var fixtureId = enriched.Score.FixtureId;
        var group = $"fixture:{fixtureId}";

        // 1. Read previous state BEFORE writing (needed for scoreBefore + matchContext)
        var scoreBefore = await _repo.GetScoreBeforeAsync(fixtureId);
        var prevState = await _repo.GetStateAsync(fixtureId);

        // 2. Write to Redis + Postgres
        _logger.LogInformation("[REDIS] Writing score state — fixture={FixtureId}", fixtureId);
        await _repo.UpdateStateFromScoreAsync(enriched);
        await _repo.AppendScoreEventAsync(enriched);
        _ = _pg.UpsertStateFromScoreAsync(enriched);
        _ = _pg.AppendScoreEventAsync(enriched);

        // 3. Build matchContext booleans
        var homeAfter = enriched.Score.HomeScore;
        var awayAfter = enriched.Score.AwayScore;
        var homeBefore = prevState?.HomeScore ?? 0;
        var awayBefore = prevState?.AwayScore ?? 0;
        var minute = int.TryParse(enriched.Score.Minute, out var m) ? m : 0;

        var matchContext = new
        {
            isComeback = IsComeback(homeBefore, awayBefore, homeAfter, awayAfter, enriched.Score.TeamId,
                                       enriched.Fixture.HomeId),
            isLateGoal = minute >= 80,
            isEqualiser = homeAfter == awayAfter,
            isWinningGoal = IsWinningGoal(homeAfter, awayAfter, enriched.Score.TeamId, enriched.Fixture.HomeId),
            redCardActive = prevState?.RedCardActive ?? false,
        };

        var payload = new
        {
            fixtureId,
            homeName = enriched.Fixture.HomeName,
            awayName = enriched.Fixture.AwayName,
            homeScore = homeAfter,
            awayScore = awayAfter,
            action = enriched.Score.Action,
            minute = enriched.Score.Minute,
            gameState = enriched.Score.Phase,
            scoreBefore,
            matchContext,
            timestamp = enriched.Score.Ts,
        };

        // 4. Push to frontend via SignalR
        await _hub.Clients.Group(group).SendAsync("ScoreUpdate", payload, ct);

        // 5. POST to annotation service — fire and forget
        var homePct = await _repo.GetPreviousHomePctAsync(fixtureId);
        var prevHomePct2 = prevState?.HomePct ?? 0m;
        var annotationDelta = Math.Abs(homePct - prevHomePct2);
        var annotationContext = new MatchContextPayload
        {
            IsComeback   = matchContext.isComeback,
            IsLateGoal   = matchContext.isLateGoal,
            IsEqualiser  = matchContext.isEqualiser,
            IsWinningGoal = matchContext.isWinningGoal,
            RedCardActive = matchContext.redCardActive,
        };
        _ = _annotation.SendScoreEventAsync(enriched, scoreBefore, annotationDelta, annotationContext);

        _logger.LogInformation("[BUS] ScoreUpdate published — {Home} {HS}-{AS} {Away} min={Min}",
            enriched.Fixture.HomeName, homeAfter, awayAfter, enriched.Fixture.AwayName, enriched.Score.Minute);
    }

    public async Task PublishOddsUpdateAsync(EnrichedOddsUpdate enriched, CancellationToken ct = default)
    {
        var fixtureId = enriched.Odds.FixtureId;
        var group = $"fixture:{fixtureId}";
        var (home, draw, away) = enriched.Odds.ToImpliedProbabilities();

        // 1. Read previous probability BEFORE writing (needed for probabilityDelta)
        var prevHomePct = await _repo.GetPreviousHomePctAsync(fixtureId);
        var delta = Math.Abs(home - prevHomePct);

        // 2. Write to Redis + Postgres
        _logger.LogInformation("[REDIS] Writing odds state — fixture={FixtureId}", fixtureId);
        await _repo.UpdateStateFromOddsAsync(enriched, home, draw, away);
        await _repo.AppendOddsSnapshotAsync(enriched, home, draw, away);
        _ = _pg.UpsertStateFromOddsAsync(fixtureId, home, draw, away);
        _ = _pg.AppendOddsSnapshotAsync(fixtureId, home, draw, away, enriched.Odds.Ts);

        var payload = new
        {
            fixtureId,
            homeName = enriched.Fixture.HomeName,
            awayName = enriched.Fixture.AwayName,
            homePct = home,
            drawPct = draw,
            awayPct = away,
            probabilityDelta = delta,
            timestamp = enriched.Odds.Ts,
        };

        // 3. Push to frontend via SignalR
        await _hub.Clients.Group(group).SendAsync("OddsUpdate", payload, ct);

        // Annotation service only handles score events — odds delta tracked via score handler

        _logger.LogInformation("[BUS] OddsUpdate published — {Home} {H}% draw {D}% {Away} {A}% Δ{Delta}",
            enriched.Fixture.HomeName, home, draw, enriched.Fixture.AwayName, away, delta);
    }

    // ── matchContext helpers ──────────────────────────────────────────────────

    private static bool IsComeback(int homeBefore, int awayBefore, int homeAfter, int awayAfter,
        string? scoringTeamId, int homeId)
    {
        var scoringTeamIsHome = scoringTeamId == homeId.ToString();
        if (scoringTeamIsHome)
            return homeBefore < awayBefore && homeAfter >= awayAfter;
        else
            return awayBefore < homeBefore && awayAfter >= homeAfter;
    }

    private static bool IsWinningGoal(int homeAfter, int awayAfter, string? scoringTeamId, int homeId)
    {
        var scoringTeamIsHome = scoringTeamId == homeId.ToString();
        return scoringTeamIsHome ? homeAfter > awayAfter : awayAfter > homeAfter;
    }
}
