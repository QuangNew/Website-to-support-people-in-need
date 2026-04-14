using Microsoft.EntityFrameworkCore;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.BackgroundServices;

/// <summary>
/// Periodically cleans up expired blacklisted tokens from the database.
/// Runs every hour.
/// </summary>
public class TokenCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TokenCleanupService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    public TokenCleanupService(IServiceScopeFactory scopeFactory, ILogger<TokenCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Rule 2.2: Wait for EF Core + Hangfire to finish startup initialization
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;

                var deleted = await db.BlacklistedTokens
                    .Where(t => t.Expiry < now)
                    .ExecuteDeleteAsync(CancellationToken.None);

                if (deleted > 0)
                    _logger.LogInformation("Cleaned up {Count} expired blacklisted tokens", deleted);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up expired tokens");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }
}
