namespace ReliefConnect.Core.Interfaces;

public interface ITokenBlacklistService
{
    void BlacklistToken(string jti, DateTime expiry);
    bool IsBlacklisted(string jti);
}
