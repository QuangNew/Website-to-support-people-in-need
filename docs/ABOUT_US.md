# About ReliefConnect

> *Connecting relief aid to the people who need it most.*

---

## Our Mission

ReliefConnect is a humanitarian technology platform purpose-built to bridge the critical gap between people affected by natural disasters, pandemics, and socioeconomic crises in Vietnam and the organizations, volunteers, and sponsors ready to help them.

When disaster strikes, every minute counts. Traditional relief coordination relies on fragmented phone calls, social media posts, and manual logistics — leading to delayed responses, duplicated efforts, and underserved communities. ReliefConnect replaces this chaos with a unified, real-time digital platform that empowers every stakeholder in the relief chain.

## What We Do

### Real-Time Relief Map
An interactive geospatial map powered by PostGIS displays live SOS requests, supply warehouses, and safe shelters across Vietnam. Volunteers see active emergencies in real time via WebSocket (SignalR) connections, enabling response times measured in minutes rather than hours.

### Community Social Network
A purpose-built social feed connects people in need with their communities. Users share stories categorized by livelihood hardship, medical needs, and educational support — creating visibility for individuals who would otherwise go unnoticed.

### AI-Powered Assistance
An integrated chatbot powered by Google Gemini AI provides instant guidance on first aid, survival techniques, platform usage, and local emergency contacts. The system detects emergency keywords in both Vietnamese and English, automatically surfacing critical safety information.

### Role-Based Ecosystem
ReliefConnect serves four distinct stakeholder groups, each with tailored capabilities:

| Role | Purpose |
|------|---------|
| **Person in Need** | Post SOS requests, share stories, request assistance |
| **Volunteer** | Accept and manage relief tasks, confirm safety on-site |
| **Sponsor** | Discover support cases, offer financial or material help |
| **Administrator** | Moderate content, verify identities, manage the platform |

### Identity Verification
Every role beyond basic registration requires document-based verification reviewed by platform administrators — ensuring trust and accountability throughout the ecosystem.

## Technology Foundation

ReliefConnect is built on a modern, production-grade technology stack designed for reliability under crisis conditions:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend API | ASP.NET Core 10.0 (C#) | RESTful API with Clean Architecture |
| Frontend | React 19 + TypeScript + Vite | Responsive single-page application |
| Database | PostgreSQL 17 + PostGIS | Geospatial queries and reliable data storage |
| Hosting | Supabase (managed PostgreSQL) | Scalable cloud database infrastructure |
| Real-Time | SignalR (WebSocket) | Live SOS alert broadcasting |
| AI Integration | Google Gemini 2.5 Flash | Multilingual conversational AI |
| Background Jobs | Hangfire | Asynchronous email delivery and monitoring |
| Localization | i18n (Vietnamese + English) | Full bilingual interface |

### Architecture Principles
- **Clean Architecture**: Three-layer separation (Core → Infrastructure → API) ensuring testability and maintainability
- **Security-First**: JWT authentication, rate limiting, XSS sanitization, timing-attack prevention, and comprehensive audit logging
- **Performance-Optimized**: Sub-second API responses via spatial indexes, cursor pagination, response compression, and output caching
- **Real-Time by Design**: WebSocket-based SOS alerts with automatic blinking detection for unconfirmed emergencies

## Geographic Focus

ReliefConnect is designed for Vietnam's unique disaster landscape — a country that faces an average of 6–8 typhoons per year, alongside recurring floods, landslides, and droughts. The platform:

- Validates all coordinates against Vietnam's territorial boundaries (including island territories)
- Provides bilingual support (Vietnamese primary, English secondary)
- Integrates local emergency numbers (113 Police, 114 Fire, 115 Medical)
- Supports Vietnamese address formats and province-level geolocation

## Our Values

### Transparency
Every administrative action is logged in an immutable audit trail. Batch operations create parent-child log hierarchies for complete accountability.

### Accessibility
The platform is fully bilingual, mobile-responsive, and designed with minimal bandwidth requirements — critical for areas with degraded infrastructure post-disaster.

### Privacy
User location data is handled with care. Geospatial queries run server-side against indexed coordinates, and the platform architecture supports backend proxying of routing requests to avoid exposing user coordinates to third-party services.

### Open Collaboration
ReliefConnect is built as a PBL (Project-Based Learning) initiative with an emphasis on real-world humanitarian impact through software engineering excellence.

## Impact by Design

| Metric | Capability |
|--------|-----------|
| **Response Time** | Real-time SOS alerts via WebSocket (< 1 second delivery) |
| **Coverage** | Nationwide geospatial mapping with sub-kilometer precision |
| **Scale** | Marker clustering handles thousands of simultaneous SOS requests |
| **Reliability** | Auto-retry database connections, background job resilience, connection pooling |
| **Moderation** | AI-assisted content review, community reporting, admin moderation queue |

## Contact & Contribution

ReliefConnect is developed and maintained as part of a university PBL project at [Da Nang University of Science and Technology]. For inquiries, collaboration, or contribution:

- **Repository**: GitHub — Website-to-support-people-in-need
- **Backend API**: `http://localhost:5164` (development)
- **Frontend App**: `http://localhost:5173` (development)

---

*ReliefConnect — Because when disaster strikes, technology should connect, not complicate.*
