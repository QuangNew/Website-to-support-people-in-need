# Security Fix Plan: vuln-0001, vuln-0004, Issue #7

**Date**: 2026-05-02  
**Risk**: HIGH (CVSS 7.1 + 8.3)  
**Status**: In progress

---

## vuln-0001 — Unauthorized SOS Status Mutation (CVSS 7.1)

### Root Cause
`PUT /api/map/pings/{id}/status` is protected by `RequireVolunteer` but has no:
- Assignment check (any volunteer can mutate any ping)
- Type check (non-SOS pings can be mutated)
- State-machine validation (arbitrary status transitions allowed)

### Fix Strategy
Change policy to `RequireAdmin` (admin-only). Rationale:
- No client code uses this endpoint for volunteer workflows; volunteers use `POST /api/volunteer/tasks/{taskId}/complete`
- Making it admin-only preserves the utility as a maintenance tool while eliminating the attack surface
- Simpler than adding assignment + state machine logic for a route with zero legitimate volunteer traffic

### Files Changed
- `src/ReliefConnect.API/Controllers/MapController.cs`: `UpdatePingStatus`
  - `[Authorize(Policy = "RequireVolunteer")]` → `[Authorize(Policy = "RequireAdmin")]`
  - Add `ping.Type != MapItemType.SOS` guard (400)

---

## vuln-0004 — Stale JWT Tokens Not Invalidated (CVSS 8.3)

### Root Cause A — JTI Never Persisted
`GenerateJwtToken` creates a new GUID jti claim but never stores it to `user.LastTokenJti`.
Admin actions (`BanUser`, `ForceLogout`) read `LastTokenJti` to blacklist — always null, so blacklist is never called.

### Root Cause B — OnTokenValidated Never Checks Live User State
`OnTokenValidated` is a synchronous callback that only checks the jti blacklist.
It never loads the user from DB to check `IsSuspended`, current `Role`, or whether the session was invalidated after a privilege change.

### Fix Strategy
Use ASP.NET Identity's `SecurityStamp` as the session version marker:

1. **`GenerateJwtToken`** — change return type to `(string Token, DateTime ExpiresAt, string Jti)`, expose jti
2. **Login call sites** (3 places) — persist `user.LastTokenJti = token.Jti` + save via `UpdateAsync`
3. **JWT claims** — embed `SecurityStamp` as a `"stamp"` claim in `GenerateJwtToken`
4. **`OnTokenValidated`** — make async, add UserManager lookup:
   - If user doesn't exist → fail
   - If `user.IsSuspended` → fail  
   - If `user.Role.ToString() != roleClaim` → fail (role changed)
   - If `user.SecurityStamp != stampClaim` → fail (stamp rotated)
5. **Admin actions** — call `UpdateSecurityStampAsync(user)` in `ApproveRole`, `SuspendUser`, `BanUser`, `ForceLogout`
   - This rotates the stamp, instantly invalidating ALL active tokens for that user on next request

### Files Changed
- `src/ReliefConnect.API/Controllers/AuthController.cs`
  - `GenerateJwtToken`: return type, add stamp claim, expose jti
  - 3 call sites (Register L96, Login L297, GoogleLogin L409): persist jti
- `src/ReliefConnect.API/Program.cs`
  - `OnTokenValidated`: async, user lookup, state checks
- `src/ReliefConnect.API/Controllers/AdminController.cs`
  - `ApproveRole`, `SuspendUser`, `BanUser`, `ForceLogout`: rotate security stamp

---

## Issue #7 — Stale Documentation (localStorage references)

### Root Cause
Docs were written when the code used localStorage for tokens. The code was later migrated to a 3-layer hybrid but docs were not updated.

### Current actual auth storage (3-layer hybrid)
1. **Primary**: JWT in `sessionStorage['rc_auth_token']` + in-memory `_inMemoryToken` → sent as `Authorization: Bearer` header
2. **Fallback**: HttpOnly cookie `auth_token` set by backend on login (same-origin fallback, ITP-safe)
3. **SignalR**: `accessTokenFactory` reads from in-memory (never query string)

### Files Changed
- `docs/knowledge-base/06-policies-and-security.md`
- `docs/knowledge-base/02-account-and-profile-guide.md`
- `docs/knowledge-base/09-limitations-roadmap-and-glossary.md`
- `docs/report/PROJECT_REPORT.md`

---

## Conflict Map

| Symbol | File | Agent |
|--------|------|-------|
| `UpdatePingStatus` | MapController.cs | A |
| `GenerateJwtToken` | AuthController.cs | A |
| `OnTokenValidated` | Program.cs | A |
| `ApproveRole` | AdminController.cs | A |
| `SuspendUser` | AdminController.cs | A |
| `BanUser` | AdminController.cs | A |
| `ForceLogout` | AdminController.cs | A |
| Docs (4 files) | knowledge-base/, report/ | B |

Agents A and B have zero file overlap — safe to run in parallel.
