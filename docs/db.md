# ReliefConnect Database Schema

> Auto-generated from Supabase (PostgreSQL 17). Last updated: 2026-04-04.

---

## Core Application Tables

### `AspNetUsers` — Users & Identity
**Role:** Central user entity, extending ASP.NET Core Identity. All other entities reference it.

| Column | Type | Notes |
|--------|------|-------|
| Id | text | PK (IdentityUser) |
| FullName | varchar | Display name |
| Role | int4 | RoleEnum: Guest=0, PersonInNeed=1, Volunteer=2, Sponsor=3, Admin=4 |
| VerificationStatus | int4 | VerificationStatus enum: None=0, Pending=1, Verified=2, Rejected=3 |
| AvatarUrl | varchar | Profile picture URL |
| CreatedAt | timestamptz | Account creation time |
| Email / EmailConfirmed | varchar/bool | Login credential + email verification flag |
| EmailVerificationCode | text | 6-digit code for email verification |
| EmailVerificationCodeExpiry | timestamptz | Code expiry (15 min) |
| PasswordResetToken | text | 6-digit code for password reset |
| PasswordResetTokenExpiry | timestamptz | Reset code expiry |
| GoogleId | text | Google OAuth subject identifier |
| RequestedRole | text | Role requested in latest verification submission |
| VerificationReason | text | User-provided reason for verification |
| RequestedRoleExpiry | timestamptz | When the current role verification expires (nullable; ~1.5 years from approval) |
| IsSuspended | bool | Whether user is banned (default false) |
| SuspendedUntil | timestamptz | Suspension expiry; null = permanent ban |
| BanReason | text | Admin-provided reason for ban |
| LastTokenJti | text | JTI of the most recent JWT — used for force-logout |

**Relations:** One-to-many with Posts, Pings, Comments, Reactions, Notifications, Conversations, Messages, HelpOffers, Reports, SystemAnnouncements.

---

