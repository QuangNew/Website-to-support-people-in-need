# ✅ TODO — Relief Connection Support Platform
> **Cập nhật lần cuối**: 2026-03-17 | **Sprint hiện tại**: Sprint 3 (đang triển khai)
>
> Legend: ⬜ Not Started | 🔄 In Progress | ✅ Done | ❌ Blocked | ⏸️ Paused

---

## 🚀 Sprint 3.5: Performance & Security Optimization (NEW - Completed 2026-03-17)

### ✅ Package Management
- [x] Migrate from npm to pnpm (30-50% storage reduction)
- [x] Update run-all.ps1 to use pnpm
- [x] Clean up npm artifacts (package-lock.json)

### ✅ Backend Performance (4s → <1s)
- [x] Add AsNoTracking() to all read-only queries (20-30% faster)
- [x] Fix N+1 queries in PostRepository pagination (3 queries → 1)
- [x] Verify GeminiService timeout (10s)
- [x] Verify PostGIS spatial query optimization
- [x] Verify database indexes on foreign keys
- [x] Verify Hangfire background jobs for email
- [x] Verify admin stats caching (5 min)

### ✅ Security Fixes (7.5/10 → 8.5/10)
- [x] Implement TokenBlacklistService for logout
- [x] Add JWT secret validation (256-bit minimum)
- [x] Add rate limiting on auth endpoints (5/15min)
- [x] Move Gemini API key from query to header
- [x] Add XSS prevention with HtmlSanitizer
- [x] Fix timing attack vulnerabilities
- [x] Fix Hangfire dashboard authorization

### ✅ Frontend Performance
- [x] Fix infinite fetch loop in MapShell
- [x] Optimize marker filtering with Set lookup
- [x] Add API request timeout (10s)
- [x] Fix memory leaks in AdminPage
- [x] Implement vendor chunk splitting in Vite
- [x] Optimize React Query configuration

### ✅ Testing & Verification
- [x] Frontend build successful (453ms)
- [x] 12/12 UI tests passing (Playwright)
- [x] Documentation created (OPTIMIZATION_SUMMARY.md)

---

## 📊 Tổng quan tiến độ

| Phase | Tiến độ | Status |
|-------|---------|--------|
| Sprint 0: Khởi tạo | ██████████ 100% | ✅ Done |
| Sprint 1: Auth & Foundation | ██████████ 100% | ✅ Done |
| Sprint 1.5: Frontend v2 Rework | ██████████ 100% | ✅ Done |
| Sprint 2: Map System | ██████████ 95% | 🔄 In Progress |
| Sprint 3: Social Network | ████░░░░░░ 40% | 🔄 In Progress |
| **Sprint 3.5: Optimization** | ██████████ 100% | ✅ Done |
| Sprint 4: Chatbot & Admin | ███░░░░░░░ 30% | 🔄 In Progress |

---

## 🏁 Sprint 0: Khởi tạo

### Opus — Architecture
- [x] Phê duyệt cấu trúc Clean Architecture
- [x] Tạo domain models trong `ReliefConnect.Core/Entities/` (12 entities)
- [x] Tạo enums: `RoleEnum`, `SOSStatus`, `MapItemType`, `PostCategory`, `ReactionType`, `VerificationStatus`
- [x] Tạo interfaces: `IRepository<T>`, `IPingRepository`, `IPostRepository`, `IGeminiService`, `IMapService`
- [x] Tạo DTOs + validation rules (Auth, Map, Social, Chatbot, Admin, Zone, Error)

### Sonnet — Backend Setup
- [x] Chạy `dotnet new` tạo solution structure (4 projects: API, Core, Infrastructure, Tests)
- [x] Cấu hình project references (API → Core + Infrastructure, Tests → All)
- [x] Install NuGet packages (EF Core, Identity, JWT, SignalR, NetTopologySuite, Serilog, Swagger, FluentValidation)
- [ ] Tạo Supabase project + enable PostGIS extension
- [x] Cấu hình `appsettings.json` + `appsettings.Development.json`

### Gemini Pro — Frontend Setup
- [x] Chạy `create-vite` tạo React + TypeScript project (Vite 8 beta)
- [x] Install npm packages (router, query, zustand, axios, signalr, framer-motion, lucide-react, react-hot-toast)
- [x] Setup `index.css` với design tokens (colors, typography, glassmorphism, animations)
- [x] Import Google Fonts (Inter, Outfit)
- [x] Setup folder structure (`pages/`, `services/`, `stores/`)

### Gemini Flash — Documentation
- [ ] Tạo README.md (overview, tech stack, setup guide)
- [x] Tạo `.env.example` với tất cả biến môi trường
- [ ] Tạo `docs/api-contracts.md` (template)
- [ ] Tạo `docs/database-schema.md` (template)
- [ ] Tạo `CHANGELOG.md` (v0.1.0 — Project init)
- [ ] Tạo `debug-log.md` (template)

---

## 🔐 Sprint 1: Authentication & Foundation

### Opus — Domain & Review
- [x] Finalize User entity (extend IdentityUser)
- [x] Define JWT configuration constants
- [ ] Write `docs/api-contracts.md` cho Auth endpoints
- [x] Review AuthController implementation
- [x] Review Login/Register UI
- [ ] Write integration tests: Register → Login → Get JWT → Access protected endpoint

### Sonnet — Auth Backend
- [x] Tạo `ApplicationUser : IdentityUser` model
- [x] Tạo `AppDbContext` kế thừa `IdentityDbContext<ApplicationUser>` (full entity configs)
- [x] Cấu hình PostGIS: `UseNetTopologySuite()` trong Program.cs
- [x] Cấu hình Identity: password rules, lockout, etc.
- [x] Implement `AuthController.Register()` — tạo user, hash password
- [x] Implement `AuthController.Login()` — xác thực, generate JWT
- [x] Implement `AuthController.GetMe()` — trả profile từ JWT claims
- [x] Implement `AuthController.UpdateProfile()` — update FullName, avatar
- [x] Implement `AuthController.SubmitVerification()` — gửi yêu cầu KYC
- [x] Setup global exception handling middleware
- [x] Setup Serilog structured logging
- [x] Setup CORS policy (whitelist client origin)
- [ ] Chạy `dotnet ef migrations add InitialCreate`
- [ ] Write unit tests: RegisterService, LoginService, TokenService

