using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.BackgroundServices;

/// <summary>
/// Background service that deletes direct messages older than 30 days.
/// Runs daily at 3:00 AM UTC.
/// </summary>
public class MessageCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MessageCleanupService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    public MessageCleanupService(IServiceScopeFactory scopeFactory, ILogger<MessageCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait for startup
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        _logger.LogInformation("MessageCleanupService started — running every {Hours}h", Interval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupOldMessages();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during message cleanup");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CleanupOldMessages()
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var threshold = DateTime.UtcNow.AddDays(-30);

        // Get affected conversation IDs before deleting
        var affectedConvIds = await db.DirectMessages
            .AsNoTracking()
            .Where(m => m.SentAt < threshold)
            .Select(m => m.ConversationId)
            .Distinct()
            .ToListAsync();

        if (affectedConvIds.Count == 0)
        {
            _logger.LogInformation("MessageCleanup: no messages older than 30 days");
            return;
        }

        // Delete old messages
        var deleted = await db.DirectMessages
            .Where(m => m.SentAt < threshold)
            .ExecuteDeleteAsync();

        // Update LastMessageAt for affected conversations
        foreach (var convId in affectedConvIds)
        {
            var latestSentAt = await db.DirectMessages
                .AsNoTracking()
                .Where(m => m.ConversationId == convId && m.DeletedAt == null)
                .OrderByDescending(m => m.SentAt)
                .Select(m => (DateTime?)m.SentAt)
                .FirstOrDefaultAsync();

            await db.DirectConversations
                .Where(c => c.Id == convId)
                .ExecuteUpdateAsync(c => c.SetProperty(x => x.LastMessageAt, latestSentAt));
        }

        // Log result
        db.SystemLogs.Add(new SystemLog
        {
            Action = "MessageCleanup",
            Details = $"Deleted {deleted} messages older than 30 days from {affectedConvIds.Count} conversations",
            UserName = "system",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        _logger.LogInformation("MessageCleanup: deleted {Count} messages from {Conversations} conversations",
            deleted, affectedConvIds.Count);
    }
}
