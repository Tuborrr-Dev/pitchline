using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace Pitchline.Infrastructure.Redis;

public static class RedisSetup
{
    public static IServiceCollection AddRedis(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is not configured.");

        // IConnectionMultiplexer is expensive to create — always singleton
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var options = ConfigurationOptions.Parse(connectionString);

            // Upstash requires SSL
            options.Ssl = true;
            options.AbortOnConnectFail = false; // don't crash on startup if Redis is momentarily unavailable

            return ConnectionMultiplexer.Connect(options);
        });

        services.AddSingleton<MatchStateRepository>();

        return services;
    }
}