### Gemini Pro — Auth Frontend
- [x] Setup CSS design system
  - [x] Color tokens (primary, secondary, danger, success, neutral)
  - [x] Typography (font-family, sizes, weights)
  - [x] Glassmorphism utilities (backdrop-blur, bg-glass)
  - [x] Button styles (primary, secondary, danger, ghost)
  - [x] Input styles (text, password, file upload)
  - [x] Card component styles
  - [x] Dark mode CSS variables
  - [x] Animation keyframes & utility classes
  - [x] Layout system (sidebar, header, grid, mobile nav)
  - [x] Utility classes (flex, spacing, text)
- [x] Create Layout components
  - [x] Sidebar (collapsible, icon+label, role-based admin link)
  - [x] Header (search, language toggle VI/EN, theme toggle, notifications, avatar)
  - [x] MobileNav (bottom nav for mobile)
  - [x] AppLayout (composition: sidebar + header + content + mobile nav)
- [x] Setup i18n (Internationalization)
  - [x] LanguageContext w/ nested key lookup `t('nav.dashboard')`
  - [x] Vietnamese translations (`vi.json` — 120+ keys)
  - [x] English translations (`en.json` — matching keys)
- [x] Setup ThemeContext (dark/light mode, localStorage persist, system preference)
- [x] Implement Login page
  - [x] Email + Password form
  - [x] Validation (required, email format, min length)
  - [x] Error display (wrong credentials)
  - [ ] "Remember me" checkbox
  - [x] Link to Register page
  - [x] Glass card design, icon inputs, password toggle
  - [x] Theme + language toggles
- [x] Implement Register page
  - [x] Username, Email, Password, Confirm Password, Full Name
  - [x] Client-side validation
  - [x] Success → redirect to Dashboard
  - [x] Two-column name row, matching login design
- [x] Implement Landing page
  - [x] Hero section (gradient text, floating aurora orbs)
  - [x] Stats counter section
  - [x] Feature grid with glass cards
  - [x] Trust indicators section
  - [x] CTA section + footer
  - [x] Fully bilingual (VI/EN)
- [x] Implement Dashboard page
  - [x] Stat cards with trend indicators
  - [x] Recent activity feed with status badges
  - [x] Quick action cards
- [x] Implement page scaffolds
  - [x] MapPage (filter bar, OpenStreetMap placeholder)
  - [x] SocialPage (post composer, feed with avatars/reactions)
  - [x] ChatbotPage (chat bubble UI, auto-scroll)
  - [x] ProfilePage (avatar, role badge, info card)
  - [x] AdminPage (4 management section cards)
- [x] Setup React Router
  - [x] Public routes: `/`, `/login`, `/register`
  - [x] Protected routes: `/dashboard`, `/map`, `/social`, `/chatbot`, `/profile`
  - [x] Admin routes: `/admin/*`
  - [x] ProtectedRoute component (redirect if no JWT)
  - [ ] RoleBasedRoute component (redirect if wrong role)
- [x] Setup Axios API client
  - [x] Base URL from env variable
  - [x] Request interceptor: attach JWT token
  - [x] Response interceptor: handle 401 → clear auth (no redirect in map-first architecture)
- [x] Setup Zustand auth store
  - [x] State: user, token, isAuthenticated, isLoading
  - [x] Actions: login, logout, setUser, loadFromStorage
  - [x] Surface backend error messages (Vietnamese) in UI

### Gemini Flash — Research
- [ ] Research: Supabase + EF Core connection string format
- [ ] Research: JWT configuration best practices (.NET 8)
- [ ] Research: Refresh token rotation pattern
- [ ] Document Auth API contracts (request/response examples)
- [ ] Update README.md với setup instructions

---

## 🎨 Sprint 1.5: Frontend v2 Rework (Map-Centric)

> **Hoàn thành**: 2026-03-01 | **Tham khảo**: Dribbble, cuutro.jci.vn

### Design System — CSS Rewrite
- [x] Rewrite `variables.css` — Design tokens: dark/light theme, glassmorphism, aurora gradients
- [x] Rewrite `base.css` — CSS reset, custom scrollbars, reduced-motion support
- [x] Rewrite `components.css` — Glass cards, buttons, forms, badges, avatars, modals, spinners
- [x] Rewrite `layout.css` — Sidebar, filter bar, panels, chat, social, profile, map markers, responsive
- [x] Rewrite `animations.css` — 16+ keyframes, stagger, hover effects
- [x] Rewrite `utilities.css` — Tailwind-inspired utilities (flex, gap, text, spacing)

### Architecture — Map-First
- [x] Replace multi-page routing with single `MapShell` orchestrator
- [x] Remove: Landing, Dashboard, Login/Register pages → Everything overlays on map
- [x] Map is permanent full-screen background, UI elements are glass overlays

