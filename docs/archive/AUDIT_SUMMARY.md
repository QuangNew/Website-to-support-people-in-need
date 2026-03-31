# Empty Tables Audit Report
## Date: 2026-03-30

# SUMMARY TABLE

| Entity | Controller | Repository | DB Config | Frontend API | Rows | Status |
|--------|:----------:|:----------:|:--------:|:-----:|:---:|:------:|
| PingFlag | NO | YES | YES | NO | 0 | PARTIAL |
| Zones | YES | NO | YES | YES | 0 | IMPLEMENTED |
| SupplyItems | YES | NO | YES | YES | 0 | IMPLEMENTED |
| Notifications | NO | NO | YES | NO | 0 | INCOMPLETE |
| HelpOffers | NO | NO | NO | NO | - | MISSING |
| Reports | NO | NO | NO | NO | - | MISSING |
| SystemAnnouncements | NO | NO | NO | NO | - | MISSING |

# DETAIL BY ENTITY

## 1. ZONES - IMPLEMENTED

Controller: src/ReliefConnect.API/Controllers/ZoneController.cs
- 5 endpoints: GET, POST, GET by ID, PUT, DELETE
- All CRUD operations complete
- Admin authorization enforced

Frontend: client/src/services/api.ts
- mapApi.getZones()
- mapApi.createZone()

Database: DbSet<Zone> in AppDbContext
- 0 rows (no seed data)
- ISSUE: Map features depend on zones but none exist

## 2. SUPPLYITEMS - IMPLEMENTED

Controller: src/ReliefConnect.API/Controllers/SupplyController.cs
- 5 endpoints: GET, POST, GET by ID, PUT, DELETE
- Full CRUD with authorization

Frontend: client/src/services/api.ts
- supplyApi with 5 methods (get, getById, create, update, delete)

Database: DbSet<SupplyItem> in AppDbContext
- 0 rows (never created by users)
- ISSUE: No UI pages to create supplies

## 3. PINGFLAG - PARTIAL

Entity: src/ReliefConnect.Core/Entities/PingFlag.cs
- Fields: IsBlinking, UnconfirmedTimeMinutes, LastCheckedAt
- Purpose: Track emergency alert status for unconfirmed pings

Repository: src/ReliefConnect.Infrastructure/Repositories/PingRepository.cs
- All methods Include PingFlag
- GetPingWithFlagAsync(), GetUnconfirmedPingsInZonesAsync()

Missing:
- NO direct controller/API
- NO frontend API methods
- NO UI components

Database: DbSet<PingFlag> in AppDbContext
- 0 rows
- Relationship: 1-to-1 with Ping (cascade delete)

## 4. NOTIFICATIONS - INCOMPLETE

Entity: src/ReliefConnect.Core/Entities/Notification.cs
- Fields: Id, MessageText, IsRead, CreatedAt, UserId

Database: DbSet<Notification> in AppDbContext
- 0 rows
- Index: (UserId, IsRead)
- Only used by: SponsorController.OfferHelp() to CREATE notifications

CRITICAL ISSUE - WRITE ONLY:
- Notifications are CREATED when sponsor offers help
- But NO CONTROLLER to retrieve them
- Users CANNOT SEE notifications
- dev.md lists planned NotificationController but NOT IMPLEMENTED

Missing:
- NO NotificationController
- NO NotificationRepository
- NO Frontend API methods
- NO Frontend UI (NotificationBell mentioned but not found)

## 5. HELPOFFERS - NOT CREATED

Status: Entity does not exist

dev.md mentions planned fields:
- SponsorId, TargetUserId, PingId, PostId, Message, Status, CreatedAt

Current workaround:
- SponsorController.OfferHelp() uses Notification instead
- Line 87-92 creates Notification record

Missing:
- Entity class not created
- No DbSet
- No enum HelpOfferStatus
- No controller
- No repository
- No migration
- No frontend API
- No UI

## 6. REPORTS - NOT CREATED

Status: Entity does not exist
Grep results: ZERO matches in codebase
Mentions: NONE (not even planned)
Purpose: Unknown - likely for abuse reporting

## 7. SYSTEMAN NOUNCEMENTS - NOT CREATED

Status: Migration exists but entity missing (INCONSISTENT)

Migration: 20260329154533_AddSystemAnnouncementAdminIdIndex
- Listed as PENDING in dev.md

dev.md planned fields:
- Title, Content, AdminId, CreatedAt, ExpiresAt

Missing:
- Entity class not created
- No DbSet
- No controller
- No repository
- No frontend API
- No UI

ISSUE: Migration created but entity never implemented

# KEY FINDINGS

WORKING:
- Zones & SupplyItems: Full API implemented
- API endpoints match frontend services
- Database tables configured

BROKEN:
- Notifications: Created but never retrieved
- HelpOffers: Using wrong entity as workaround
- SystemAnnouncements: Migration without entity
- Reports: Not implemented

EMPTY DATABASES:
- All 7 tables have 0 rows
- Zones/Supplies need seed data
- Notifications need retrieval endpoints
- Others need implementation

FRONTEND GAPS:
- NO UI components for any feature
- NotificationBell mentioned but not found
- No notification center page
- No zone/supply management UI

