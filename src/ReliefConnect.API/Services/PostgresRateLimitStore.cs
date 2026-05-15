using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Services;

/// <summary>
/// Postgres-backed rate-limit counter store so abuse protection remains correct across multiple app instances.
/// </summary>
public class PostgresRateLimitStore : IRateLimitStore
{
    private static readonly SemaphoreSlim CleanupLock = new(1, 1);
    private static long _lastCleanupTicksUtc;

    private readonly AppDbContext _db;
    private readonly ILogger<PostgresRateLimitStore> _logger;

    public PostgresRateLimitStore(AppDbContext db, ILogger<PostgresRateLimitStore> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> CheckRateLimitAsync(string key, int maxAttempts, TimeSpan window, CancellationToken cancellationToken = default)
    {
        if (maxAttempts <= 0)
            return false;

        try
        {
            var now = DateTime.UtcNow;
            await TryCleanupExpiredAsync(now, cancellationToken);

            var currentCount = await UpsertAndGetCountAsync(key, now, window, cancellationToken);
            return currentCount <= maxAttempts;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Rate-limit store failed; allowing request to avoid blocking the critical path");
            return true;
        }
    }

    private async Task<int> UpsertAndGetCountAsync(string key, DateTime now, TimeSpan window, CancellationToken cancellationToken)
    {
        var connection = _db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            INSERT INTO "RateLimitCounters" ("Key", "Count", "WindowStartedAt", "ExpiresAt", "UpdatedAt")
            VALUES (@key, 1, @now, @expiresAt, @now)
            ON CONFLICT ("Key") DO UPDATE
            SET
                "Count" = CASE
                    WHEN @now - "RateLimitCounters"."WindowStartedAt" >= (@windowSeconds * interval '1 second') THEN 1
                    ELSE "RateLimitCounters"."Count" + 1
                END,
                "WindowStartedAt" = CASE
                    WHEN @now - "RateLimitCounters"."WindowStartedAt" >= (@windowSeconds * interval '1 second') THEN @now
                    ELSE "RateLimitCounters"."WindowStartedAt"
                END,
                "ExpiresAt" = CASE
                    WHEN @now - "RateLimitCounters"."WindowStartedAt" >= (@windowSeconds * interval '1 second') THEN @expiresAt
                    ELSE GREATEST("RateLimitCounters"."ExpiresAt", @expiresAt)
                END,
                "UpdatedAt" = @now
            RETURNING "Count";
            """;

        AddParameter(command, "key", key);
        AddParameter(command, "now", now);
        AddParameter(command, "expiresAt", now.Add(window));
        AddParameter(command, "windowSeconds", Math.Max(1, (int)Math.Ceiling(window.TotalSeconds)));

        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(scalar, CultureInfo.InvariantCulture);
    }

    private async Task TryCleanupExpiredAsync(DateTime now, CancellationToken cancellationToken)
    {
        var lastCleanupTicksUtc = Interlocked.Read(ref _lastCleanupTicksUtc);
        if (now.Ticks - lastCleanupTicksUtc < TimeSpan.FromMinutes(1).Ticks)
            return;

        if (!await CleanupLock.WaitAsync(0, cancellationToken))
            return;

        try
        {
            lastCleanupTicksUtc = Interlocked.Read(ref _lastCleanupTicksUtc);
            if (now.Ticks - lastCleanupTicksUtc < TimeSpan.FromMinutes(1).Ticks)
                return;

            await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"DELETE FROM ""RateLimitCounters"" WHERE ""ExpiresAt"" < {now}",
                cancellationToken);

            Interlocked.Exchange(ref _lastCleanupTicksUtc, now.Ticks);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to clean expired rate-limit counters");
        }
        finally
        {
            CleanupLock.Release();
        }
    }

    private static void AddParameter(IDbCommand command, string name, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }
}