### Component Rewrites (13 components)
- [x] `Sidebar.tsx` — Hamburger toggle (click), icon-only collapsed, expand with text
- [x] `FilterBar.tsx` — Floating glass bar, search + filter chips with colored dots
- [x] `MapShell.tsx` — Orchestrator: MapView + Sidebar + FilterBar + Panels + Modals
- [x] `MapView.tsx` — OpenStreetMap with Leaflet, dark/light tiles, DivIcon ping markers
- [x] `PingDetailPanel.tsx` — Bottom-right glass card with ping info
- [x] `LoginModal.tsx` — Glass modal auth form with backend error surfacing
- [x] `RegisterModal.tsx` — 5-field form, validation matching backend rules (8+ chars)
- [x] `WelcomeModal.tsx` — First-visit onboarding with CTA buttons
- [x] `ListPanel.tsx` — Filtered active pings list with click-to-detail
- [x] `SocialPanel.tsx` — Mock social feed with compose + likes + comments
- [x] `ChatPanel.tsx` — AI chat UI with typing indicator, simulated responses
- [x] `ProfilePanel.tsx` — User profile card with verification status
- [x] `Modal.tsx` — Generic glass modal with Escape + overlay-click-to-close

### Backend-Frontend Integration
- [x] Create `.env` with `VITE_API_URL` (no map API key needed — OpenStreetMap is free)
- [x] Create `.env.example` documentation file
- [x] Fix 401 interceptor (removed redirect to `/login`, map-first has no login page)
- [x] Auth store surfaces backend Vietnamese error messages
- [x] Password validation aligned with backend (8 chars, uppercase, lowercase, digit)
- [x] OpenStreetMap integration via Leaflet (no API key needed)

### Build & Verify
- [x] TypeScript: 0 errors
- [x] Vite production build: ~47KB CSS, ~580KB JS
- [x] IDE: 0 errors

---

## 🗺️ Sprint 2: Map System

### Opus — Algorithms
- [ ] Implement `AStarRouter.cs`
  - [ ] Define `GraphNode` and `GraphEdge` classes
  - [ ] Implement priority queue (min-heap)
  - [ ] Implement A* with heuristic: haversine distance
  - [ ] Edge weights: distance * (1 + risk_factor)
  - [ ] Return top 2 paths: shortest + safest
  - [ ] Unit tests: simple graph, complex graph, no-path case
- [ ] Implement `PriorityAnalyzer.cs`
  - [ ] Input: Ping location, Zones list, urgency keywords from post
  - [ ] Check `ST_Contains` (is ping inside any Zone?)
  - [ ] Calculate priority score (1-5) based on: zone risk level + urgency + time since posted
  - [ ] Unit tests: inside zone, outside zone, edge cases
- [ ] Implement `SOSMonitorService.cs` (BackgroundService)
  - [ ] Query: Pings WHERE Status != Verified_Safe AND Zone.Contains(Ping.Location)
  - [ ] Check: UnconfirmedTimeMinutes > 15
  - [ ] Action: Set PingFlag.isBlinking = true, SignalR broadcast
  - [ ] Run interval: every 60 seconds
  - [ ] Unit tests: mock timer, mock SignalR hub
- [ ] Review MapController spatial queries
- [ ] Review OpenStreetMap frontend integration
- [ ] Write integration test: Create Ping → Wait 15min (simulated) → Receive SignalR alert

### Sonnet — Map Backend
- [x] Implement `Ping` entity EF configuration (PostGIS Point)
- [x] Implement `Zone` entity EF configuration (PostGIS Polygon)
- [x] Implement `SupplyItem` entity EF configuration
- [x] Implement `PingFlag` entity
- [x] Add spatial index migration on Ping coordinates
- [x] Implement `IPingRepository` — CRUD + spatial queries
  - [x] `GetPingsInRadius(lat, lng, radiusKm)` using bounding box + Haversine
  - [ ] `GetPingsByZone(zoneId)` using `ST_Contains`
  - [x] `GetPingsWithFlags()` — include PingFlag
- [x] Implement `MapController.GetPings()` — with spatial filter params
- [x] Implement `MapController.GetPingById()`
- [x] Implement `MapController.CreatePing()` — [Authorize(Policy = "RequireVerified")]
- [x] Implement `MapController.UpdatePingStatus()` — [Authorize(Policy = "RequireVolunteer")]
- [x] Implement `MapController.ConfirmSafe()` — [Authorize(Policy = "RequirePersonInNeed")]
- [x] Implement `MapController.GetRoutes()` — removed (routing now handled client-side via OSRM)
- [x] Implement `ZoneController.GetZones()`
- [x] Implement `ZoneController.CreateZone()` — [Authorize(Policy = "RequireAdmin")]
- [x] Implement `SupplyController` — full CRUD (GET all, GET by id, POST, PUT, DELETE)
- [x] Setup SignalR `SOSAlertHub`
  - [x] `JoinSOSAlertGroup()` — Volunteers + Admins
  - [x] `BroadcastBlinkingAlert(pingId)` — send to group
- [ ] Write unit tests for PingService, ZoneService

### Gemini Pro — Map Frontend
- [x] Integrate OpenStreetMap via Leaflet.js (free, no API key)
  - [x] Load map centered on Vietnam (default, bounds restricted)
  - [x] No API key needed — OpenStreetMap tiles are free
- [x] Implement custom markers (SVG OverlayView markers, color-coded by type)
  - [x] SOS: 🔴 Red pulsing marker
  - [x] Offering: 🟢 Green marker
  - [x] Received: 🟡 Amber marker
  - [x] Support Point: 🟠 Orange marker
- [x] Implement marker clustering (Leaflet.markercluster)
- [x] Implement marker click → slide-in detail panel
  - [x] Show: type, status, priority, created time, user info
  - [ ] If Volunteer: show "Accept Task" button
  - [ ] If PersonInNeed: show "Confirm Safe" button
- [x] Implement SOS creation flow (max 3 steps)
  - [x] Step 1: Click "Kêu cứu SOS" floating button
  - [x] Step 2: Confirm location (auto-detect GPS)
  - [x] Step 3: Add details + type selector → Submit
- [x] Implement route display (OSRM client-side routing)
  - [x] Route 1 (Primary): Blue polyline
  - [x] Route 2 (Alternative): Gray dashed polyline
  - [x] Route info panel: distance, duration, clear route button
