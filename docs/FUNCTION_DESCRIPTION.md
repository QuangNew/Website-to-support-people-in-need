# ReliefConnect — Function Description

> Comprehensive reference of all platform features, API endpoints, and system capabilities.
>
> Version 1.0 · April 8, 2026

---

## Table of Contents

1. [Authentication & Identity](#1-authentication--identity)
2. [Interactive Relief Map](#2-interactive-relief-map)
3. [Community Social Network](#3-community-social-network)
4. [AI Chatbot](#4-ai-chatbot)
5. [Volunteer Operations](#5-volunteer-operations)
6. [Sponsor Operations](#6-sponsor-operations)
7. [Administration](#7-administration)
8. [Real-Time Notifications](#8-real-time-notifications)
9. [Background Services](#9-background-services)
10. [Internationalization](#10-internationalization)

---

## 1. Authentication & Identity

### 1.1 User Registration
**Endpoint**: `POST /api/auth/register`
**Access**: Public

Creates a new user account and initiates email verification.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Username` | string | Yes | Unique username |
| `Email` | string | Yes | Valid email address |
| `FullName` | string | Yes | Display name |
| `Password` | string | Yes | Min 8 chars, requires uppercase + lowercase + digit |

**Flow**:
1. Validates input and checks for duplicate email/username
2. Creates `ApplicationUser` via ASP.NET Core Identity
3. Generates 6-digit verification code (15-minute expiry)
4. Queues verification email via Hangfire background job
5. Returns JWT token (user can authenticate immediately, but restricted until verified)

**Response**: `AuthResponseDto` containing JWT token, user ID, email, role, and verification status.

---

### 1.2 Email Verification
**Endpoint**: `POST /api/auth/verify-email`
**Access**: Authenticated

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Code` | string | Yes | 6-digit verification code from email |

**Security**: Code comparison uses `CryptographicOperations.FixedTimeEquals` to prevent timing attacks.

---

### 1.3 Login
**Endpoint**: `POST /api/auth/login`
**Access**: Public (rate-limited: 5 requests / 15 minutes)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Email` | string | Yes | Email or username |
| `Password` | string | Yes | Account password |

**Security Features**:
- Account lockout after 5 failed attempts (5-minute cooldown)
- Checks suspended/banned status before issuing token
- JWT contains: `sub` (userId), `email`, `role`, `jti` (unique token ID)

---

### 1.4 Google OAuth
**Endpoint**: `POST /api/auth/google`
**Access**: Public

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Credential` | string | Yes | Google Sign-In JWT credential |

**Flow**:
1. Validates credential against configured Google Client ID
2. If email exists → logs in existing user
3. If email is new → creates account (auto-verified, random password)
4. Returns JWT token

---

### 1.5 Password Reset
**Endpoints**:
- `POST /api/auth/forgot-password` — Sends 6-digit reset code to email
- `POST /api/auth/reset-password` — Validates code and sets new password

---

### 1.6 Logout
**Endpoint**: `POST /api/auth/logout`
**Access**: Authenticated

Adds the current token's JTI to the blacklist, invalidating it immediately. All subsequent requests with this token are rejected.

---

### 1.7 Profile Management
**Endpoints**:
- `GET /api/auth/profile` — Retrieve current user profile
- `PUT /api/auth/profile` — Update profile (full name, phone, address, avatar URL)
- `POST /api/auth/change-password` — Change password (requires current password)

---

### 1.8 Role Verification
**Endpoint**: `POST /api/auth/verify-role`
**Access**: Authenticated

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TargetRole` | enum | Yes | PersonInNeed, Sponsor, or Volunteer |
| `PhoneNumber` | string | Yes | Contact phone number |
| `Address` | string | Yes | Residential address |
| `Documents` | string | Yes | Supporting document references |

Submits a verification request to the admin queue. Status transitions: `None → Pending → Approved/Rejected`.

---

## 2. Interactive Relief Map

### 2.1 View Map Pings
**Endpoint**: `GET /api/map/pings`
**Access**: Public

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | double | No | Center latitude for radius search |
| `lng` | double | No | Center longitude for radius search |
| `radiusKm` | double | No | Search radius in kilometers |

**Without coordinates**: Returns up to 500 most recent pings.
**With coordinates**: Uses PostGIS `ST_DWithin` spatial query for efficient radius-based search.

**Response**: Array of `PingResponseDto` containing:
- ID, coordinates, type (SOS/Supply/Shelter), status, details
- Creator information, assigned volunteer, timestamps
- Blinking state (from PingFlags)

---

### 2.2 Create SOS Ping
**Endpoint**: `POST /api/map/pings`
**Access**: Authenticated

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Latitude` | double | Yes | GPS latitude (validated against Vietnam boundaries) |
| `Longitude` | double | Yes | GPS longitude (validated against Vietnam boundaries) |
| `Type` | enum | Yes | SOS, Supply, or Shelter |
| `Details` | string | Yes | Description of the emergency or resource |

**Validation**: Coordinates are checked against Vietnam's mainland and island territory bounding boxes.

---

### 2.3 Update Ping Status
**Endpoint**: `PUT /api/map/pings/{id}/status`
**Access**: RequireVolunteer

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Status` | enum | Yes | InProgress, Resolved, VerifiedSafe |
| `CompletionNotes` | string | No | Notes on resolution |

---

### 2.4 Confirm Safety
**Endpoint**: `POST /api/map/pings/{id}/confirm-safe`
**Access**: Authenticated (ping owner)

Marks the user's own SOS request as safe, clearing the blinking alert flag.

---

### 2.5 Map Routing
**Frontend Feature** (no dedicated backend endpoint)

- Uses OSRM (Open Source Routing Machine) for turn-by-turn navigation
- Calculates up to 2 alternative routes (fastest vs. shortest)
- Click-to-select route interface on the map
- Routes displayed as polylines overlaid on Leaflet map tiles

---

### 2.6 Zone Management
**Endpoints**:
- `GET /api/zone` — List all priority zones (public)
- `POST /api/zone` — Create zone (RequireAdmin)
- `PUT /api/zone/{id}` — Update zone (RequireAdmin)
- `DELETE /api/zone/{id}` — Delete zone (RequireAdmin)

**Zone Properties**:
- Name, GeoJSON polygon boundary, risk level (1-5)
- Displayed as color-coded overlays on the map

---

### 2.7 Supply Management
**Endpoints**:
- `GET /api/supply` — List supply items/warehouses (public)
- `POST /api/supply` — Create supply item (RequireVerified)
- `PUT /api/supply/{id}` — Update item
- `DELETE /api/supply/{id}` — Delete item

---

## 3. Community Social Network

### 3.1 Social Feed
**Endpoint**: `GET /api/social/posts`
**Access**: Public

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cursor` | string | No | Cursor for pagination (CreatedAt-based) |
| `limit` | int | No | Posts per page (default: 20) |
| `category` | enum | No | Filter by Livelihood, Medical, Education |
| `role` | enum | No | Filter by author's role |
| `sort` | string | No | Sorting criteria |

**Performance**: Uses cursor-based pagination with descending index on `Post.CreatedAt`. No N+1 queries — reaction counts and comment counts are pre-aggregated via `GroupBy`.

---

### 3.2 Create Post
**Endpoint**: `POST /api/social/posts`
**Access**: Authenticated

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Content` | string | Yes | Post text (HTML-sanitized before storage) |
| `Category` | enum | Yes | Livelihood (0), Medical (1), or Education (2) |
| `ImageUrl` | string | No | URL of uploaded image |

---

### 3.3 Image Upload
**Endpoint**: `POST /api/social/upload-image`
**Access**: Authenticated

Accepts multipart form data with a single image file. Validates MIME type (JPEG/PNG/WebP) and file size (max 5 MB). Returns the stored image URL.

---

### 3.4 Reactions
**Endpoint**: `POST /api/social/posts/{postId}/reactions`
**Access**: Authenticated

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Type` | enum | Yes | Like (0), Love (1), or Pray (2) |

**Toggle behavior**: Sending the same reaction type again removes it. Sending a different type replaces the existing reaction.

---

### 3.5 Comments
**Endpoints**:
- `GET /api/social/posts/{postId}/comments` — Cursor-paginated comment list
- `POST /api/social/posts/{postId}/comments` — Add comment (HTML-sanitized)

---

### 3.6 Post Reporting
Users can report posts that violate platform policies. Reports enter the admin moderation queue.

---

### 3.7 User Wall
**Endpoint**: `GET /api/social/users/{userId}/wall`
**Access**: Public

Returns a specific user's post timeline with the same cursor pagination as the main feed.

---

## 4. AI Chatbot

### 4.1 Create Conversation
**Endpoint**: `POST /api/chatbot/conversations`
**Access**: Authenticated

Creates a new chatbot conversation session. Returns the conversation ID.

---

### 4.2 Send Message
**Endpoint**: `POST /api/chatbot/conversations/{conversationId}/messages`
**Access**: Authenticated (rate-limited: 30 / 5 minutes)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Content` | string | Yes | User's message text |
| `ImageBase64` | string | No | Base64-encoded image data |
| `ImageMimeType` | string | No | MIME type (image/jpeg, image/png, image/webp) |

**Processing Flow**:
1. Validate image fields (both present or both absent)
2. If image present: validate base64 decodability and 4 MB binary limit
3. Verify conversation ownership
4. Save user message to database (prevents connection idle during AI call)
5. Fetch last 20 messages for conversation context
6. Call AI provider (n8n workflow preferred, Gemini API fallback)
7. Save bot response with safety warning flag
8. Return `MessageResponseDto`

**Response**:

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Message database ID |
| `Content` | string | AI-generated response text |
| `IsBotMessage` | bool | Always `true` for bot responses |
| `HasSafetyWarning` | bool | `true` if emergency keywords detected |
| `SentAt` | DateTime | UTC timestamp |

---

### 4.3 Get Conversation Messages
**Endpoint**: `GET /api/chatbot/conversations/{conversationId}/messages`
**Access**: Authenticated (conversation owner only)

Returns all messages in chronological order.

---

### 4.4 AI Provider Details

**System Prompt** (Vietnamese):
> "Bạn là trợ lý AI của ReliefConnect — nền tảng hỗ trợ cứu trợ thiên tai tại Việt Nam. Nhiệm vụ: giúp người dùng tìm thông tin cứu trợ, hướng dẫn sử dụng nền tảng, trả lời câu hỏi về tình hình thiên tai. Trả lời ngắn gọn, chính xác, ưu tiên tiếng Việt. Nếu câu hỏi bằng tiếng Anh, trả lời bằng tiếng Anh. Không trả lời các nội dung nhạy cảm, chính trị, vi phạm pháp luật."

**Safety Settings**: All four Gemini harm categories blocked at `BLOCK_MEDIUM_AND_ABOVE`.

**Generation Config**: `maxOutputTokens: 1024`, `temperature: 0.7`

**Emergency Keywords** (triggers safety warning):
- Vietnamese: đau tim, ngộ độc, chảy máu, ngừng thở, tai nạn, cấp cứu
- English: heart attack, poisoning, bleeding, emergency, stopped breathing, accident

**API Key Pool**: Multiple Gemini API keys stored in database, least-used key selected per request. Automatic fallback to configuration file key when pool is empty.

---

### 4.5 Dual-Provider Architecture (Planned)

| Provider | Priority | Use Case |
|----------|----------|----------|
| **n8n Workflow** | Primary (when connected) | Advanced workflows, RAG, multi-step reasoning, business logic |
| **Direct Gemini API** | Fallback | Simple Q&A when n8n is unavailable |

See [CHATBOT_DUAL_ARCHITECTURE.md](CHATBOT_DUAL_ARCHITECTURE.md) for implementation details.

---

## 5. Volunteer Operations

### 5.1 Browse Available Tasks
**Endpoint**: `GET /api/volunteer/tasks`
**Access**: RequireVolunteer

Returns SOS pings with `Pending` status, sorted by proximity to the volunteer's location (bounding box calculation).

---

### 5.2 Accept Task
**Endpoint**: `POST /api/volunteer/accept-task`
**Access**: RequireVolunteer

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `PingId` | int | Yes | ID of the SOS ping to accept |

Updates ping status to `InProgress` and assigns the volunteer.

---

### 5.3 View Active Tasks
**Endpoint**: `GET /api/volunteer/active-tasks`
**Access**: RequireVolunteer

Returns all pings currently assigned to the authenticated volunteer with `InProgress` status.

---

## 6. Sponsor Operations

### 6.1 Search Support Cases
**Endpoint**: `GET /api/sponsor/cases`
**Access**: RequireSponsor

Searches both SOS pings (by status) and social posts (by category) to find individuals needing sponsors.

---

### 6.2 Offer Help
**Endpoint**: `POST /api/sponsor/offer-help`
**Access**: RequireSponsor

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TargetUserId` | string | Yes | User to offer help to |
| `PingId` | int | No | Related SOS ping |
| `PostId` | int | No | Related social post |
| `Message` | string | Yes | Description of offered help |

Creates a notification for the target user.

---

## 7. Administration

### 7.1 User Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | Paginated user list (search, role, verification filters) |
| `/api/admin/users/{id}` | GET | User detail with activity counts |
| `/api/admin/users/{id}/role` | PUT | Approve role change |
| `/api/admin/verifications` | GET | Pending verification queue |
| `/api/admin/verifications/{id}/reject` | POST | Reject with reason |
| `/api/admin/users/{id}/suspend` | POST | Temporary suspension (with expiry) |
| `/api/admin/users/{id}/unsuspend` | POST | Remove suspension |
| `/api/admin/users/{id}/ban` | POST | Permanent ban |
| `/api/admin/users/{id}/force-logout` | POST | Invalidate all sessions |
| `/api/admin/users/{id}/reset-verification` | POST | Reset to re-submit |
| `/api/admin/batch` | POST | Atomic batch operations |

---

### 7.2 Content Moderation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/moderation/posts` | GET | List all posts (paginated) |
| `/api/admin/moderation/posts/{id}/pin` | POST | Pin to feed top |
| `/api/admin/moderation/posts/{id}` | DELETE | Hard delete post |
| `/api/admin/moderation/posts/{postId}/comments/{commentId}` | DELETE | Delete comment |
| `/api/admin/moderation/reports` | GET | List reports (status filter) |
| `/api/admin/moderation/reports/{id}/review` | POST | Mark report reviewed |
| `/api/admin/moderation/reports/{id}/dismiss` | POST | Dismiss report |

---

### 7.3 System Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/system/stats` | GET | Dashboard statistics (cached 5 min) |
| `/api/admin/system/logs` | GET | Audit log (paginated) |
| `/api/admin/system/logs/{id}/children` | GET | Child logs for batch operations |
| `/api/admin/system/announcements` | GET/POST | List/create announcements |
| `/api/admin/system/announcements/{id}` | PUT/DELETE | Update/delete announcement |
| `/api/admin/system/export/users` | GET | CSV user export (10K limit) |
| `/api/admin/system/export/logs` | GET | CSV audit log export |
| `/api/admin/system/sos/{id}/force-resolve` | POST | Admin force-resolve SOS |

---

### 7.4 Admin Dashboard Tabs (Frontend)

| Tab | Functions |
|-----|----------|
| **Stats** | User counts by role, SOS status breakdown, content counts |
| **Verifications** | Review pending role verification requests |
| **Users** | Search, filter, manage users (suspend/ban/role change) |
| **Posts** | Content moderation, pin/delete posts |
| **Reports** | Community report queue |
| **Logs** | Audit trail with expandable batch operations |
| **Announcements** | Create/manage system announcements |
| **Zones** | Manage priority zones (create/edit/delete with GeoJSON) |
| **Supply** | Manage supply items and warehouse locations |
| **API Keys** | Manage Gemini API key pool (add/deactivate/track usage) |

---

## 8. Real-Time Notifications

### 8.1 SignalR Hub
**URL**: `/hubs/sos-alerts`
**Authentication**: JWT token via `?access_token=` query parameter

### 8.2 Methods (Client → Server)

| Method | Description |
|--------|-------------|
| `JoinSOSAlertGroup()` | Subscribe to real-time SOS alerts |
| `LeaveSOSAlertGroup()` | Unsubscribe from alerts |

### 8.3 Events (Server → Client)

| Event | Payload | Trigger |
|-------|---------|---------|
| `ReceiveSOSAlert` | `{ PingId, Lat, Lng, Timestamp }` | SOS ping unconfirmed > 15 min |
| `SOSAlertResolved` | `{ PingId, Timestamp }` | SOS ping resolved or confirmed safe |

---

## 9. Background Services

### 9.1 PingFlagMonitorService
**Schedule**: Every 5 minutes
**Purpose**: Detects SOS pings that have been unconfirmed for more than 15 minutes

**Process**:
1. Query all `Pending` pings older than 15 minutes
2. Create or update `PingFlag` records with `IsBlinking = true`
3. Broadcast `ReceiveSOSAlert` via SignalR to all connected volunteers
4. Handle database connection recycling (Npgsql `ObjectDisposedException`) with retry logic

### 9.2 Hangfire Background Jobs
**Storage**: In-memory (non-persistent across restarts)
**Uses**:
- Email verification code delivery
- Password reset code delivery
- Notification dispatch

---

## 10. Internationalization

### 10.1 Supported Languages
- **Vietnamese** (`vi`) — Primary language
- **English** (`en`) — Secondary language

### 10.2 Implementation
- Frontend: React Context (`LanguageContext`) with `useLanguage()` hook
- Translation files: `client/src/i18n/en.json` and `vi.json`
- Key namespaces: `common`, `auth`, `sidebar`, `ping`, `social`, `chat`, `admin`, `profile`

### 10.3 AI Chatbot Language
The system prompt instructs the AI to:
- Respond in Vietnamese by default
- Detect English input and respond in English
- Emergency keywords are defined in both languages

---

*This document reflects the ReliefConnect codebase as of April 8, 2026.*
