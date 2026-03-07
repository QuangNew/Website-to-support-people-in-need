using ReliefConnect.Core.Enums;

namespace ReliefConnect.Core.Entities;

/// <summary>
/// Map item (called "Ping" in class diagram).
/// Represents SOS requests, supply points, or shelters on the relief map.
/// Requires PostGIS Point for spatial indexing (REQ-MAP-01/02).
/// </summary>
public class Ping
{
    public int Id { get; set; }

    /// <summary>Latitude coordinate</summary>
    public double CoordinatesLat { get; set; }

    /// <summary>Longitude coordinate</summary>
    public double CoordinatesLong { get; set; }

    public MapItemType Type { get; set; }

    public SOSStatus Status { get; set; } = SOSStatus.Pending;

    /// <summary>Priority level 1-5 (computed by PriorityAnalyzer)</summary>
    public int PriorityLevel { get; set; } = 1;

    /// <summary>User-provided details about the situation</summary>
    public string? Details { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Foreign keys
    public string UserId { get; set; } = string.Empty;
    public ApplicationUser User { get; set; } = null!;

    // Navigation
    public PingFlag? PingFlag { get; set; }
}
