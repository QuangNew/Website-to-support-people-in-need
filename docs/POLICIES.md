# ReliefConnect — Platform Policies

> Version 1.0 · Effective Date: April 2026 · Last Updated: April 8, 2026

---

## Table of Contents

1. [Acceptable Use Policy](#1-acceptable-use-policy)
2. [Privacy & Data Protection Policy](#2-privacy--data-protection-policy)
3. [Content Moderation Policy](#3-content-moderation-policy)
4. [User Roles & Verification Policy](#4-user-roles--verification-policy)
5. [Security Policy](#5-security-policy)
6. [AI Chatbot Usage Policy](#6-ai-chatbot-usage-policy)
7. [SOS & Emergency Request Policy](#7-sos--emergency-request-policy)
8. [Anti-Abuse & Enforcement Policy](#8-anti-abuse--enforcement-policy)
9. [API & Integration Policy](#9-api--integration-policy)
10. [Data Retention & Export Policy](#10-data-retention--export-policy)

---

## 1. Acceptable Use Policy

### 1.1 Purpose
ReliefConnect exists solely to facilitate humanitarian relief coordination. All platform usage must align with this core mission.

### 1.2 Permitted Uses
- Posting genuine SOS requests during emergencies or ongoing hardship
- Sharing stories related to livelihood difficulties, medical needs, or educational barriers
- Volunteering to assist with relief tasks
- Offering sponsorship, financial aid, or material support
- Using the AI chatbot for emergency guidance, platform help, or disaster-related questions

### 1.3 Prohibited Uses
- Posting false, misleading, or fabricated SOS requests
- Impersonating another user, organization, or government agency
- Distributing spam, advertisements, or content unrelated to humanitarian relief
- Uploading malicious files, scripts, or executable content
- Attempting to exploit, reverse-engineer, or overload platform systems
- Sharing personally identifiable information of others without consent
- Using the platform for political campaigning, hate speech, or discrimination
- Circumventing rate limits, verification requirements, or access controls

### 1.4 Consequences
Violations are subject to graduated enforcement as described in [Section 8](#8-anti-abuse--enforcement-policy).

---

## 2. Privacy & Data Protection Policy

### 2.1 Data We Collect

| Data Category | Examples | Purpose |
|--------------|---------|---------|
| **Account Data** | Email, username, full name, password hash | Authentication and identity |
| **Verification Data** | Phone number, address, ID documents | Role verification by administrators |
| **Location Data** | Coordinates (latitude/longitude) from SOS pings | Geospatial relief mapping |
| **Content Data** | Posts, comments, chat messages, images | Community features and AI chatbot |
| **Usage Data** | Login timestamps, API access logs | Security auditing and analytics |
| **Technical Data** | IP address, browser user-agent | Rate limiting and abuse prevention |

### 2.2 How We Use Data
- **Service Delivery**: Displaying SOS requests on maps, enabling social features, powering the AI chatbot
- **Safety**: Emergency keyword detection triggers safety warnings with local emergency numbers
- **Moderation**: Content review for policy compliance (automated sanitization + manual admin review)
- **Analytics**: Aggregated, anonymized statistics on platform usage for operational improvement
- **Legal Compliance**: Audit logs retained for accountability and incident investigation

### 2.3 Data Sharing
- **No sale of personal data.** ReliefConnect does not sell, rent, or trade user data.
- **AI Processing**: Chat messages are sent to Google Gemini API for response generation. Google's data handling policies apply to API interactions.
- **Routing**: Map routing requests may be sent to OSRM (Open Source Routing Machine) public servers, which receive coordinate data. A backend proxy is recommended for production deployments.
- **Law Enforcement**: Data may be disclosed when required by Vietnamese law or court order.

### 2.4 Data Storage & Security
- All data stored in Supabase-hosted PostgreSQL with encryption at rest
- Passwords hashed using PBKDF2 via ASP.NET Core Identity
- JWT tokens issued with 1-hour expiry; blacklisted on logout
- API keys stored with usage tracking; rotated periodically
- Base64-encoded chat images are validated (type + size) before processing

### 2.5 User Rights
- **Access**: Users may view their profile data and conversation history
- **Correction**: Users may update their profile information at any time
- **Deletion**: Account deletion can be requested through the platform (implementation in progress)
- **Export**: Admin CSV export functionality does not currently extend to individual users

---

## 3. Content Moderation Policy

### 3.1 Automated Protections
- **XSS Sanitization**: All user-generated content (posts, comments, chat messages) is processed through HtmlSanitizer before storage
- **Image Validation**: Only JPEG, PNG, and WebP formats accepted; maximum 5 MB for posts, 4 MB for chatbot images
- **Rate Limiting**: Upload endpoints limited to 20 requests per 5 minutes per user

### 3.2 Community Reporting
Users may report posts that violate platform policies. Reports enter a moderation queue with three states:
- **Pending**: Awaiting administrator review
- **Reviewed**: Report accepted and action taken (post removal, user warning)
- **Dismissed**: Report found to be without merit

### 3.3 Administrator Moderation Powers
| Action | Scope | Reversible |
|--------|-------|-----------|
| Pin Post | Promote important content to feed top | Yes |
| Delete Post | Hard delete from database | No |
| Delete Comment | Remove specific comment | No |
| Review Report | Accept community report | No |
| Dismiss Report | Reject community report | No |

### 3.4 Content Standards
Posts must be categorized into one of three humanitarian categories:
- **Livelihood** (Gia cảnh): Economic hardship, loss of home/employment, family crises
- **Medical** (Bệnh tật): Health emergencies, chronic conditions, medical expenses
- **Education** (Giáo dục): Educational barriers, school supply needs, tuition assistance

Content that does not fit these categories or violates the Acceptable Use Policy is subject to removal.

---

## 4. User Roles & Verification Policy

### 4.1 Role Hierarchy

| Role | Access Level | Verification Required |
|------|-------------|----------------------|
| **Guest** (unregistered) | Read-only map and public posts | No |
| **Registered User** | Basic account, email-verified | Email verification (6-digit code) |
| **Person in Need** | Create SOS requests, post stories | Document verification |
| **Sponsor** | View cases, offer financial/material help | Document verification |
| **Volunteer** | Accept relief tasks, confirm safety | Document verification |
| **Administrator** | Full platform management | Internal assignment |

### 4.2 Verification Process
1. User registers and verifies email with a 6-digit code (15-minute expiry)
2. User requests role upgrade via Profile → Verify
3. User provides: target role, phone number, address, supporting documents (ID card, proof of residency, etc.)
4. Request enters the admin verification queue (`/admin/verifications`)
5. Administrator reviews documentation and either:
   - **Approves**: Role is upgraded, verification status set to `Approved`
   - **Rejects**: Status set to `Rejected` with a reason visible to the user
6. User may re-submit verification after rejection

### 4.3 Multiple Roles
The current system supports a single active role per user. Role changes require administrator approval.

### 4.4 Administrator Appointment
Administrator accounts are created and assigned internally. There is no self-service path to the Administrator role.

---

## 5. Security Policy

### 5.1 Authentication Security

| Measure | Implementation |
|---------|---------------|
| Password Requirements | Minimum 8 characters, requires uppercase, lowercase, and digit |
| Password Storage | PBKDF2 hashing via ASP.NET Core Identity |
| JWT Token Expiry | 1 hour |
| JWT Secret Key | Minimum 256-bit key enforced at startup |
| Token Blacklist | Logout invalidates token via JTI tracking |
| Account Lockout | 5 failed attempts → 5-minute lockout |
| Rate Limiting | 5 login attempts per 15 minutes |
| Google OAuth | Validated against configured Google Client ID |

### 5.2 API Security

| Measure | Implementation |
|---------|---------------|
| CORS | Whitelist of allowed frontend origins |
| HTTPS | Enforced via HSTS with 1-year max-age |
| Security Headers | CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| Request Size Limits | 6 MB for chatbot, 5 MB for image uploads |
| Input Sanitization | HtmlSanitizer on all user-generated text |
| SQL Injection | Prevented via Entity Framework Core parameterized queries |
| Timing Attacks | CryptographicOperations.FixedTimeEquals for code verification |

### 5.3 Data Security

| Measure | Implementation |
|---------|---------------|
| Database | Supabase-managed PostgreSQL with encryption at rest |
| API Keys | Stored in database with usage tracking; sent via HTTP header (not query string) |
| Gemini API | API key transmitted via `x-goog-api-key` header |
| Audit Logging | All admin actions logged with immutable parent-child hierarchy |
| CSV Export Safety | `CsvSafe` escaping prevents formula injection in exports |

### 5.4 Known Limitations
- JWT tokens stored in `localStorage` (vulnerable to XSS; httpOnly cookie migration recommended)
- No token rotation / refresh token mechanism
- OSRM routing sends coordinates to public servers (backend proxy recommended)
- Chat image cache in localStorage is unencrypted

---

## 6. AI Chatbot Usage Policy

### 6.1 Purpose
The AI chatbot assists users with:
- Emergency first aid and survival guidance
- Platform navigation and feature explanation
- Disaster preparedness information
- Local emergency contact numbers (113, 114, 115)

### 6.2 AI Provider
- **Provider**: Google Gemini (models: gemini-2.5-flash, gemini-3-flash)
- **Processing**: Messages and images are sent to Google's generative AI API
- **Context Window**: Last 20 messages per conversation are included for contextual responses

### 6.3 Safety Mechanisms
- **Content Filtering**: Gemini's built-in safety settings block harassment, hate speech, sexually explicit, and dangerous content at `BLOCK_MEDIUM_AND_ABOVE` threshold
- **Emergency Detection**: System detects emergency keywords (Vietnamese and English) and adds safety warnings with emergency numbers
- **Input Sanitization**: All user messages are HTML-sanitized before storage
- **Image Validation**: MIME type whitelist (JPEG/PNG/WebP), 4 MB binary limit, base64 format validation

### 6.4 Limitations
- The chatbot is an AI assistant and may produce inaccurate information
- It is not a substitute for professional medical, legal, or emergency services
- Response quality depends on the underlying Gemini model
- The system prompt instructs the AI to decline sensitive, political, or legally problematic topics

### 6.5 Dual-Provider Architecture (Planned)
ReliefConnect supports a dual AI backend:
- **n8n Workflow**: Primary provider when connected — enables visual workflow design, multi-step reasoning, RAG, and custom business logic
- **Direct Gemini API**: Fallback provider when n8n is unreachable

The system automatically detects n8n connectivity status and routes chatbot requests accordingly.

---

## 7. SOS & Emergency Request Policy

### 7.1 SOS Request Lifecycle

```
User Creates SOS → Pending → Volunteer Accepts → InProgress → Resolved/VerifiedSafe
                                    ↓
                         (15 min unconfirmed)
                                    ↓
                          PingFlag.IsBlinking = true
                          → SignalR broadcast to volunteers
```

### 7.2 SOS Obligations
- **Persons in Need**: Must provide accurate location coordinates and genuine emergency details
- **Volunteers**: Must only accept tasks they can realistically fulfill; must confirm safety on completion
- **Administrators**: May force-resolve SOS requests that are stale, resolved externally, or fraudulent

### 7.3 Blinking Alert System
- SOS requests unconfirmed for more than 15 minutes trigger an automatic blinking alert
- Background service (`PingFlagMonitorService`) checks every 5 minutes
- Blinking alerts are broadcast to all connected volunteers via SignalR
- Alerts are cleared when the ping status changes to Resolved or VerifiedSafe

### 7.4 False SOS Policy
Posting deliberate false SOS requests constitutes a serious policy violation subject to immediate suspension or permanent ban, as this diverts volunteer resources from genuine emergencies.

---

## 8. Anti-Abuse & Enforcement Policy

### 8.1 Enforcement Actions

| Level | Action | Description | Reversible |
|-------|--------|-------------|-----------|
| 1 | **Content Removal** | Specific post or comment deleted | No |
| 2 | **Warning** | Verbal warning via moderation note | — |
| 3 | **Temporary Suspension** | Account disabled for specified period (with `expiresAt`) | Yes (auto or manual) |
| 4 | **Permanent Ban** | Account permanently disabled with recorded reason | Manual appeal only |
| 5 | **Force Logout** | All active sessions invalidated via token blacklist | — |

### 8.2 Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication (login/register) | 5 requests | 15 minutes |
| File Uploads | 20 requests | 5 minutes |
| Chatbot Messages | 30 requests | 5 minutes |
| General API | Standard ASP.NET Core defaults | — |

### 8.3 Batch Operations
Administrators can perform batch enforcement actions (role approvals, rejections, post deletions) that are atomically logged with a parent-child audit trail for accountability.

### 8.4 Audit Trail
All enforcement actions generate `SystemLog` entries containing:
- Action type and detailed description
- Acting administrator's user ID
- Timestamp (UTC)
- Batch ID and parent log ID for grouped operations

---

## 9. API & Integration Policy

### 9.1 API Access
- All API endpoints require HTTPS in production
- Authenticated endpoints require a valid JWT Bearer token in the `Authorization` header
- SignalR connections accept tokens via `?access_token=` query parameter

### 9.2 API Key Management
- Gemini API keys are managed through the admin panel's API Keys tab
- Keys are stored in the `ApiKeys` database table with provider, model, usage count, and active status
- The system automatically selects the least-used active key for load distribution
- Fallback to the configuration file key when the pool is empty

### 9.3 Third-Party Integrations

| Service | Purpose | Data Sent |
|---------|---------|----------|
| Google Gemini API | AI chatbot responses | Chat messages, images (base64) |
| Google OAuth | Social login | OAuth credential token |
| OSRM | Map routing | Coordinate pairs |
| Supabase | Database hosting | All application data |
| SMTP (Gmail) | Email delivery | Verification codes, notifications |
| n8n (planned) | AI workflow orchestration | Chat messages, context data |

### 9.4 Webhook & n8n Integration (Planned)
- n8n webhook endpoints will be secured with shared secret header authentication
- Health check endpoint monitors n8n availability
- Automatic failover to direct Gemini API on n8n downtime

---

## 10. Data Retention & Export Policy

### 10.1 Retention Periods

| Data Type | Retention |
|-----------|----------|
| User Accounts | Until manually deleted or banned |
| SOS Pings | Indefinite (historical data for analytics) |
| Posts & Comments | Until user-deleted or admin-removed |
| Chat Conversations | Indefinite (server-side); 200-message localStorage limit (client) |
| Audit Logs | Indefinite (immutable records) |
| System Announcements | Until admin-deleted or natural expiry (`ExpiresAt` field) |

### 10.2 Export Capabilities
- **Admin CSV Export**: User list and audit logs exportable as CSV (10,000 row limit with formula injection prevention)
- **Individual Export**: Not currently available (planned feature)

### 10.3 Data Deletion
- Posts: Soft-delete by author, hard-delete by administrator
- Comments: Hard-delete by administrator
- Account: Deletion endpoint planned (not yet implemented)
- Chat Conversations: Server-side deletion not yet exposed; client-side clearable via "New Chat"

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 8, 2026 | Initial comprehensive policy document |

---

*This policy document is maintained alongside the ReliefConnect codebase and is updated with each major platform release.*
