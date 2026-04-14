using Microsoft.EntityFrameworkCore;
using ReliefConnect.Core.Entities;
using ReliefConnect.Core.Interfaces;
using ReliefConnect.Infrastructure.Data;

namespace ReliefConnect.Infrastructure.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly AppDbContext _db;

    public TokenBlacklistService(AppDbContext db)
    {
        _db = db;
    }

    public void BlacklistToken(string jti, DateTime expiry)
    {
        var exists = _db.BlacklistedTokens.Any(t => t.Jti == jti);
        if (!exists)
        {
            _db.BlacklistedTokens.Add(new BlacklistedToken { Jti = jti, Expiry = expiry });
            _db.SaveChanges();
        }
    }

    public bool IsBlacklisted(string jti)
    {
        return _db.BlacklistedTokens.Any(t => t.Jti == jti);
    }
}