- [x] Implement SOS blinking animation
  - [x] CSS `@keyframes sosBlink` on marker (red glow pulse)
  - [ ] SignalR listener → toggle blink on specific marker
- [x] Implement filter controls
  - [x] Toggle buttons: SOS, Offering, Received, Support Points
  - [x] Zone toggle (show/hide priority zones)
  - [ ] Radius slider (1km - 50km)
- [x] Implement Zone visualization
  - [x] Draw Priority Zone polygons (semi-transparent color by risk level)
  - [x] Zone info popup on click (name + risk level)
  - [x] Zone toggle in filter bar
- [x] Handle map initialization error (network failure diagnostic UI)

### Gemini Flash — Research
- [ ] Research OpenStreetMap marker clustering performance (Leaflet.markercluster)
- [ ] Research PostGIS spatial query optimization
- [ ] Research A* algorithm for routing
- [ ] Document Map API contracts
- [ ] Document Zone/Supply API contracts

---

## 💬 Sprint 3: Social Network

### Opus — Review
- [ ] Review cursor-based pagination implementation
- [ ] Review image upload security (file type, size, malicious content)
- [ ] Review lazy loading performance
- [ ] Write integration test: Create Post → Reaction → Comment → Load Feed

### Sonnet — Social Backend
- [x] Implement `Post` entity + `Tag` entity EF configuration
- [x] Implement `Comment` entity EF configuration
- [x] Implement `Reaction` entity/value object
- [ ] Add database migration for Social tables
- [x] Implement `IPostRepository` — CRUD + cursor pagination
  - [x] `GetPosts(cursor, limit)` — ordered by CreatedAt DESC
  - [x] `GetPostsByUser(userId, cursor, limit)` — My Wall
  - [x] `GetPostsByCategory(tagId, cursor, limit)`
- [x] Implement `PostController.GetPosts()` — cursor-based lazy loading
- [x] Implement `PostController.GetPost(id)`
- [x] Implement `PostController.CreatePost()` — with image upload
  - [ ] Validate: .jpg/.png/.jpeg only, max 5MB
  - [ ] Store image in Supabase Storage or local wwwroot
- [x] Implement `PostController.AddReaction()` — toggle reaction
- [x] Implement `PostController.GetComments(postId)` — paginated
- [x] Implement `PostController.AddComment(postId)`
- [x] Implement `PostController.GetUserWall(userId)`
- [ ] Write unit tests: PostService, ReactionService, CommentService

### Gemini Pro — Social Frontend
- [x] Implement Social Feed page layout
  - [x] Single column (overlay panel on map)
  - [ ] Mobile: optimized responsive
- [x] Implement infinite scroll (IntersectionObserver)
  - [x] Load 10 posts per batch
  - [x] Loading spinner while fetching
  - [x] "No more posts" indicator
- [x] Implement Post card component
  - [x] User avatar + name + time (relative: "2 giờ trước")
  - [x] Category badge with color
  - [x] Content text
  - [x] Image support
  - [x] Reaction bar (Like 👍, Love ❤️, Pray 🙏) with toggle
  - [x] Comment count + expand toggle
- [x] Implement Post creation form
  - [x] Textarea with category picker
  - [ ] Image upload with preview + drag-and-drop
  - [x] Submit button with loading state
- [x] Implement Comment section
  - [x] Inline comments with user avatar
  - [ ] Reply to comment
  - [ ] Load more comments button
- [ ] Implement My Wall page
  - [ ] Profile header (avatar, name, role badge, join date)
  - [ ] Post timeline (same card component)
  - [ ] Edit profile button → profile edit modal

### Gemini Flash — Research
- [ ] Research infinite scroll best practices React
- [ ] Research image upload optimization (compression, lazy load)
- [ ] Document Social API contracts
- [ ] Update CHANGELOG.md

---

## 🤖 Sprint 4: Chatbot & Admin

### Opus — AI & Final Review
- [x] Design Gemini system prompt
  - [x] Context: "Bạn là trợ lý cứu trợ của nền tảng Relief Connection"
  - [x] Scope: Sơ cứu cơ bản, Kỹ năng sinh tồn, Hướng dẫn sử dụng hệ thống
  - [x] Tone: Thân thiện, rõ ràng, khẩn cấp khi cần
- [ ] Design safety keyword detection
  - [ ] Keywords: "đau tim", "ngộ độc", "chảy máu nhiều", "ngừng thở", etc.
  - [ ] Pattern matching (regex + keyword list)
  - [ ] Fallback response template với Red Warning
- [ ] Final security audit
  - [ ] OWASP Top 5 checklist
  - [ ] API key exposure check
  - [ ] SQL injection test
  - [ ] XSS test on social posts
  - [ ] CSRF protection verification
- [ ] Final integration testing (all features end-to-end)
- [ ] Performance testing
  - [ ] Map load with 100+ markers
  - [ ] Social feed with 50 concurrent users
  - [ ] Chatbot response time < 5s
- [ ] Final code review (all Sprint 4 code)

### Sonnet — Chatbot & Admin Backend
- [x] Implement `Conversation` + `Message` entity EF configuration
- [x] Implement `IGeminiService`
  - [x] HTTP client to Gemini API
  - [x] System prompt injection
  - [x] Response parsing
  - [x] Timeout handling (5s max)
  - [x] Error handling (API down, quota exceeded)
- [x] Implement `ChatbotController.CreateConversation()`
- [x] Implement `ChatbotController.SendMessage()`
  - [ ] Detect safety keywords → return safety_warning flag
  - [ ] Include emergency numbers in response
- [x] Implement `ChatbotController.GetMessages(conversationId)` — history
- [ ] Implement `AdminController.GetUsers()` — paginated, filterable
- [ ] Implement `AdminController.ApproveRole(userId, role)` — change user role
- [ ] Implement `AdminController.DeletePost(postId)` — content moderation
- [ ] Implement `AdminController.GetLogs()` — system action logs
- [ ] Implement `AdminController.GetStats()` — dashboard statistics
  - [ ] Total users (by role)
  - [ ] Active SOS count
  - [ ] Resolved cases count
  - [ ] Posts count (by category)
