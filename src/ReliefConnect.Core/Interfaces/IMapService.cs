namespace ReliefConnect.Core.Interfaces;

/// <summary>
/// Service for map-related operations.
/// Routing handled client-side via OSRM (OpenStreetMap).
/// </summary>
public interface IMapService
{
    // Routing is now handled directly in the frontend using OSRM.
    // This interface is reserved for future server-side map operations
    // (e.g., geocoding, spatial analysis).
}
