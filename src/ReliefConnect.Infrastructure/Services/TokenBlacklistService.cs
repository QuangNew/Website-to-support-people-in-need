using System.Collections.Concurrent;
using ReliefConnect.Core.Interfaces;

namespace ReliefConnect.Infrastructure.Services;

public class TokenBlacklistService : ITokenBlacklistService
{
    private readonly ConcurrentDictionary<string, DateTime> _blacklist = new();

    public void BlacklistToken(string jti, DateTime expiry)
    {
        _blacklist[jti] = expiry;
        CleanupExpired();
    }

    public bool IsBlacklisted(string jti) => _blacklist.ContainsKey(jti);

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var kvp in _blacklist.Where(x => x.Value < now))
            _blacklist.TryRemove(kvp.Key, out _);
    }
}