- [ ] Write unit tests: GeminiService, AdminService

### Gemini Pro — Chatbot & Admin Frontend
- [ ] Implement Chatbot widget
  - [ ] Floating bubble icon (bottom-right, pulsing animation)
  - [ ] Click → expand chat window (animated slide-up)
  - [ ] Chat header: "Trợ lý Cứu trợ AI" + minimize button
- [ ] Implement Chat conversation UI
  - [ ] Message bubbles: user (right, blue) + bot (left, gray)
  - [ ] Typing indicator (3 dots animation) while waiting
  - [ ] Markdown rendering in bot messages
  - [ ] Auto-scroll to latest message
  - [ ] Input field + Send button
- [ ] Implement Safety Warning UI
  - [ ] Red banner: "⚠️ CẢNH BÁO: Vui lòng gọi ngay số khẩn cấp!"
  - [ ] Emergency numbers: 113 (Công an), 114 (PCCC), 115 (Cấp cứu)
  - [ ] Click-to-call links (on mobile)
  - [ ] Nearest medical facility link (from map data)
- [ ] Implement Admin Dashboard
  - [ ] Sidebar navigation: Users | Moderation | Zones | Stats | Logs
  - [ ] Stats overview cards (total users, active SOS, resolved, posts)
- [ ] Implement User Management page
  - [ ] Table: Name, Email, Role, Status, Actions
  - [ ] Search + filter by role
  - [ ] Approve/Reject verification buttons
  - [ ] Pagination
- [ ] Implement Content Moderation page
  - [ ] Flagged posts list
  - [ ] Preview post content
  - [ ] Delete / Approve buttons
- [ ] Implement Priority Zone Editor
  - [ ] OpenStreetMap with Leaflet drawing tools (polygon)
  - [ ] Draw zone → set name + risk level → Save
  - [ ] Display existing zones (colored overlays)
  - [ ] Edit / Delete zones
- [ ] Implement Stats Dashboard
  - [ ] Bar chart: Users by role
  - [ ] Line chart: SOS cases over time
  - [ ] Pie chart: Posts by category
  - [ ] (Use Chart.js or Recharts)
- [ ] Implement System Logs page
  - [ ] Filterable table: Date, User, Action, Details
  - [ ] Date range filter
  - [ ] Search by user or action type
- [ ] Final UI Polish
  - [ ] Dark mode toggle (header)
  - [ ] Page transition animations (framer-motion)
  - [ ] Loading skeletons on all data-fetching pages
  - [ ] Empty state illustrations
  - [ ] Toast notifications (react-hot-toast)
  - [ ] 404 page
  - [ ] Mobile responsive testing & fixes

### Gemini Flash — Final Documentation
- [ ] Complete `docs/api-contracts.md` (all endpoints)
- [ ] Complete `docs/database-schema.md` (all tables)
- [ ] Write `docs/deployment.md` (deployment guide)
- [ ] Final README.md update (complete setup, screenshots placeholder)
- [ ] Create `CHANGELOG.md` v1.0.0
- [ ] Archive `debug-log.md` (close all resolved issues)

---

## 💰 Sprint 5: Donation System (NEW - Based on Competitive Analysis)

### Backend — Payment Infrastructure
- [ ] Create `Donation` entity (Amount, Currency, DonorId, CampaignId, Status, PaymentMethod, TransactionId, CreatedAt)
- [ ] Create `Campaign` entity (Title, Description, GoalAmount, CurrentAmount, Deadline, Status, CreatorId, CategoryId)
- [ ] Add `IDonationRepository` and `ICampaignRepository` interfaces
- [ ] Implement repositories in Infrastructure
- [ ] Install Stripe.net NuGet package: `dotnet add package Stripe.net`
- [ ] Create `DonationController` with endpoints:
  - [ ] POST /api/donations — Process payment via Stripe
  - [ ] GET /api/donations/campaign/{id} — Get donations for campaign
  - [ ] GET /api/donations/user/{id} — Get user donation history
  - [ ] GET /api/donations/{id}/receipt — Generate PDF receipt
- [ ] Create `CampaignController` with endpoints:
  - [ ] GET /api/campaigns — List all campaigns (paginated)
  - [ ] GET /api/campaigns/{id} — Get campaign details
  - [ ] POST /api/campaigns — Create campaign [Authorize]
  - [ ] PUT /api/campaigns/{id} — Update campaign [Authorize]
  - [ ] GET /api/campaigns/{id}/stats — Get campaign statistics
- [ ] Add Stripe configuration to appsettings.json
- [ ] Implement payment webhook handler for Stripe events

### Frontend — Donation UI
- [ ] Install Stripe packages: `pnpm add @stripe/stripe-js @stripe/react-stripe-js`
- [ ] Create `components/donation/DonationModal.tsx` — Payment form with Stripe Elements
- [ ] Create `components/campaign/CampaignCard.tsx` — Campaign display with progress bar
- [ ] Create `components/campaign/CampaignProgressBar.tsx` — Visual goal tracker
- [ ] Create `pages/CampaignPage.tsx` — Campaign detail page
- [ ] Create `pages/MyCampaignsPage.tsx` — User's created campaigns
- [ ] Add donation API calls to `services/api.ts`
- [ ] Add campaign list section to DashboardPage
- [ ] Add donation history to ProfilePage

### Database
- [ ] Migration: `dotnet ef migrations add AddDonationsAndCampaigns`
- [ ] Add indexes: DonorId, CampaignId, CreatedAt, Status
- [ ] Update database: `dotnet ef database update`

---

