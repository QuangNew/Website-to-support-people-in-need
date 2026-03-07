using ReliefConnect.Core.Entities;

namespace ReliefConnect.Core.Interfaces;

public interface IPingRepository : IRepository<Ping>
{
    Task<IEnumerable<Ping>> GetPingsInRadiusAsync(double lat, double lng, double radiusKm);
    Task<IEnumerable<Ping>> GetPingsByUserAsync(string userId);
    Task<Ping?> GetPingWithFlagAsync(int pingId);
    Task<IEnumerable<Ping>> GetUnconfirmedPingsInZonesAsync();
}
