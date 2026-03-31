using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.BackgroundServices;

/// <summary>
/// Checks every 5 minutes for SOS pings unconfirmed >15 min.
/// Sets PingFlag.IsBlinking = true and updates UnconfirmedTimeMinutes.
/// REQ-MAP-05: "SOS nhấp nháy khi user trong Vùng ưu tiên chưa xác nhận an toàn >15 phút"
/// </summary>
public class PingFlagMonitorService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PingFlagMonitorService> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan BlinkThreshold = TimeSpan.FromMinutes(15);

    public PingFlagMonitorService(IServiceScopeFactory scopeFactory, ILogger<PingFlagMonitorService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("PingFlagMonitorService started — checking every {Interval} min", CheckInterval.TotalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckUnconfirmedPings(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PingFlagMonitor error during check cycle");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task CheckUnconfirmedPings(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var threshold = DateTime.UtcNow.Subtract(BlinkThreshold);

        // Find SOS pings that are Pending, created >15 min ago
        var pingsToFlag = await db.Pings
            .Include(p => p.PingFlag)
            .Where(p => p.Type == MapItemType.SOS
                     && p.Status == SOSStatus.Pending
                     && p.CreatedAt <= threshold)
            .ToListAsync(ct);

        var updated = 0;
        foreach (var ping in pingsToFlag)
        {
            var minutesUnconfirmed = (int)(DateTime.UtcNow - ping.CreatedAt).TotalMinutes;

            if (ping.PingFlag == null)
            {
                // Create PingFlag if it doesn't exist
                ping.PingFlag = new PingFlag
                {
                    PingId = ping.Id,
                    IsBlinking = true,
                    UnconfirmedTimeMinutes = minutesUnconfirmed,
                    LastCheckedAt = DateTime.UtcNow
                };
                db.PingFlags.Add(ping.PingFlag);
                updated++;
            }
            else if (!ping.PingFlag.IsBlinking)
            {
                // Start blinking
                ping.PingFlag.IsBlinking = true;
                ping.PingFlag.UnconfirmedTimeMinutes = minutesUnconfirmed;
                ping.PingFlag.LastCheckedAt = DateTime.UtcNow;
                updated++;
            }
            else
            {
                // Already blinking — just update timer
                ping.PingFlag.UnconfirmedTimeMinutes = minutesUnconfirmed;
                ping.PingFlag.LastCheckedAt = DateTime.UtcNow;
            }
        }

        if (updated > 0)
        {
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("PingFlagMonitor: Set {Count} pings to blinking", updated);
        }
    }
}