### `AspNetRoles`, `AspNetRoleClaims`, `AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserRoles`, `AspNetUserTokens` — ASP.NET Identity Infrastructure
**Role:** Standard ASP.NET Core Identity tables (not actively used — app uses custom RoleEnum on AspNetUsers instead of Identity's built-in role system). Kept for compatibility.

---

## Geospatial / Map Tables

### `Pings` — SOS Requests
**Role:** Represents a help request / SOS alert on the map. Core of the real-time rescue system.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| CoordinatesLat / CoordinatesLong | float8 | GPS coordinates |
| Type | int4 | PingType enum: SOS=0, Supply=1, Safe=2, Help=3 |
| Status | int4 | PingStatus: Pending=0, Active=1, Resolved=2, Cancelled=3 |
| PriorityLevel | int4 | Auto-computed priority: 1=highest, 3=lowest |
| Details | varchar | User-provided description |
| CreatedAt | timestamptz | When ping was created |
| UserId | text | FK → AspNetUsers (who created the ping) |
| AssignedVolunteerId | text | FK → AspNetUsers (volunteer handling it) |
| CompletionNotes | text | Volunteer notes when resolving |

**Relations:** FK to AspNetUsers (creator + assigned volunteer), PingFlags, HelpOffers.

---

### `PingFlags` — Real-time Ping State
**Role:** Tracks transient visual state for map markers (blinking animation, unconfirmed duration).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| PingId | int4 | FK → Pings |
| IsBlinking | bool | Whether marker should blink on map |
| UnconfirmedTimeMinutes | int4 | Minutes since last confirmation |
| LastCheckedAt | timestamptz | When a volunteer last confirmed the ping |

---

### `Zones` — Relief Zones
**Role:** Delineates geographic relief zones on the map with risk levels.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Name | varchar | Zone name |
| BoundaryGeoJson | text | GeoJSON polygon of zone boundary |
| RiskLevel | int4 | Risk level for the zone |
| CreatedAt | timestamptz | Creation timestamp |

---

### `SupplyItems` — Supply Locations
**Role:** Tracks relief supply drop-off / storage locations with GPS coordinates.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Name | varchar | Supply item name |
| Quantity | int4 | Available quantity |
| CoordinatesLat / CoordinatesLong | float8 | Supply location |
| CreatedAt | timestamptz | Creation timestamp |

---

## Social & Content Tables

### `Posts` — Social Feed Posts
**Role:** Community posts in the social/feed tab.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Content | varchar | Post text content |
| ImageUrl | varchar | Optional image attachment |
| Category / CategoryId | int4 | Post category (tag) |
| CreatedAt | timestamptz | Posted time |
| AuthorId | text | FK → AspNetUsers |
| IsPinned | bool | Admin can pin important posts |

**Relations:** FK to AspNetUsers (author), Comments, Reactions, Reports, HelpOffers, Tags.

---

### `Comments` — Post Comments
**Role:** Threaded comments on posts.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Content | varchar | Comment text |
| CreatedAt | timestamptz | Posted time |
| PostId | int4 | FK → Posts |
| UserId | text | FK → AspNetUsers |

---

### `Reactions` — Post Reactions
**Role:** Emoji reactions on posts (like/upvote system).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Type | int4 | Reaction type (enum) |
| CreatedAt | timestamptz | Reaction time |
| PostId | int4 | FK → Posts |
| UserId | text | FK → AspNetUsers |

---

### `Tags` / `Posts.CategoryId` — Post Categories
**Role:** Categorizes posts (relief news, volunteer opportunities, lost & found, etc.).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| CategoryName | varchar | Category name |
| Description | varchar | Category description |

---

## Communication Tables

### `Conversations` — Chatbot Conversations
**Role:** One conversation per user for the AI chatbot (Gemini). Stores conversation metadata.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| CreatedAt | timestamptz | When conversation started |
| UserId | text | FK → AspNetUsers (owner) |

**Relations:** FK to AspNetUsers, Messages.

---

### `Messages` — Chatbot Messages
**Role:** Individual messages within a chatbot conversation.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Content | varchar | Message text |
| IsBotMessage | bool | True = AI response, False = user message |
| HasSafetyWarning | bool | Whether AI flagged this for safety |
| SentAt | timestamptz | Message timestamp |
| ConversationId | int4 | FK → Conversations |
| SenderId | text | FK → AspNetUsers (nullable for bot) |

---

### `Notifications` — User Notifications
**Role:** In-app notifications for users (e.g., "Your verification was approved", "New comment on your post").

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| MessageText | varchar | Notification message |
| IsRead | bool | Whether user has dismissed it |
| CreatedAt | timestamptz | When it was created |
| UserId | text | FK → AspNetUsers (recipient) |

---

### `SystemAnnouncements` — Admin Broadcasts
**Role:** System-wide announcements from admins (e.g., maintenance notices, relief updates).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Title | varchar | Announcement title |
| Content | varchar | Body text (max 5000 chars) |
| AdminId | text | FK → AspNetUsers (who posted it) |
| CreatedAt | timestamptz | Posted time |
| ExpiresAt | timestamptz | Optional expiry |

---

## Sponsorship & Reporting Tables

### `HelpOffers` — Sponsor Offers
**Role:** Tracks when a Sponsor offers help to a specific PersonInNeed (targeted by Ping or Post).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| SponsorId | text | FK → AspNetUsers (who offers) |
| TargetUserId | text | FK → AspNetUsers (who receives) |
| PingId | int4 | FK → Pings (optional, for SOS-linked offers) |
| PostId | int4 | FK → Posts (optional, for post-linked offers) |
| Message | text | Sponsor's offer message (max 1000 chars) |
| Status | int4 | OfferStatus: Pending=0, Accepted=1, Rejected=2, Completed=3 |
| CreatedAt | timestamptz | When offer was made |

---

### `Reports` — Post Reports
**Role:** Users can report inappropriate posts; admins review them.

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| PostId | int4 | FK → Posts (reported post) |
| ReporterId | text | FK → AspNetUsers (who reported) |
| Reason | varchar | Report reason (max 500 chars) |
| Status | int4 | ReportStatus: Pending=0, Reviewed=1, Resolved=2, Dismissed=3 |
| CreatedAt | timestamptz | When report was filed |

---

## System Tables

### `SystemLogs` — Audit Trail
**Role:** Server-side audit log for all admin actions and system events (login, logout, role changes, SOS resolves, etc.).

| Column | Type | Notes |
|--------|------|-------|
| Id | int4 | PK |
| Action | varchar | Action identifier (e.g., "User_Login", "SOS_Resolved") |
| Details | varchar | Human-readable detail string |
| UserId | text | Associated user (nullable for anonymous actions) |
| UserName | varchar | Snapshot of username at log time |
| CreatedAt | timestamptz | Event timestamp |
| BatchId | uuid | Groups related log entries |
| ParentLogId | int4 | FK → SystemLogs (self-referential for batch hierarchy) |

---

### `__EFMigrationsHistory` — EF Core Migration History
**Role:** Standard EF Core table tracking which migrations have been applied.

| Column | Type | Notes |
|--------|------|-------|
| MigrationId | varchar | Migration class name |
| ProductVersion | varchar | EF Core version |

---

## Entity-Relationship Summary

```
AspNetUsers (central)
├── Posts (AuthorId)
├── Pings (UserId + AssignedVolunteerId)
│   └── PingFlags
│   └── HelpOffers
├── Comments (UserId)
├── Reactions (UserId)
├── Notifications (UserId)
├── Conversations (UserId)
│   └── Messages (ConversationId, SenderId)
├── HelpOffers (SponsorId + TargetUserId)
├── Reports (ReporterId)
├── SystemAnnouncements (AdminId)
└── SystemLogs (UserId)

Posts
├── Comments
├── Reactions
├── Reports
├── HelpOffers
└── Tags (CategoryId)

Zones ─── geographic boundaries (no FK relations)

SupplyItems ─── supply locations (no FK relations)
```
