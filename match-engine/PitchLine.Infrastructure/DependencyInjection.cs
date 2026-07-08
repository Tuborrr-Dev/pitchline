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
        services.AddSingleton<IMatchStateRepository, MatchStateRepository>();

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

        services.AddHttpClient<TxLineSnapshotService>(c =>
        {
            c.BaseAddress = new Uri("https://txline.txodds.com");
            c.Timeout = TimeSpan.FromSeconds(10);
            c.DefaultRequestHeaders.Add("User-Agent", "Pitchline/1.0");
        });

        services.AddHttpClient<AnnotationWebhookClient>(c =>
        {
            c.BaseAddress = new Uri(configuration["Annotation:BaseUrl"] ?? "http://localhost:8000");
            c.Timeout = TimeSpan.FromSeconds(5);
        });

        services.AddHostedService<FixturePollingService>();

        services.AddSingleton<IMatchEventBus, SignalREventBus>();
        services.AddHostedService<TxLineStreamService>();

        return services;
    }
}
