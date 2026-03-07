using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Enums;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Repositories;

/// <summary>
/// Repository for Ping entities with spatial query support.
/// Uses coordinate-based distance calculation (Haversine approximation via EF).
/// </summary>
public class PingRepository : IPingRepository
{
    private readonly AppDbContext _context;

    public PingRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Ping?> GetByIdAsync(int id)
    {
        return await _context.Pings
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<IEnumerable<Ping>> GetAllAsync()
    {
        return await _context.Pings
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<Ping> AddAsync(Ping entity)
    {
        _context.Pings.Add(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public async Task UpdateAsync(Ping entity)
    {
        _context.Pings.Update(entity);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var ping = await _context.Pings.FindAsync(id);
        if (ping != null)
        {
            _context.Pings.Remove(ping);
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Get pings within a radius using Haversine distance approximation.
    /// For production, use PostGIS ST_DWithin. This uses a bounding box + refinement approach.
    /// </summary>
    public async Task<IEnumerable<Ping>> GetPingsInRadiusAsync(double lat, double lng, double radiusKm)
    {
        // Approximate bounding box (1 degree lat ≈ 111km)
        var latDelta = radiusKm / 111.0;
        var lngDelta = radiusKm / (111.0 * Math.Cos(lat * Math.PI / 180.0));

        var minLat = lat - latDelta;
        var maxLat = lat + latDelta;
        var minLng = lng - lngDelta;
        var maxLng = lng + lngDelta;

        // Bounding box filter (uses the spatial index)
        var candidates = await _context.Pings
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .Where(p => p.CoordinatesLat >= minLat && p.CoordinatesLat <= maxLat
                     && p.CoordinatesLong >= minLng && p.CoordinatesLong <= maxLng)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        // Refine with Haversine in-memory
        return candidates.Where(p => HaversineKm(lat, lng, p.CoordinatesLat, p.CoordinatesLong) <= radiusKm);
    }

    public async Task<IEnumerable<Ping>> GetPingsByUserAsync(string userId)
    {
        return await _context.Pings
            .Include(p => p.PingFlag)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<Ping?> GetPingWithFlagAsync(int pingId)
    {
        return await _context.Pings
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .FirstOrDefaultAsync(p => p.Id == pingId);
    }

    /// <summary>
    /// Get pings that are NOT VerifiedSafe and are inside any Zone
    /// (used by SOSMonitorService to detect unconfirmed emergencies).
    /// Simple approach: checks all non-resolved SOS pings.
    /// Zone containment should use PostGIS ST_Contains in production.
    /// </summary>
    public async Task<IEnumerable<Ping>> GetUnconfirmedPingsInZonesAsync()
    {
        return await _context.Pings
            .Include(p => p.PingFlag)
            .Where(p => p.Type == MapItemType.SOS
                     && p.Status != SOSStatus.VerifiedSafe
                     && p.Status != SOSStatus.Resolved)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync();
    }

    // ─── Haversine formula ───
    private static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371.0; // Earth radius in km
        var dLat = ToRad(lat2 - lat1);
        var dLng = ToRad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
              * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRad(double degrees) => degrees * Math.PI / 180.0;
}
