# ReliefConnect Knowledge Base: Architecture, Data Model, and API Surface

> Last synchronized: 2026-04-16
> Scope: frontend and backend architecture, persistence model, real-time and background processing, key entities, and API areas.
> Retrieval note: this file is self-contained for technical explanation and architecture-focused embedding.

## 1. Frontend Architecture

The frontend is a React 19 and TypeScript application built with Vite. It uses Zustand for local state, React Query for server state, Axios for API calls, Leaflet for mapping, SignalR for real-time communication, and Framer Motion for animation.

The major frontend areas include pages, reusable components, contexts, stores, services, and bilingual translation files.

## 2. Backend Architecture

The backend follows a three-layer Clean Architecture layout:

- `ReliefConnect.API`: controllers, SignalR hub, middleware, background services.
- `ReliefConnect.Core`: entities, DTOs, enums, interfaces.
- `ReliefConnect.Infrastructure`: EF Core data layer, repositories, and infrastructure services.

## 3. Database Architecture

The database uses PostgreSQL with PostGIS. The system relies on both relational models and geospatial queries. Spatial filters are central to ping retrieval and priority-zone logic.

## 4. Real-Time Architecture

Real-time SOS updates use SignalR through the `SOSAlertHub`. The hub is mapped at `/hubs/sos-alerts` and is intended to broadcast alert state to connected clients.

## 5. Background Processing Architecture

The application registers hosted services for:

- `PingFlagMonitorService`,
- `SoftDeleteCleanupService`,
- `TokenCleanupService`.

Hangfire is also configured, but it is only enabled when the connection setup is compatible. The project memory notes and runtime logic explicitly warn that Supabase pooler connections can break Hangfire bootstrap and distributed locks.

## 6. Core Identity and Trust Entities

Key identity entities include `ApplicationUser`, `BlacklistedToken`, and `ApiKey`. `ApplicationUser` stores role, verification state, suspension state, Google identity, contact details, and token-related metadata.

## 7. Map and Relief Entities

Key map entities include `Ping`, `PingFlag`, `Zone`, and `SupplyItem`. `Ping` is the main SOS object. `PingFlag` holds blinking and unconfirmed state. `Zone` stores GeoJSON boundaries and risk level. `SupplyItem` stores supply locations and quantities.

## 8. Social Entities

Key social entities include `Post`, `Comment`, `Reaction`, and `Report`. Posts are categorized, comments are attached to posts, reactions are user-scoped, and reports drive moderation.

## 9. Chatbot and Notification Entities

`Conversation` and `Message` store chatbot history. `Notification` stores user-targeted system messages. `SystemAnnouncement` stores broadcast announcements with optional expiry.

## 10. Administrative Audit Entities

`SystemLog` stores audit data and supports parent-child batch hierarchy. This is a major part of how the project records moderation and user-management operations.

## 11. Sponsorship Entity Status

`HelpOffer` exists in the broader schema and documentation, but current sponsor controller behavior still lags behind the full entity design. Documentation consumers should treat `HelpOffer` as partially realized in the current application flow.

## 12. Authentication API Areas

The authentication surface includes registration, email verification, resend verification code, forgot password, reset password, change password, login, Google login, logout, current-user profile, profile update, role verification, and controlled access to a person in need’s contact info.

## 13. Relief Map API Areas

The relief map surface includes listing pings, reading ping details, creating pings, changing ping status, confirming safety, listing pings by user, and deleting pings.

## 14. Social API Areas

The social surface includes listing posts, reading a post, uploading an image, creating a post, toggling reactions, reading comments, adding comments, reading a user wall, and deleting a post.

## 15. Chatbot API Areas

The chatbot surface includes creating a conversation, sending a message to a conversation, and listing messages for a conversation.

## 16. Role-Specific API Areas

Role-specific APIs include volunteer task browsing, volunteer task acceptance, sponsor case search, sponsor help offers, notifications, announcements, zones, supplies, and admin management controllers.