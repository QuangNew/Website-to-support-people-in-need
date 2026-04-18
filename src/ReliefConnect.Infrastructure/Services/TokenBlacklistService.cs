using Microsoft.Extensions.Caching.Memory;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly AppDbContext _db;
    private readonly IMemoryCache _cache;
    private const string CachePrefix = "bl:";

    public TokenBlacklistService(AppDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    public void BlacklistToken(string jti, DateTime expiry)
    {
        var exists = _db.BlacklistedTokens.Any(t => t.Jti == jti);
        if (!exists)
        {
            _db.BlacklistedTokens.Add(new BlacklistedToken { Jti = jti, Expiry = expiry });
            _db.SaveChanges();
        }
        // Cache the blacklisted token until it expires
        _cache.Set(CachePrefix + jti, true, expiry.ToUniversalTime());
    }

    public bool IsBlacklisted(string jti)
    {
        // Check in-memory cache first to avoid DB round-trip
        if (_cache.TryGetValue(CachePrefix + jti, out bool cached))
            return cached;

        var found = _db.BlacklistedTokens.Any(t => t.Jti == jti);
        if (found)
        {
            // Cache positive results for 30 minutes (tokens are rarely un-blacklisted)
            _cache.Set(CachePrefix + jti, true, TimeSpan.FromMinutes(30));
        }
        else
        {
            // Cache negative results briefly to avoid repeated DB hits for valid tokens
            _cache.Set(CachePrefix + jti, false, TimeSpan.FromMinutes(2));
        }
        return found;
    }
}