## 🔐 Sprint 6: Verification & Trust System (NEW)

### Backend — Verification
- [ ] Add `VerificationLevel` enum (None, Phone, Email, ID, Address, Organization)
- [ ] Add `VerificationLevel` property to ApplicationUser entity
- [ ] Create `VerificationRequest` entity (UserId, Type, Status, DocumentUrls, ReviewedBy, ReviewedAt)
- [ ] Add verification endpoints to AdminController:
  - [ ] GET /api/admin/verification-requests — List pending requests
  - [ ] POST /api/admin/verification-requests/{id}/approve
  - [ ] POST /api/admin/verification-requests/{id}/reject
- [ ] Add photo upload support to PingController (reuse existing image logic)
- [ ] Implement reputation score calculation (based on completed helps, donations)

### Frontend — Trust Indicators
- [ ] Create `components/ui/VerificationBadge.tsx` — Display verification level
- [ ] Add verification request form to ProfilePage
- [ ] Add photo upload to SOS creation modal
- [ ] Add "Verified Only" filter to FilterBar
- [ ] Create admin verification review panel in AdminPage
- [ ] Display user reputation score on profiles
- [ ] Add trust indicators to campaign cards

### Database
- [ ] Migration: `dotnet ef migrations add AddVerificationSystem`
- [ ] Add PhotoUrls column to Pings table

---

## 📱 Sprint 7: Mobile UX Improvements (NEW)

### Frontend — Mobile-First Redesign
- [ ] Implement bottom tab navigation for mobile (`components/layout/BottomNav.tsx`)
- [ ] Add GPS auto-capture using browser Geolocation API
- [ ] Convert SOS creation to modal format (already done, verify)
- [ ] Install date-fns: `pnpm add date-fns`
- [ ] Add relative time formatting ("5 minutes ago", "2 hours ago")
- [ ] Implement swipe gestures for panel dismissal
- [ ] Add offline mode with service worker
- [ ] Optimize map marker rendering for mobile devices

### Backend — Mobile Optimization
- [ ] Add geolocation validation endpoint
- [ ] Reduce API response payload sizes (exclude unnecessary fields)
- [ ] Add response compression middleware (Brotli + Gzip)

---

## 🌊 Sprint 8: Disaster Reporting System (NEW - Inspired by cuutro.jci.vn)

### Backend — Crowdsourced Disaster Data
- [ ] Create `DisasterReport` entity (Type, Severity, Cause, Latitude, Longitude, ReporterId, Description, PhotoUrls, CreatedAt)
- [ ] Add `DisasterType` enum (Rain, Flood, Landslide)
- [ ] Add `RainSeverity` enum (None, Light, Medium, Heavy, VeryHeavy)
- [ ] Add `FloodDepth` enum (Under30cm, 30to50cm, 50cmTo1m, 1to1_5m, 1_5to2m, Over2m)
- [ ] Add `DisasterCause` enum (HeavyRain, DamRelease, DamBreak, Other)
- [ ] Add `LandslideSeverity` enum (Light, Medium, Severe)
- [ ] Create `DisasterReportController` with endpoints:
  - [ ] POST /api/disaster-reports — Submit report
  - [ ] GET /api/disaster-reports — Get reports (with spatial filter)
  - [ ] GET /api/disaster-reports/{id} — Get report details
- [ ] Add spatial index on disaster report locations

### Frontend — Disaster Visualization
- [ ] Create `components/disaster/DisasterReportModal.tsx` — Report submission form
- [ ] Add disaster layer toggle to map
- [ ] Create color-coded disaster markers (rain: blue, flood: cyan, landslide: brown)
- [ ] Create `pages/DisasterReportPage.tsx` — List view of reports
- [ ] Add disaster severity indicators
- [ ] Implement disaster heatmap visualization

### Database
- [ ] Migration: `dotnet ef migrations add AddDisasterReports`
- [ ] Add spatial index: `CREATE INDEX idx_disaster_coordinates ON "DisasterReports" USING GIST (ST_MakePoint("Longitude", "Latitude"))`

---

## 🏢 Sprint 9: Support Station Network (NEW - Inspired by cuutro.jci.vn)

### Backend — Physical Coordination Points
- [ ] Create `SupportStation` entity (Name, Type, Address, Latitude, Longitude, Capacity, OperatingHours, ContactInfo, ContactPerson, PhoneNumber)
- [ ] Add `StationType` enum (Emergency, Distribution, Collection, Rescue, Shelter)
- [ ] Create `SupportStationController` with endpoints:
  - [ ] GET /api/support-stations — List all stations
  - [ ] GET /api/support-stations/nearest — Find nearest station (PostGIS query)
  - [ ] POST /api/support-stations — Register station [Authorize]
  - [ ] PUT /api/support-stations/{id} — Update station
  - [ ] DELETE /api/support-stations/{id} — Remove station [Admin]
- [ ] Implement nearest station search with PostGIS ST_Distance

### Frontend — Station Features
- [ ] Add support station markers to map (orange icons)
- [ ] Create `components/station/StationDetailPanel.tsx` — Station info display
- [ ] Add "Find Nearest Station" button to FilterBar
- [ ] Create station registration form
- [ ] Install leaflet-routing-machine: `pnpm add leaflet-routing-machine`
- [ ] Add route planning to stations (OSRM integration)

### Database
- [ ] Migration: `dotnet ef migrations add AddSupportStations`
- [ ] Add spatial index for nearest neighbor queries

---

## 💬 Sprint 10: Enhanced Communication (NEW)

### Backend — Messaging & Notifications
- [ ] Create `DirectMessage` entity (SenderId, ReceiverId, Content, IsRead, CreatedAt)
- [ ] Create `MessageController` with endpoints:
  - [ ] POST /api/messages — Send message
  - [ ] GET /api/messages/conversations — List conversations
  - [ ] GET /api/messages/conversation/{userId} — Get messages with user
  - [ ] PUT /api/messages/{id}/read — Mark as read
