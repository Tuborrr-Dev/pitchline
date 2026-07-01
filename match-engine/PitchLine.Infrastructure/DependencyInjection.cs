using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PitchLine.Application.Common.Interfaces;
using PitchLine.Infrastructure.Persistence;
using Pitchline.Infrastructure.TxLine;

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

        // ── TxLINE SSE streams ─────────────────────────────────────────────────────
        // CRITICAL: Timeout = InfiniteTimeSpan — default 100s kills long-lived SSE connections
        services.AddHttpClient<SseClient>(c =>
        {
            c.BaseAddress = new Uri("https://txline.txodds.com");
            c.Timeout     = Timeout.InfiniteTimeSpan;
            c.DefaultRequestHeaders.Add("User-Agent", "Pitchline/1.0");
        });

        // Start with ConsoleEventBus — swap for RedisEventBus once stream shapes are confirmed
        services.AddSingleton<IMatchEventBus, ConsoleEventBus>();
        services.AddHostedService<TxLineStreamService>();

        return services;
    }
}
