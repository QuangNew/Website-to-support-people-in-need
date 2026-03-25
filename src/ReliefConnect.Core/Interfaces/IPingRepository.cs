using ReliefConnect.Core.Entities;

namespace ReliefConnect.Core.Interfaces;

public interface IPingRepository : IRepository<Ping>
{
    Task<IEnumerable<Ping>> GetPingsInRadiusAsync(double lat, double lng, double radiusKm, int limit = 500);
    Task<IEnumerable<Ping>> GetPingsByUserAsync(string userId);
    Task<Ping?> GetPingWithFlagAsync(int pingId);
    /// <summary>
    /// Get a tracked ping with PingFlag for update operations (no AsNoTracking).
    /// </summary>
    Task<Ping?> GetPingWithFlagForUpdateAsync(int pingId);
    Task<IEnumerable<Ping>> GetUnconfirmedPingsInZonesAsync();
}