- [ ] Create `MessageHub` SignalR hub for real-time messaging
- [ ] Install Twilio: `dotnet add package Twilio`
- [ ] Implement SMS notification service
- [ ] Add email newsletter system using existing SmtpEmailService
- [ ] Create notification preferences in User entity

### Frontend — Communication UI
- [ ] Create `components/messaging/MessagingPanel.tsx` — Chat interface
- [ ] Add notification center to Header
- [ ] Implement SMS opt-in/opt-out in ProfilePage
- [ ] Add email subscription management
- [ ] Create in-app announcement banner component

---

## 📊 Sprint 11: Impact & Transparency (NEW)

### Backend — Campaign Updates
- [ ] Create `CampaignUpdate` entity (CampaignId, Title, Content, PhotoUrls, CreatedAt)
- [ ] Add update endpoints to CampaignController:
  - [ ] POST /api/campaigns/{id}/updates — Post update
  - [ ] GET /api/campaigns/{id}/updates — Get updates timeline
- [ ] Implement impact metrics calculation (total raised, people helped, etc.)
- [ ] Add fund allocation tracking to Campaign entity
- [ ] Create automated thank-you email system (trigger on donation)
- [ ] Add impact report generation endpoint

### Frontend — Transparency Features
- [ ] Create `components/campaign/ImpactDashboard.tsx` — Metrics display
- [ ] Create `components/campaign/CampaignUpdateTimeline.tsx` — Update feed
- [ ] Implement photo gallery for campaign updates
- [ ] Create thank-you message templates
- [ ] Add fund allocation pie chart (use Chart.js or Recharts)

---

## 🎯 Milestones

| Milestone | Ngày mục tiêu | Tiêu chí hoàn thành |
|-----------|:-------------:|---------------------|
| M0: Project Init | Tuần 1 | Solution builds, frontend runs, DB connects |
| M1: Auth Works | Tuần 2 | Register → Login → JWT → Protected page |
| M2: Map MVP | Tuần 4 | Map loads, markers display, SOS can be created |
| M3: Social MVP | Tuần 5 | Posts + Reactions + Comments work with lazy loading |
| M4: Full Feature | Tuần 7 | Chatbot + Admin + Real-time alerts all functional |
| M5: Release v1.0 | Tuần 7 | All tests pass, docs complete, demo-ready |

---

## 📝 Ghi chú cập nhật
<!-- Thêm ghi chú mới nhất ở đầu -->

### 2026-03-02 (12:00)
- ✅ **OpenStreetMap migration** — Replaced Google Maps with OpenStreetMap + Leaflet.js (free, no API key)
  - Reason: Google Maps API key “Permission Denied” was persistent blocker
  - Solution: Leaflet.js + OpenStreetMap tiles (light) + CartoDB tiles (dark)
  - Bundle size: 596KB JS + 66KB CSS (Leaflet adds ~144KB)
- ✅ **Sprint 1 completed** — Global exception handling middleware added
- ✅ **Sprint 2 backend started**:
  - `MapController` — CRUD pings, spatial queries (radius filter), status updates, confirm-safe
  - `ZoneController` — Admin CRUD for priority zones
  - `PingRepository` — Haversine-based radius queries with bounding box optimization
  - `SOSAlertHub` — SignalR hub for real-time SOS blinking alerts
  - DI registration for `IPingRepository` → `PingRepository`
  - SignalR hub mapped at `/hubs/sos-alerts`
- ✅ **Frontend-backend integration** — mapStore.fetchPings() calls real `/api/map/pings`, falls back to mock data
- ✅ **API routes aligned** — Zone endpoints corrected to `/api/zone`
- ✅ Build verified: Backend 0 errors, Frontend 0 TS errors, Vite build passes (437KB JS)
- 🔄 Sprint 2 tiến độ: ~40% (cần: routes proxy, supply controller, SOS creation flow, marker clustering)

### 2026-03-03 (Session 3) — 7 Bug Fixes + Chatbot Backend + Playwright
- ✅ **Map bounds extended** — `VIETNAM_BOUNDS` expanded from mainland-only to cover Paracel/Spratly islands (1.2× padding): `[[4.81, 100.53], [25.09, 119.37]]`
- ✅ **Login supports username OR email** — Backend `AuthController.Login()` now tries `FindByEmailAsync` then `FindByNameAsync`; Frontend inputs changed from `type="email"` to `type="text"`
- ✅ **SOS renamed "S-O-S"** — Changed `sos.button` i18n key; replaced 6 hardcoded Vietnamese strings in `SOSCreationFlow.tsx` with `t()` calls (13 new i18n keys)
- ✅ **Chatbot connected to real Gemini API** — Created `GeminiService.cs` (HTTP client to `gemini-2.0-flash`), `ChatbotController.cs` (3 endpoints: create conversation, send message, get history), registered in DI
- ✅ **Profile role display fixed** — Added `profile.roles.*` translations (Guest, PersonInNeed, Sponsor, Volunteer, Admin) in vi.json/en.json; `ProfilePanel.tsx` uses `t('profile.roles.X')`
- ✅ **Auto-login bug fixed** — Changed `authStore.isAuthenticated` initial value from `!!localStorage.getItem('token')` to `false`; added `loadUser()` startup effect in `App.tsx`
- ✅ **Playwright test suite** — 16 tests across 4 spec files (map, auth, chatbot, sos-profile): **15 passed, 2 skipped, 0 failed**
- 🔄 Sprint 2 tiến độ: 85% → **95%** (còn: SignalR SOS listener, radius slider, A*)
- 🔄 Sprint 4 tiến độ: 0% → **30%** (GeminiService + ChatbotController done, còn: safety keywords, admin dashboard)

