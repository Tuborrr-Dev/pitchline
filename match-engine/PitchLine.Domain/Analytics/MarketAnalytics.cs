using System;
using System.Collections.Generic;
using System.Linq;

namespace PitchLine.Domain.Analytics;

/// <summary>
/// Pure math analytics computed from Redis odds history.
/// No external API calls. No dependencies. All inputs are probability snapshots.
/// </summary>
public static class MarketAnalytics
{
    // ── Momentum ─────────────────────────────────────────────────────────────
    // Linear regression slope over the last N snapshots.
    // Tells you not just WHERE probability is, but WHERE IT IS GOING.
    // Positive = team gaining ground. Negative = team losing ground.
    // Uses last 5 snapshots — recent enough to be meaningful, enough for a trend.

    public static MomentumResult CalculateMomentum(IList<decimal> homePctHistory, int lookback = 5)
    {
        if (homePctHistory.Count < 2)
            return new MomentumResult(0, MomentumDirection.Neutral);

        var window = homePctHistory.TakeLast(lookback).ToList();
        var slope = LinearRegressionSlope(window);

        var direction = slope switch
        {
            > 1.5m => MomentumDirection.StrongUp,
            > 0.3m => MomentumDirection.Up,
            < -1.5m => MomentumDirection.StrongDown,
            < -0.3m => MomentumDirection.Down,
            _ => MomentumDirection.Neutral
        };

        return new MomentumResult(Math.Round(slope, 2), direction);
    }

    // ── Volatility ────────────────────────────────────────────────────────────
    // Standard deviation of probability changes over last N snapshots.
    // High volatility = market is swinging wildly (red card, goal, VAR)
    // Low volatility  = match is settled, no major events
    // Uses last 10 snapshots for a wider window.

    public static VolatilityResult CalculateVolatility(IList<decimal> homePctHistory, int lookback = 10)
    {
        if (homePctHistory.Count < 2)
            return new VolatilityResult(0, VolatilityLevel.Low);

        var window = homePctHistory.TakeLast(lookback + 1).ToList();

        // Deltas between consecutive snapshots
        var deltas = window
            .Zip(window.Skip(1), (a, b) => Math.Abs(b - a))
            .ToList();

        var stdDev = StandardDeviation(deltas);

        var level = stdDev switch
        {
            > 4.0m => VolatilityLevel.Extreme,
            > 2.0m => VolatilityLevel.High,
            > 0.8m => VolatilityLevel.Medium,
            _ => VolatilityLevel.Low
        };

        return new VolatilityResult(Math.Round(stdDev, 2), level);
    }

    // ── Market Freeze Detection ───────────────────────────────────────────────
    // If no odds update has arrived in 60 seconds during a live match,
    // the bookmaker has suspended the market — almost always means VAR review.
    // Surface this BEFORE any official announcement.

    public static MarketFreezeResult DetectMarketFreeze(
        DateTimeOffset lastOddsTimestamp,
        string matchPhase,
        int freezeThresholdSeconds = 60)
    {
        var isLivePhase = matchPhase is "H1" or "H2" or "ET";
        if (!isLivePhase)
            return new MarketFreezeResult(false, 0);

        var secondsSinceUpdate = (DateTimeOffset.UtcNow - lastOddsTimestamp).TotalSeconds;
        var isFrozen = secondsSinceUpdate >= freezeThresholdSeconds;

        return new MarketFreezeResult(isFrozen, (int)secondsSinceUpdate);
    }

    // ── Peak Swing Tracker ────────────────────────────────────────────────────
    // Largest single probability movement in the match so far.
    // Updated on every odds tick. Stored in Redis state hash.
    // "⚡ PEAK MOVE: +18.9% — 23'"

    public static PeakSwingResult EvaluatePeakSwing(
        decimal currentDelta,
        string currentMinute,
        decimal existingPeakDelta,
        string existingPeakMinute)
    {
        return currentDelta > existingPeakDelta
            ? new PeakSwingResult(currentDelta, currentMinute, IsNewPeak: true)
            : new PeakSwingResult(existingPeakDelta, existingPeakMinute, IsNewPeak: false);
    }

    // ── Math primitives ───────────────────────────────────────────────────────

    /// <summary>
    /// OLS slope for a sequence of y-values (x = index).
    /// Positive = probability trending up. Negative = trending down.
    /// </summary>
    private static decimal LinearRegressionSlope(IList<decimal> values)
    {
        var n = values.Count;
        var xBar = (n - 1) / 2m;
        var yBar = values.Average();

        decimal numerator = 0;
        decimal denominator = 0;

        for (var i = 0; i < n; i++)
        {
            numerator += (i - xBar) * (values[i] - yBar);
            denominator += (i - xBar) * (i - xBar);
        }

        return denominator == 0 ? 0 : numerator / denominator;
    }

    /// <summary>Population standard deviation.</summary>
    private static decimal StandardDeviation(IList<decimal> values)
    {
        if (values.Count == 0) return 0;
        var mean = values.Average();
        var variance = values.Average(v => (v - mean) * (v - mean));
        return (decimal)Math.Sqrt((double)variance);
    }
}

// ── Result records ────────────────────────────────────────────────────────────

public record MomentumResult(decimal Slope, MomentumDirection Direction);
public record VolatilityResult(decimal StdDev, VolatilityLevel Level);
public record MarketFreezeResult(bool IsFrozen, int SecondsSinceUpdate);
public record PeakSwingResult(decimal Delta, string Minute, bool IsNewPeak);

// ── Enums ─────────────────────────────────────────────────────────────────────

public enum MomentumDirection { StrongUp, Up, Neutral, Down, StrongDown }
public enum VolatilityLevel { Low, Medium, High, Extreme }
