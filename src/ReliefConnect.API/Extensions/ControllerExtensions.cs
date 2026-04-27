using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using ReliefConnect.Core.Entities;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.API.Extensions;

/// <summary>
/// Shared helpers for admin controllers — eliminates LogAction duplication.
/// </summary>
public static class ControllerExtensions
{
    /// <summary>
    /// Write an audit log entry to SystemLogs. Extracts admin identity from ClaimsPrincipal.
    /// </summary>
    public static async Task LogAdminAction(
        this ControllerBase controller,
        AppDbContext db,
        string action,
        string? details = null,
        Guid? batchId = null,
        int? parentLogId = null)
    {
        var adminId = controller.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var adminName = controller.User.FindFirstValue(ClaimTypes.Name);

        db.SystemLogs.Add(new SystemLog
        {
            Action = action,
            Details = details,
            UserId = adminId,
            UserName = adminName,
            CreatedAt = DateTime.UtcNow,
            BatchId = batchId,
            ParentLogId = parentLogId
        });

        await db.SaveChangesAsync();
    }

    public static async Task LogUserActivity(
        this ControllerBase controller,
        AppDbContext db,
        string action,
        string? details = null,
        string? userId = null,
        string? userName = null,
        Guid? batchId = null,
        int? parentLogId = null)
    {
        var actorId = userId ?? controller.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var actorName = userName
            ?? controller.User.FindFirstValue("FullName")
            ?? controller.User.FindFirstValue(ClaimTypes.Name);

        db.SystemLogs.Add(new SystemLog
        {
            Action = action,
            Details = details,
            UserId = actorId,
            UserName = actorName,
            CreatedAt = DateTime.UtcNow,
            BatchId = batchId,
            ParentLogId = parentLogId
        });

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Sanitize a cell value for CSV export to prevent Excel formula injection.
    /// Cells starting with =, +, -, @, tab, or carriage return are prefixed with a single quote.
    /// </summary>
    public static string CsvSafe(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        // Replace newlines with spaces for CSV compatibility
        var safe = value.Replace("\r\n", " ").Replace("\n", " ").Replace("\r", " ");

        // Prefix dangerous characters to prevent formula injection
        if (safe.Length > 0 && safe[0] is '=' or '+' or '-' or '@' or '\t')
            safe = "'" + safe;

        return safe;
    }
}