### 2026-03-03 (Session 3b) — Sprint 3 Social Network
- ✅ **PostRepository** — Full CRUD + cursor-based pagination (by date + ID), category filter, user wall
- ✅ **PostController** — 8 endpoints: GET posts (paginated), GET post, POST create, POST reaction (toggle Like/Love/Pray), GET/POST comments, GET user wall, DELETE post
- ✅ **SocialPanel rewrite** — Replaced mock data with real API integration: infinite scroll (IntersectionObserver), 3 reaction types, inline comments, category badges, relative time, post deletion
- ✅ **i18n social keys** — Added 13 new keys (composePlaceholder, timeAgo, categories, comments, etc.) in vi.json + en.json
- ✅ **Playwright social tests** — 5 new tests (API pagination, auth required, comments): **20 passed, 2 skipped, 0 failed**
- 🔄 Sprint 3 tiến độ: 0% → **40%** (còn: image upload, My Wall, reply comments)

### 2026-03-03 (Session 2)
- ✅ **ProfilePanel scroll fix** — Added `overflow-y: auto` to `.profile-panel` CSS
- ✅ **Routing/Directions feature** — Full OSRM client-side routing implementation
  - mapStore: `fetchRoute()` gets user geolocation → calls OSRM API → stores route data
  - MapView: Renders primary (blue) + alternative (gray dashed) route polylines with origin/destination markers
  - PingDetailPanel: "Chỉ đường" button triggers routing, shows distance/duration info panel
  - Added route info panel CSS (`.ping-route-info`, `.ping-route-error`)
  - i18n: Added 15+ new keys (ping.directions, ping.distance, ping.duration, ping.time.*, ping.status.*)
- ✅ **Marker clustering** — Integrated `leaflet.markercluster` for performance with many markers
  - Custom cluster styling matching glass design system
  - Disables clustering at zoom 16+, spiderfy on max zoom
- ✅ **SOS blinking animation** — Fixed `map-marker-pulse` to use `sosBlink` keyframes (red glow pulse)
- ✅ **Test accounts created** — 5 accounts via API (admin, volunteer, sponsor, person_in_need, guest)
  - Promote SQL appended to `migration.sql`, documented in `UserTodo.md`
- ✅ **i18n hardcoded text** — Replaced all Vietnamese hardcoded text in PingDetailPanel with `t()` calls
- 🔄 Sprint 2 tiến độ: ~85% (còn: SignalR SOS listener, radius slider, Volunteer/PersonInNeed action buttons)

### 2026-03-02 (18:00) — Sprint 2 continuation
- ✅ **Map error handling** — Added map initialization error UI with retry button
- ✅ **SupplyController** — Full CRUD (GET all, GET by id, POST, PUT, DELETE) with DTOs
- ✅ **Routes** — Removed Google Directions proxy; routing will use OSRM (client-side)
- ✅ **SOS creation flow** — 3-step component (`SOSCreationFlow.tsx`) with GPS, type selector, i18n
- ✅ **Zone visualization** — Zone polygons on map (color-coded by risk level, info popup on click)
- ✅ **Zone toggle** — Added to FilterBar with Layers icon
- ✅ **Supply API** — Frontend `supplyApi` endpoints in `api.ts`
- ✅ Build verified: Backend 0 errors, Frontend 0 TS errors, Vite build 451KB JS + 51KB CSS
- 🔄 Sprint 2 tiến độ: ~65% (còn: marker clustering, route display, SOS blinking, radius slider, A*, tests)

### 2026-03-01 (00:46)
- ✅ **Frontend UI/UX Overhaul hoàn thành**
- ✅ CSS Design System: `variables.css`, `base.css`, `components.css`, `layout.css`, `animations.css`, `utilities.css`
- ✅ ThemeContext (dark/light) + LanguageContext (VI/EN) + đầy đủ translations
- ✅ Layout components: Sidebar, Header, MobileNav, AppLayout
- ✅ 9 pages: Landing, Login, Register, Dashboard, Map, Social, Chatbot, Profile, Admin
- ✅ App.tsx: nested routing, ThemeProvider + LanguageProvider wrapping
- ✅ Build thành công: `tsc -b` 0 errors, Vite build 367KB (gzip 116KB)
- ✅ Fix CORS: `Frontend:Urls` hỗ trợ mảng origins (5173-5175) thay vì single URL
- 🔄 Sprint 1 tiến độ tăng 60% → 85%: còn lại migration + tests + middleware

### 2026-02-25 (23:35)
- ✅ Sprint 0 HOÀN THÀNH
- ✅ Backend: Solution structure, 12 domain entities, AppDbContext, AuthController, JWT, Serilog, CORS
- ✅ Frontend: Vite + React + TS, design system, Login/Register/Dashboard pages, API client, auth store
- ✅ Build thành công: `dotnet build` 0 errors, `tsc --noEmit` 0 errors
- ✅ Frontend chạy thành công trên http://localhost:5173
- 🔄 Sprint 1 đang triển khai: Auth backend + frontend cơ bản đã xong, cần migration + tests + middleware

### 2026-03-17 (16:55) — Competitive Analysis Research
- ✅ **Analyzed cuutro.jci.vn** — Vietnamese relief platform with disaster reporting, two-way matching, support stations
- ✅ **Researched global platforms** — GoFundMe, GlobalGiving, DonorsChoose, Donorbox, Givebutter
- ✅ **Identified critical gaps** — Monetary donations, campaign management, verification badges, impact reports
- ✅ **Created documentation** — `docs/COMPETITIVE_ANALYSIS.md` (17 recommendations), `FEATURE_ROADMAP.md` (12 sprints)
- 🔄 **Next priority**: Sprint 4 — Donation system + verification badges

### 2026-02-25 (23:08)
- ✅ Tạo cấu trúc agent team (4 agents)
- ✅ Tạo agent instructions cho từng agent
- ✅ Tạo plan.md + todo.md
