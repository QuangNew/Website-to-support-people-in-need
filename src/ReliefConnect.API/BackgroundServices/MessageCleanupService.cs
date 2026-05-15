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
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    public MessageCleanupService(IServiceScopeFactory scopeFactory, ILogger<MessageCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(StartupDelay, stoppingToken);
        _logger.LogInformation("MessageCleanupService started — running every {Hours}h", Interval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CleanupOldMessages(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during message cleanup");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task CleanupOldMessages(CancellationToken ct)
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
            .ToListAsync(ct);

        if (affectedConvIds.Count == 0)
        {
            _logger.LogInformation("MessageCleanup: no messages older than 30 days");
            return;
        }

        // Delete old messages
        var deleted = await db.DirectMessages
            .Where(m => m.SentAt < threshold)
            .ExecuteDeleteAsync(ct);

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE "DirectConversations" AS c
            SET "LastMessageAt" = (
                SELECT MAX(m."SentAt")
                FROM "DirectMessages" AS m
                WHERE m."ConversationId" = c."Id"
                  AND m."DeletedAt" IS NULL
            )
            WHERE c."Id" = ANY({affectedConvIds.ToArray()});
            """, ct);

        // Log result
        db.SystemLogs.Add(new SystemLog
        {
            Action = "MessageCleanup",
            Details = $"Deleted {deleted} messages older than 30 days from {affectedConvIds.Count} conversations",
            UserName = "system",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(ct);

        _logger.LogInformation("MessageCleanup: deleted {Count} messages from {Conversations} conversations",
            deleted, affectedConvIds.Count);
    }
}
