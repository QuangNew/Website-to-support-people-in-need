# Entity Implementation Checklist

## 1. PingFlag - 🟡 PARTIAL (Infrastructure Ready, No API)

### ✅ What Exists
- [x] Entity class: `src/ReliefConnect.Core/Entities/PingFlag.cs`
- [x] DbSet: `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs:16`
- [x] Repository methods in PingRepository:
  - GetPingWithFlagAsync()
  - GetPingWithFlagForUpdateAsync()  
  - GetUnconfirmedPingsInZonesAsync()

### ❌ What's Missing
- [ ] PingFlagController
- [ ] NotificationBell component (mentioned in dev.md, not found)
- [ ] Frontend API methods in client/src/services/api.ts
- [ ] UI pages/components

### Database Status
- Table exists: YES
- Rows: 0
- Relationship: 1-to-1 with Ping (CASCADE delete)

---

## 2. Zones - 🟢 IMPLEMENTED (Full CRUD)

### ✅ What Exists
- [x] Entity class: `src/ReliefConnect.Core/Entities/Zone.cs`
- [x] DbSet: `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs:17`
- [x] Controller: `src/ReliefConnect.API/Controllers/ZoneController.cs` (135 lines)
  - GET /api/zone
  - GET /api/zone/{id}
  - POST /api/zone [Admin]
  - PUT /api/zone/{id} [Admin]
  - DELETE /api/zone/{id} [Admin]
- [x] Frontend API: `client/src/services/api.ts:98-102`
  - mapApi.getZones()
  - mapApi.createZone()

### ❌ What's Missing
- [ ] Zone management UI page
- [ ] Seed data (database is empty)
- [ ] Repository class (using direct context)

### Database Status
- Table exists: YES
- Rows: 0 ⚠️ (CRITICAL - map features depend on this)
- Indexes: RiskLevel

---

## 3. SupplyItems - 🟢 IMPLEMENTED (Full CRUD)

### ✅ What Exists
- [x] Entity class: `src/ReliefConnect.Core/Entities/SupplyItem.cs`
- [x] DbSet: `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs:18`
- [x] Controller: `src/ReliefConnect.API/Controllers/SupplyController.cs` (133 lines)
  - GET /api/supply
  - GET /api/supply/{id}
  - POST /api/supply [RequireVerified]
  - PUT /api/supply/{id} [RequireVerified]
  - DELETE /api/supply/{id} [Admin]
- [x] Frontend API: `client/src/services/api.ts:114-129`
  - supplyApi.getSupplies()
  - supplyApi.getSupplyById(id)
  - supplyApi.createSupply(data)
  - supplyApi.updateSupply(id, data)
  - supplyApi.deleteSupply(id)

### ❌ What's Missing
- [ ] Supply management UI page
- [ ] Repository class (using direct context)

### Database Status
- Table exists: YES
- Rows: 0 (never created by users)
- Indexes: (CoordinatesLat, CoordinatesLong)

---

## 4. Notifications - 🔴 INCOMPLETE (Write-Only)

### ✅ What Exists
- [x] Entity class: `src/ReliefConnect.Core/Entities/Notification.cs`
- [x] DbSet: `src/ReliefConnect.Infrastructure/Data/AppDbContext.cs:25`
- [x] Partial usage in `src/ReliefConnect.API/Controllers/SponsorController.cs:87`
  - Only creates notifications, doesn't retrieve

### ❌ What's Missing
- [ ] NotificationController
- [ ] NotificationRepository
- [ ] Frontend API methods (NO notification methods in api.ts)
- [ ] NotificationBell component (mentioned in dev.md, NOT FOUND)
- [ ] Notification center page
- [ ] NotificationService with caching

### Database Status
- Table exists: YES
- Rows: 0
- Indexes: (UserId, IsRead)
- CRITICAL ISSUE: Notifications are created but users cannot retrieve them!

### Planned Endpoints (from dev.md, NOT IMPLEMENTED)
```csharp
GET    /api/notifications
GET    /api/notifications/unread-count      // 30s cache
PUT    /api/notifications/{id}/read
PUT    /api/notifications/read-all
DELETE /api/notifications/{id}
```

---

