namespace ReliefConnect.Core.Entities;

/// <summary>
/// Priority zone defined by Admin for geofencing (REQ-MAP-04).
/// Boundary stored as PostGIS Geography polygon.
/// </summary>
public class Zone
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// GeoJSON string representing the zone boundary polygon.
    /// Will be converted to PostGIS Geography in EF configuration.
    /// </summary>
    public string BoundaryGeoJson { get; set; } = string.Empty;

    /// <summary>Risk level 1-5 (higher = more dangerous)</summary>
    public int RiskLevel { get; set; } = 1;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
