using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PitchLine.Application.Common.Interfaces;
using PitchLine.Infrastructure.Persistence;
using Pitchline.Infrastructure.Redis;
using Pitchline.Infrastructure.TxLine;
using StackExchange.Redis;

namespace PitchLine.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IApplicationDbContext>(provider =>
            provider.GetRequiredService<ApplicationDbContext>());

        // ── Redis ───────────────────────────────────────────────────────────────────
        var redisConn = configuration.GetConnectionString("Redis")
            ?? throw new InvalidOperationException("Redis connection string is not configured.");
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
        services.AddSingleton<MatchStateRepository>();

        // ── SignalR ──────────────────────────────────────────────────────────────────
        // Registered in Program.cs — AddSignalR() requires the ASP.NET Core web SDK

        // ── TxLINE SSE streams ─────────────────────────────────────────────────────
        // CRITICAL: Timeout = InfiniteTimeSpan — default 100s kills long-lived SSE connections
        services.AddHttpClient<SseClient>(c =>
        {
            c.BaseAddress = new Uri("https://txline.txodds.com");
            c.Timeout     = Timeout.InfiniteTimeSpan;
            c.DefaultRequestHeaders.Add("User-Agent", "Pitchline/1.0");
        });

        services.AddHttpClient<FixtureMetadataService>(c =>
        {
            c.BaseAddress = new Uri("https://txline.txodds.com");
            c.DefaultRequestHeaders.Add("User-Agent", "Pitchline/1.0");
        });

        services.AddHostedService<FixturePollingService>();

        // Swap ConsoleEventBus → SignalREventBus once AnnotationWebhookClient is built
        services.AddSingleton<IMatchEventBus, SignalREventBus>();
        services.AddSingleton<IMatchEventBus, ConsoleEventBus>();
        services.AddHostedService<TxLineStreamService>();

        return services;
    }
}
