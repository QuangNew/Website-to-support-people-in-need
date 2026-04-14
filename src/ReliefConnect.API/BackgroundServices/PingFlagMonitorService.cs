using Microsoft.EntityFrameworkCore;
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
        // Rule 2.2: Wait for EF Core + Hangfire to finish startup initialization
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
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
        if (ct.IsCancellationRequested) return;

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var threshold = now.Subtract(BlinkThreshold);

        // Use a single SQL upsert to avoid EF's batched INSERT ... RETURNING pattern,
        // which is the command shape that keeps failing through the Supabase pooler.
        var affected = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "PingFlags" ("PingId", "IsBlinking", "UnconfirmedTimeMinutes", "LastCheckedAt")
            SELECT p."Id",
                   TRUE,
                   GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ({now} - p."CreatedAt")) / 60))::integer,
                   {now}
            FROM "Pings" AS p
            WHERE p."Type" = {(int)MapItemType.SOS}
              AND p."Status" = {(int)SOSStatus.Pending}
              AND p."CreatedAt" <= {threshold}
            ON CONFLICT ("PingId") DO UPDATE
            SET "IsBlinking" = EXCLUDED."IsBlinking",
                "UnconfirmedTimeMinutes" = EXCLUDED."UnconfirmedTimeMinutes",
                "LastCheckedAt" = EXCLUDED."LastCheckedAt";
            """, CancellationToken.None);

        if (affected > 0)
        {
            _logger.LogInformation("PingFlagMonitor: Upserted {Count} ping flags", affected);
        }
    }
}
