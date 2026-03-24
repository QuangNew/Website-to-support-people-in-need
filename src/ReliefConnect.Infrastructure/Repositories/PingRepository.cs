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
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<IEnumerable<Ping>> GetAllAsync(int? limit = null)
    {
        var query = _context.Pings
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .AsSplitQuery()
            .OrderByDescending(p => p.CreatedAt);

        if (limit.HasValue)
            return await query.Take(limit.Value).ToListAsync();

        return await query.ToListAsync();
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
        await _context.Pings.Where(p => p.Id == id).ExecuteDeleteAsync();
    }

    /// <summary>
    /// Get pings within a radius using PostGIS ST_DWithin for optimal spatial queries.
    /// </summary>
    public async Task<IEnumerable<Ping>> GetPingsInRadiusAsync(double lat, double lng, double radiusKm)
    {
        var radiusMeters = radiusKm * 1000;

        return await _context.Pings
            .FromSqlRaw(@"
                SELECT p.* FROM ""Pings"" p
                WHERE ST_DWithin(
                    ST_MakePoint(p.""CoordinatesLong"", p.""CoordinatesLat"")::geography,
                    ST_MakePoint({0}, {1})::geography,
                    {2}
                )
                ORDER BY p.""CreatedAt"" DESC",
                lng, lat, radiusMeters)
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .AsSplitQuery()
            .ToListAsync();
    }

    public async Task<IEnumerable<Ping>> GetPingsByUserAsync(string userId)
    {
        return await _context.Pings
            .AsNoTracking()
            .Include(p => p.PingFlag)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<Ping?> GetPingWithFlagAsync(int pingId)
    {
        return await _context.Pings
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == pingId);
    }

    /// <summary>
    /// Get a tracked ping with PingFlag for update operations.
    /// Does NOT use AsNoTracking so EF tracks changes automatically.
    /// </summary>
    public async Task<Ping?> GetPingWithFlagForUpdateAsync(int pingId)
    {
        return await _context.Pings
            .Include(p => p.User)
            .Include(p => p.PingFlag)
            .AsSplitQuery()
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
            .AsNoTracking()
            .Include(p => p.PingFlag)
            .Where(p => p.Type == MapItemType.SOS
                     && p.Status != SOSStatus.VerifiedSafe
                     && p.Status != SOSStatus.Resolved)
            .OrderBy(p => p.CreatedAt)
            .ToListAsync();
    }
}
