using Microsoft.EntityFrameworkCore;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.BackgroundServices;

/// <summary>
/// Periodically cleans up expired soft-deleted content:
/// - Posts: hard-delete after 7 days of soft-deletion.
/// - Comments: hard-delete after 30 days of being hidden.
/// Runs every 6 hours.
/// </summary>
public class SoftDeleteCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SoftDeleteCleanupService> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    public SoftDeleteCleanupService(IServiceScopeFactory scopeFactory, ILogger<SoftDeleteCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Rule 2.2: Wait for EF Core + Hangfire to finish startup initialization
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        _logger.LogInformation("SoftDeleteCleanupService started — checking every {Interval} hours", CheckInterval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupExpiredContent(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during soft-delete cleanup");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task CleanupExpiredContent(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;

        // Hard-delete posts soft-deleted more than 7 days ago
        var postCutoff = now.AddDays(-7);
        var deletedPosts = await db.Posts
            .Where(p => p.IsDeleted && p.DeletedAt != null && p.DeletedAt < postCutoff)
            .ExecuteDeleteAsync(CancellationToken.None);

        if (deletedPosts > 0)
            _logger.LogInformation("Permanently deleted {Count} expired soft-deleted posts", deletedPosts);

        // Hard-delete comments hidden more than 30 days ago
        var commentCutoff = now.AddDays(-30);
        var deletedComments = await db.Comments
            .Where(c => c.IsHidden && c.HiddenAt != null && c.HiddenAt < commentCutoff)
            .ExecuteDeleteAsync(CancellationToken.None);

        if (deletedComments > 0)
            _logger.LogInformation("Permanently deleted {Count} expired hidden comments", deletedComments);
    }
}