## 5. HelpOffers - 🔴 NOT CREATED (Using Wrong Entity)

### ❌ What Exists
- [ ] Entity class: DOES NOT EXIST
- [ ] DbSet: NOT IN AppDbContext
- [ ] Controller: DOES NOT EXIST
- [ ] Repository: DOES NOT EXIST

### Current Workaround
- SponsorController.OfferHelp() creates Notification instead (line 87-92)
- Uses wrong entity type

### ✅ Planned in dev.md
- Fields: SponsorId, TargetUserId, PingId?, PostId?, Message, Status, CreatedAt
- HelpOfferStatus enum needed

### Files to Create
- src/ReliefConnect.Core/Entities/HelpOffer.cs
- src/ReliefConnect.Core/Enums/HelpOfferStatus.cs
- src/ReliefConnect.API/Controllers/HelpOfferController.cs
- src/ReliefConnect.Infrastructure/Repositories/HelpOfferRepository.cs
- Migration file

### Database Status
- Table: DOES NOT EXIST
- Rows: N/A

---

## 6. Reports - 🔴 NOT CREATED (Not Even Planned)

### ❌ What Exists
- [ ] Entity class: DOES NOT EXIST
- [ ] DbSet: NOT IN AppDbContext
- [ ] Any code references: ZERO

### Status
- Not mentioned in dev.md
- Not mentioned in todo.md
- Not implemented anywhere
- Purpose: Unknown (likely abuse reporting)

### Database Status
- Table: DOES NOT EXIST
- Rows: N/A

---

## 7. SystemAnnouncements - 🔴 INCONSISTENT (Migration Only)

### ✅ Partially Exists
- [x] Migration: `20260329154533_AddSystemAnnouncementAdminIdIndex` (PENDING)
- [x] Mentioned in dev.md

### ❌ What's Missing
- [ ] Entity class: DOES NOT EXIST
- [ ] DbSet: NOT IN AppDbContext
- [ ] Controller: DOES NOT EXIST
- [ ] Repository: DOES NOT EXIST
- [ ] Migration is incomplete/conflicted

### Planned Fields (from dev.md)
- Title, Content, AdminId, CreatedAt, ExpiresAt?

### Files to Create
- src/ReliefConnect.Core/Entities/SystemAnnouncement.cs
- src/ReliefConnect.API/Controllers/SystemAnnouncementController.cs
- Fix/complete migration

### Database Status
- Table: DOES NOT EXIST (migration created but entity missing)
- Rows: N/A
- INCONSISTENCY: Migration exists but no entity to use it!

---

## Summary Table

| Feature | Controller | Repository | Entity | DbSet | Frontend API | Rows | Priority |
|---------|:----------:|:----------:|:------:|:-----:|:------------:|:----:|:--------:|
| PingFlag | ❌ | ✅ | ✅ | ✅ | ❌ | 0 | Medium |
| Zones | ✅ | ❌ | ✅ | ✅ | ✅ | 0 | Seed Data |
| SupplyItems | ✅ | ❌ | ✅ | ✅ | ✅ | 0 | UI |
| Notifications | ❌ | ❌ | ✅ | ✅ | ❌ | 0 | **CRITICAL** |
| HelpOffers | ❌ | ❌ | ❌ | ❌ | ❌ | — | **HIGH** |
| Reports | ❌ | ❌ | ❌ | ❌ | ❌ | — | Medium |
| SystemAnnouncements | ❌ | ❌ | ❌ | ❌ | ❌ | — | High |

---

## Implementation Priority

### 🔴 CRITICAL - Blocking Use Cases
1. **NotificationController** - Users can't see notifications they received
2. **HelpOffer Entity + Controller** - Currently broken pattern, using wrong entity
3. **Seed Zone Data** - Map features completely blocked

### 🟠 HIGH - Important Features
4. **SystemAnnouncementController** - Migration created but no entity
5. **PingFlag API** - Emergency tracking not exposed to users
6. **NotificationBell UI** - Users need notification indicator

### 🟡 MEDIUM - Polish
7. **Reports Entity** - Abuse/flagging system
8. **Frontend UI Pages** - For all features
9. **Real-time Updates** - SignalR integration

