using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Pitchline.Api.Hubs;
using Pitchline.Infrastructure.Hubs;
using Pitchline.Infrastructure.Postgres;
using Pitchline.Infrastructure.Redis;
using PitchLine.Domain.Analytics;

namespace Pitchline.Infrastructure.TxLine;

public class SignalREventBus(
    IHubContext<MatchHub> hub,
    MatchStateRepository repo,
    PostgresRepository pg,
    AnnotationWebhookClient annotation,
    ILogger<SignalREventBus> logger,
    IConfiguration config) : IMatchEventBus
{
    private readonly IHubContext<MatchHub> _hub = hub;
    private readonly MatchStateRepository _repo = repo;
    private readonly PostgresRepository _pg = pg;
    private readonly AnnotationWebhookClient _annotation = annotation;
    private readonly ILogger<SignalREventBus> _logger = logger;
    private readonly IConfiguration _config = config;

    public async Task PublishScoreUpdateAsync(EnrichedScoreUpdate enriched, CancellationToken ct = default)
    {
        var fixtureId = enriched.Score.FixtureId;
        var group = $"fixture:{fixtureId}";

        var enforceKickoff = _config.GetValue("TxLine:EnforceKickoffCheck", true);
        if (enforceKickoff && DateTimeOffset.UtcNow < enriched.Fixture.KickOff)
        {
            _logger.LogInformation("[BUS] Dropping ScoreUpdate for fixture {FixtureId}: kickoff time {KickOff} not reached yet (now: {Now})",
                fixtureId, enriched.Fixture.KickOff, DateTimeOffset.UtcNow);
            return;
        }

        // 1. Read previous state BEFORE writing from PostgreSQL
        var scoreBefore = await _pg.GetScoreBeforeAsync(fixtureId, ct);
        var prevState = await _pg.GetStateAsync(fixtureId, ct);



        // 2. Write to Postgres FIRST (awaited)
        _logger.LogInformation("[POSTGRES] Writing score state — fixture={FixtureId}", fixtureId);
        await _pg.UpsertStateFromScoreAsync(enriched);
        if (IsGoal(enriched.Score.Action))
        {
            await _pg.AppendScoreEventAsync(enriched);
        }

        // 3. Write to Redis Cache SECOND (awaited)
        _logger.LogInformation("[REDIS] Writing score state — fixture={FixtureId}", fixtureId);
        await _repo.UpdateStateFromScoreAsync(enriched);
        if (IsGoal(enriched.Score.Action))
        {
            await _repo.AppendScoreEventAsync(enriched);
        }

        // 3. Build matchContext booleans
        var homeAfter = enriched.HomeScore;
        var awayAfter = enriched.AwayScore;
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

        // 4. Push to frontend via SignalR (fixture group, lobby group, & all connected clients)
        await _hub.Clients.Group(group).SendAsync("ScoreUpdate", payload, ct);
        await _hub.Clients.Group("lobby").SendAsync("ScoreUpdate", payload, ct);
        await _hub.Clients.All.SendAsync("ScoreUpdate", payload, ct);

        // 5. Emit MatchNotification if this is a Goal event
        if (IsGoal(enriched.Score.Action))
        {
            var goalTag = matchContext.isComeback ? "🔥 COMEBACK!" : matchContext.isEqualiser ? "⚖️ EQUALISER!" : matchContext.isWinningGoal ? "⚽ WINNING GOAL!" : "⚽ GOAL!";
            var notif = new MatchNotificationPayload(
                Guid.NewGuid().ToString("N"),
                fixtureId.ToString(),
                enriched.Fixture.HomeName,
                enriched.Fixture.AwayName,
                NotificationType.Goal,
                NotificationSeverity.Success,
                $"{goalTag} ({enriched.Score.Minute}')",
                $"{enriched.Fixture.HomeName} {homeAfter} - {awayAfter} {enriched.Fixture.AwayName}",
                enriched.Score.Minute,
                enriched.Score.Ts,
                matchContext
            );
            await _hub.Clients.Group(group).SendAsync("MatchNotification", notif, ct);
            await _hub.Clients.Group("lobby").SendAsync("MatchNotification", notif, ct);
            await _hub.Clients.All.SendAsync("MatchNotification", notif, ct);
        }
    }

    public async Task PublishOddsUpdateAsync(EnrichedOddsUpdate enriched, CancellationToken ct = default)
    {
        var fixtureId = enriched.Odds.FixtureId;
        var group = $"fixture:{fixtureId}";

        var enforceKickoff = _config.GetValue("TxLine:EnforceKickoffCheck", true);
        if (enforceKickoff && DateTimeOffset.UtcNow < enriched.Fixture.KickOff)
        {
            _logger.LogInformation("[BUS] Dropping OddsUpdate for fixture {FixtureId}: kickoff time {KickOff} not reached yet (now: {Now})",
                fixtureId, enriched.Fixture.KickOff, DateTimeOffset.UtcNow);
            return;
        }

        var (home, draw, away) = enriched.Odds.ToImpliedProbabilities();

        // 1. Read previous probability BEFORE writing from PostgreSQL
        var prevHomePct = await _pg.GetPreviousHomePctAsync(fixtureId, ct);
        var delta = Math.Abs(home - prevHomePct);

        // 2. Write to Postgres FIRST (awaited)
        _logger.LogInformation("[POSTGRES] Writing odds state — fixture={FixtureId}", fixtureId);
        await _pg.UpsertStateFromOddsAsync(fixtureId, home, draw, away);
        await _pg.AppendOddsSnapshotAsync(fixtureId, home, draw, away, enriched.Odds.Ts);

        // 3. Write to Redis Cache SECOND (awaited)
        _logger.LogInformation("[REDIS] Writing odds state — fixture={FixtureId}", fixtureId);
        await _repo.UpdateStateFromOddsAsync(enriched, home, draw, away);
        await _repo.AppendOddsSnapshotAsync(enriched, home, draw, away);

        // 4. Retrieve state and history for enrichment
        var state = await _repo.GetStateAsync(fixtureId);
        var phase = state?.Phase ?? "";
        var minute = state?.Minute ?? "0";

        var history = await _repo.GetRecentHomePctHistoryAsync(fixtureId, 11);
        var momentum = MarketAnalytics.CalculateMomentum(history);
        var volatility = MarketAnalytics.CalculateVolatility(history);

        // Convert timestamp from Unix milliseconds to DateTimeOffset for freeze detection
        var lastOddsTimestamp = DateTimeOffset.FromUnixTimeMilliseconds(enriched.Odds.Ts);
        var freeze = MarketAnalytics.DetectMarketFreeze(lastOddsTimestamp, phase);

        var (existingPeak, existingMinute) = await _repo.GetPeakSwingAsync(fixtureId);
        var peakResult = MarketAnalytics.EvaluatePeakSwing(delta, minute, existingPeak, existingMinute);

        if (peakResult.IsNewPeak)
        {
            await _repo.UpdatePeakSwingAsync(fixtureId, peakResult.Delta, minute);
        }

        var homeName = !string.IsNullOrWhiteSpace(enriched.Fixture.HomeName)
            ? enriched.Fixture.HomeName
            : (state?.HomeName ?? "");
        var awayName = !string.IsNullOrWhiteSpace(enriched.Fixture.AwayName)
            ? enriched.Fixture.AwayName
            : (state?.AwayName ?? "");

        var payload = new
        {
            fixtureId,
            homeName,
            awayName,
            homePct = home,
            drawPct = draw,
            awayPct = away,
            probabilityDelta = delta,
            timestamp = enriched.Odds.Ts,
            momentum = new { slope = momentum.Slope, direction = momentum.Direction.ToString() },
            volatility = new { stdDev = volatility.StdDev, level = volatility.Level.ToString() },
            marketFreeze = new { isFrozen = freeze.IsFrozen, secondsSinceUpdate = freeze.SecondsSinceUpdate },
            peakSwing = new { delta = peakResult.Delta, minute = peakResult.Minute, isNewPeak = peakResult.IsNewPeak }
        };

        // 5. Push to frontend via SignalR (fixture group, lobby group, & all connected clients)
        await _hub.Clients.Group(group).SendAsync("OddsUpdate", payload, ct);
        await _hub.Clients.Group("lobby").SendAsync("OddsUpdate", payload, ct);
        await _hub.Clients.All.SendAsync("OddsUpdate", payload, ct);

        // 6. Push real-time notifications for Peak Swing, Volatility, and Market Freeze
        if (peakResult.IsNewPeak || delta >= 10.0m)
        {
            var notif = new MatchNotificationPayload(
                Guid.NewGuid().ToString("N"),
                fixtureId.ToString(),
                homeName,
                awayName,
                NotificationType.PeakSwing,
                NotificationSeverity.Info,
                $"⚡ PEAK SWING: +{delta:F1}% ({minute}')",
                $"Major probability shift of {delta:F1}% in {homeName} vs {awayName}",
                minute,
                enriched.Odds.Ts,
                new { delta, minute, isNewPeak = peakResult.IsNewPeak }
            );
            await _hub.Clients.Group(group).SendAsync("MatchNotification", notif, ct);
            await _hub.Clients.Group("lobby").SendAsync("MatchNotification", notif, ct);
        }

        if (volatility.Level is VolatilityLevel.High or VolatilityLevel.Extreme)
        {
            var notif = new MatchNotificationPayload(
                Guid.NewGuid().ToString("N"),
                fixtureId.ToString(),
                homeName,
                awayName,
                NotificationType.VolatilitySpike,
                NotificationSeverity.Warning,
                $"📊 HIGH VOLATILITY ({volatility.Level.ToString().ToUpper()})",
                $"Volatility StdDev spike of {volatility.StdDev:F2} in {homeName} vs {awayName}",
                minute,
                enriched.Odds.Ts,
                new { stdDev = volatility.StdDev, level = volatility.Level.ToString() }
            );
            await _hub.Clients.Group(group).SendAsync("MatchNotification", notif, ct);
            await _hub.Clients.Group("lobby").SendAsync("MatchNotification", notif, ct);
        }

        if (freeze.IsFrozen)
        {
            var notif = new MatchNotificationPayload(
                Guid.NewGuid().ToString("N"),
                fixtureId.ToString(),
                homeName,
                awayName,
                NotificationType.MarketFreeze,
                NotificationSeverity.Critical,
                $"⏸️ MARKET SUSPENDED ({freeze.SecondsSinceUpdate}s)",
                $"Market suspended for {homeName} vs {awayName} (VAR / Key decision)",
                minute,
                enriched.Odds.Ts,
                new { secondsSinceUpdate = freeze.SecondsSinceUpdate }
            );
            await _hub.Clients.Group(group).SendAsync("MatchNotification", notif, ct);
            await _hub.Clients.Group("lobby").SendAsync("MatchNotification", notif, ct);
        }

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
    private static readonly HashSet<string> GoalActions = ["goal", "ownGoal"];
    private static bool IsGoal(string? action) => action is not null && GoalActions.Contains(action);

    private static readonly HashSet<string> AnnotatableActions =
        ["goal", "ownGoal", "redCard", "yellowRedCard", "penaltyAwarded", "freeKick"];

    private static bool IsAnnotatable(string? action)
        => action is not null && AnnotatableActions.Contains(action);
}
