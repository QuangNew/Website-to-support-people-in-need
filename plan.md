# 📋 PROJECT PLAN — Relief Connection Support Platform
> **Version**: 1.1 | **Date**: 2026-03-01 | **Team**: 4 AI Agents | **Duration**: 7 tuần (15 tuần semester)

---

## 1. Tổng quan dự án

| Thông tin | Chi tiết |
|-----------|----------|
| **Tên dự án** | Website Hỗ trợ Kết nối Cứu trợ với những người có hoàn cảnh khó khăn |
| **Loại** | Full-Stack Web Application |
| **Backend** | ASP.NET Core 10, Entity Framework Core 10, SignalR |
| **Frontend** | React 18 + TypeScript + Vite |
| **Database** | Supabase (PostgreSQL 15+ / PostGIS) |
| **APIs** | OpenStreetMap + Leaflet.js (Map), Google Gemini API (Chatbot) |
| **Architecture** | Clean Architecture (Core → Infrastructure → API) |
| **Trường** | Đại học Bách khoa Đà Nẵng (DUT) |

---

## 2. Hệ thống tính năng chính

### Feature 1: 🗺️ Relief Map & Routing System (Priority: HIGH)
| REQ ID | Mô tả | Độ phức tạp | Agent phụ trách |
|--------|--------|:-----------:|-----------------|
| REQ-MAP-01 | Hiển thị marker phân biệt (SOS=Đỏ, Sponsor=Xanh, Kho=Icon, Nơi trú ẩn=Icon) | Medium | Gemini Pro |
| REQ-MAP-02 | Chỉ Verified Users (PersonInNeed, Sponsor) được ghim vị trí lên bản đồ | Medium | Sonnet + Gemini Pro |
| REQ-MAP-03 | Chỉ đường turn-by-turn, tối thiểu 2 lộ trình (Ngắn nhất vs An toàn nhất), thuật toán A* | **High** | **Opus** (algorithm) + Sonnet (API) |
| REQ-MAP-04 | Phân tích ưu tiên cứu trợ tự động (Geofencing + Urgency) | **High** | **Opus** |
| REQ-MAP-05 | Cảnh báo SOS nhấp nháy khi user trong Vùng ưu tiên chưa xác nhận an toàn >15 phút | **High** | **Opus** (logic) + Sonnet (SignalR) + Gemini Pro (UI) |

### Feature 2: 💬 Community Social Network (Priority: HIGH)
| REQ ID | Mô tả | Độ phức tạp | Agent phụ trách |
|--------|--------|:-----------:|-----------------|
| REQ-SOC-01 | Đăng bài + Phân loại (Gia cảnh / Bệnh tật / Giáo dục) | Medium | Sonnet + Gemini Pro |
| REQ-SOC-02 | Tương tác: Reactions (Like, Love, Pray) + Comments | Medium | Sonnet + Gemini Pro |
| REQ-SOC-03 | Trang cá nhân (My Wall) hiển thị lịch sử bài viết | Low | Gemini Pro |

### Feature 3: 🤖 AI Virtual Assistant — Gemini Chatbot (Priority: LOW)
| REQ ID | Mô tả | Độ phức tạp | Agent phụ trách |
|--------|--------|:-----------:|-----------------|
| REQ-BOT-01 | Tích hợp Google Gemini API, phản hồi < 5 giây | Medium | Sonnet |
| REQ-BOT-02 | System Prompt: Trợ lý cứu trợ (sơ cứu, sinh tồn, hướng dẫn hệ thống) | Medium | **Opus** (prompt design) |
| REQ-BOT-03 | Safety Fallback: Phát hiện từ khóa nguy hiểm → Cảnh báo Đỏ + Số khẩn cấp (113/114/115) | **High** | **Opus** (logic) + Sonnet (API) + Gemini Pro (UI) |

### Hệ thống phụ trợ
| Tính năng | Mô tả | Agent |
|-----------|--------|-------|
| Auth & RBAC | Đăng ký, Đăng nhập, JWT, 6 vai trò, KYC xác minh | Sonnet |
| Admin Dashboard | Quản lý user, Duyệt nội dung, Quản lý vùng ưu tiên, Thống kê | Sonnet + Gemini Pro |
| Notifications | Real-time thông báo qua SignalR | Sonnet |
| Logging | Ghi log hệ thống (Login, Post, Delete) | Sonnet |

---

## 3. Domain Model (từ Class Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                        USERS & ROLES                            │
│  User ──┬── UnloginGuest                                        │
│         ├── LoginGuest (+ submitVerificationRequest)             │
│         ├── PersonInNeed (+ postSOS, createSocialPost)          │
│         ├── Sponsor (+ searchSupportCases, trackDonation)       │
│         ├── Volunteer (+ viewRoutes, acceptTask, updateStatus)  │
│         └── Admin (+ manageUsers, moderateContent, manageZones) │
├─────────────────────────────────────────────────────────────────┤
│                        MAP SYSTEM                               │
│  Ping (MapItem) ──── PingFlag (blinking alert)                  │
│       │                                                         │
│       ├── Zone (Priority Zone with PostGIS boundary)            │
│       └── SupplyItem (Kho hàng cứu trợ)                       │
├─────────────────────────────────────────────────────────────────┤
│                      SOCIAL NETWORK                             │
│  Post ──┬── Comment                                             │
│         └── Tag (Category: Gia cảnh / Bệnh tật / Giáo dục)    │
├─────────────────────────────────────────────────────────────────┤
│                      NOTIFICATION                               │
│  Notification (Message, IsRead, UserID)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Enums
- **RoleEnum**: Guest=0, PersonInNeed=1, Sponsor=2, Volunteer=3, Admin=9
- **SOS_Status**: Pending=0, InProgress=1, Resolved=2, Verified_Safe=3
- **MapItemType**: SOS, Supply, Shelter

---

## 4. Kiến trúc hệ thống

```
                    ┌─────────────────┐
                    │   React Client  │
                    │  (Vite + TS)    │
                    └────────┬────────┘
                             │ HTTPS + SignalR WebSocket
                    ┌────────▼────────┐
                    │  ASP.NET Core   │
                    │   API Server    │
                    │  ┌───────────┐  │
                    │  │Controllers│  │
                    │  │  SignalR  │  │
                    │  │  Hubs     │  │
                    │  └─────┬─────┘  │
                    │  ┌─────▼─────┐  │
                    │  │ Services  │  │
                    │  │ (Business │  │
                    │  │  Logic)   │  │
                    │  └─────┬─────┘  │
                    └────────┼────────┘
                ┌────────────┼────────────┐
                │            │            │
        ┌───────▼──────┐ ┌──▼──────┐ ┌───▼──────────┐
        │   Supabase   │ │ Google  │ │   Google     │
        │  PostgreSQL  │ │  Maps   │ │   Gemini     │
        │  + PostGIS   │ │  API    │ │   API        │
        └──────────────┘ └─────────┘ └──────────────┘
```

---

## 5. Phân chia Sprint

### 🏁 Sprint 0: Khởi tạo (Ngày 1-2)
**Mục tiêu**: Setup environment, khởi tạo codebase, cấu hình CI

| Task | Agent | Thời gian |
|------|-------|-----------|
| Tạo ASP.NET Core solution (Clean Architecture) | Sonnet | 2h |
| Tạo React + Vite project | Gemini Pro | 1h |
| Setup Supabase project + PostGIS extension | Sonnet | 1h |
| Cấu hình `.env`, `appsettings.json` | Flash | 1h |
| Viết README.md ban đầu | Flash | 1h |
| Review cấu trúc, phê duyệt architecture | Opus | 1h |

---

### 🔐 Sprint 1: Authentication & Foundation (Tuần 1-2)
**Mục tiêu**: Hệ thống Auth hoàn chỉnh, UI foundation, Design system

#### Backend (Sonnet)
| Task | Estimate |
|------|----------|
| Define AppDbContext + Identity configuration | 3h |
| Implement AuthController (Register, Login → JWT) | 4h |
| Implement Profile update + Role verification endpoint | 3h |
| Setup global error handling middleware | 2h |
| Setup Serilog logging | 1h |
| Write unit tests for Auth service | 3h |
| Database migrations | 1h |

#### Frontend (Gemini Pro)
| Task | Estimate |
|------|----------|
| Setup design system (CSS tokens, glassmorphism, aurora, dark/light themes) | 4h |
| Create Layout components (Sidebar, Header, MobileNav, AppLayout, responsive) | 4h |
| Setup i18n system (LanguageContext, vi.json, en.json, 120+ keys) | 2h |
| Setup ThemeContext (dark/light mode, system preference, localStorage) | 1h |
| Implement Landing page (hero, features, stats, CTA, bilingual) | 3h |
| Implement Login page (glass card, icon inputs, password toggle) | 3h |
| Implement Register page (matching design, form validation) | 2h |
| Implement Dashboard page (stat cards, activity feed, quick actions) | 3h |
| Scaffold remaining pages (Map, Social, Chatbot, Profile, Admin) | 3h |
| Setup React Router + Route guards (Protected/Public, nested with AppLayout) | 3h |
| Setup Axios client + JWT interceptor | 2h |
| Setup Zustand auth store | 1h |

#### Architecture (Opus)
| Task | Estimate |
|------|----------|
| Finalize domain models (all entities in Core) | 4h |
| Define all interfaces (IRepository, IService) | 3h |
| Define DTOs and validation rules | 3h |
| Write api-contracts.md for Auth endpoints | 2h |
| Review Sprint 1 code | 3h |

#### Research (Flash)
| Task | Estimate |
|------|----------|
| Research Supabase + EF Core integration | 2h |
| Research JWT best practices for .NET 8 | 1h |
| Document Auth API contracts | 2h |
| Create .env.example | 1h |

---

### 🗺️ Sprint 2: Map System (Tuần 3-4)
**Mục tiêu**: Bản đồ cứu trợ hoạt động đầy đủ với routing và alerts

#### Backend (Sonnet)
| Task | Estimate |
|------|----------|
| Implement MapController (CRUD Pings, spatial queries) | 5h |
| Implement PostGIS spatial queries (ST_DWithin, radius filter) | 4h |
| ~~Integrate Google Maps Directions API~~ Removed (routing via OSRM client-side) | 0h |
| Implement Zone CRUD (Admin) | 3h |
| Implement SupplyItem CRUD | 2h |
| Setup SignalR SOSAlertHub | 4h |
| Write unit tests for Map service | 3h |

#### Frontend (Gemini Pro)
| Task | Estimate |
|------|----------|
| Integrate OpenStreetMap via Leaflet.js (free, no API key) | 4h |
| Implement custom markers (SOS=Red, Sponsor=Blue, icons) | 3h |
| Implement marker clustering (performance) | 2h |
| Implement marker click → detail panel | 3h |
| Implement SOS pin creation form (3 steps max) | 3h |
| Implement route display (2 alternatives) | 4h |
| Implement SOS blinking animation (CSS + SignalR listener) | 3h |
| Implement filter controls (by type) | 2h |

#### Algorithm (Opus)
| Task | Estimate |
|------|----------|
| Implement A* routing algorithm (AStarRouter.cs) | 8h |
| Implement Priority Analysis Engine (PriorityAnalyzer.cs) | 6h |
| Implement SOS Timeout Monitor (background service) | 4h |
| Write unit tests for algorithms | 4h |
| Write integration tests for Map flow | 3h |

#### Research (Flash)
| Task | Estimate |
|------|----------|
| Research Leaflet marker clustering optimization | 2h |
| Research A* implementations for road networks | 3h |
| Research PostGIS geofencing patterns | 2h |
| Document Map API contracts | 2h |

---

### 💬 Sprint 3: Social Network (Tuần 5)
**Mục tiêu**: Mạng xã hội cộng đồng hoạt động đầy đủ

#### Backend (Sonnet)
| Task | Estimate |
|------|----------|
| Implement PostController (CRUD, pagination cursor-based) | 4h |
| Implement Reactions service (Like, Love, Pray) | 2h |
| Implement Comments service | 3h |
| Implement image upload (validation: jpg/png, max 5MB) | 3h |
| Implement My Wall endpoint | 2h |
| Write unit tests for Social service | 3h |

#### Frontend (Gemini Pro)
| Task | Estimate |
|------|----------|
| Implement Social Feed page (infinite scroll) | 4h |
| Implement Post card component (avatar, content, image, badges) | 3h |
| Implement Post creation form (text + image + category) | 3h |
| Implement Reactions UI (animated counters) | 2h |
| Implement Comments section (threaded) | 3h |
| Implement My Wall profile page | 3h |

#### Review (Opus)
| Task | Estimate |
|------|----------|
| Review social feed lazy loading implementation | 2h |
| Review image upload security | 2h |
| Integration tests for Social flow | 3h |

---

### 🤖 Sprint 4: Chatbot & Admin (Tuần 6-7)
**Mục tiêu**: AI chatbot + Admin dashboard + Polish hoàn thiện

#### Backend (Sonnet)
| Task | Estimate |
|------|----------|
| Implement ChatbotController + Gemini API integration | 5h |
| Implement safety keyword detection + fallback logic | 3h |
| Implement AdminController (user mgmt, moderation) | 4h |
| Implement system logs & stats endpoints | 3h |
| Implement Priority Zone CRUD with PostGIS polygons | 3h |

#### Frontend (Gemini Pro)
| Task | Estimate |
|------|----------|
| Implement floating Chatbot widget | 3h |
| Implement chat conversation UI (bubbles, typing indicator) | 4h |
| Implement Red Warning + emergency numbers display | 2h |
| Implement Admin Dashboard layout | 3h |
| Implement User management table | 3h |
| Implement Content moderation panel | 2h |
| Implement Priority Zone editor (draw polygons on map) | 4h |
| Implement Stats dashboard (charts) | 3h |
| Dark mode toggle + final UI polish | 3h |
| Responsive testing & fixes | 3h |

#### System (Opus)
| Task | Estimate |
|------|----------|
| Design Gemini system prompt (Relief Assistant) | 3h |
| Design safety fallback keyword list + logic | 3h |
| Final integration testing (all features) | 5h |
| Performance testing (map load, concurrent users) | 3h |
| Security audit (OWASP checklist) | 3h |

#### Documentation (Flash)
| Task | Estimate |
|------|----------|
| Complete all API documentation | 3h |
| Write deployment guide | 2h |
| Final README update | 2h |
| Create CHANGELOG.md v1.0 | 1h |

---

### ⚡ Sprint 3.5: Performance & Security Optimization (2026-03-17) ✅ COMPLETED

**Mục tiêu**: Optimize backend performance (4s → <1s), fix security vulnerabilities, migrate to pnpm

#### Package Management
| Task | Status |
|------|--------|
| Migrate from npm to pnpm | ✅ Done |
| Update run-all.ps1 to use pnpm | ✅ Done |
| Clean up npm artifacts | ✅ Done |

#### Backend Performance Optimization
| Task | Impact | Status |
|------|--------|--------|
| Add AsNoTracking() to all read-only queries | 20-30% faster | ✅ Done |
| Fix N+1 queries in PostRepository pagination | 3 queries → 1 | ✅ Done |
| Verify GeminiService timeout (10s) | Prevent hanging | ✅ Verified |
| Verify PostGIS spatial query optimization | Optimal | ✅ Verified |
| Verify database indexes on foreign keys | All present | ✅ Verified |
| Verify Hangfire background jobs for email | Working | ✅ Verified |
| Verify admin stats caching (5 min) | Working | ✅ Verified |

**Performance Results**: Backend response time improved from 4s+ to <1s (75-80% faster)

#### Security Fixes
| Task | Status |
|------|--------|
| Implement TokenBlacklistService for logout | ✅ Done |
| Add JWT secret validation (256-bit minimum) | ✅ Done |
| Add rate limiting on auth endpoints (5/15min) | ✅ Done |
| Move Gemini API key from query to header | ✅ Done |
| Add XSS prevention with HtmlSanitizer | ✅ Done |
| Fix timing attack vulnerabilities | ✅ Done |
| Fix Hangfire dashboard authorization | ✅ Done |

**Security Score**: Improved from 7.5/10 to 8.5/10

#### Frontend Performance Optimization
| Task | Status |
|------|--------|
| Fix infinite fetch loop in MapShell | ✅ Done |
| Optimize marker filtering with Set lookup | ✅ Done |
| Add API request timeout (10s) | ✅ Done |
| Fix memory leaks in AdminPage | ✅ Done |
| Implement vendor chunk splitting in Vite | ✅ Done |
| Optimize React Query configuration | ✅ Done |

**Build Results**: Frontend builds in 453ms, all UI tests passing (12/12)

---

## 6. Quality Gates (Trước mỗi Sprint merge)

- [ ] ✅ Tất cả unit tests pass
- [ ] ✅ Không có critical bugs
- [ ] ✅ Code review bởi Opus
- [ ] ✅ API contracts khớp với implementation
- [ ] ✅ Security checklist (no plain passwords, no exposed API keys)
- [ ] ✅ Performance đạt yêu cầu (map ≤3s, SOS ≤3 steps)
- [ ] ✅ Responsive trên mobile/tablet/desktop
- [ ] ✅ Documentation updated

---

## 7. Risk Management

| Rủi ro | Xác suất | Tác động | Giải pháp |
|--------|----------|----------|-----------|
| ~~Google Maps API quota vượt giới hạn~~ Removed — OpenStreetMap is free | N/A | N/A | Không còn rủi ro này |
| Gemini API response chậm >5s | Medium | Medium | Timeout + cache frequent queries |
| PostGIS spatial queries chậm | Low | High | Spatial indexing, query optimization |
| SignalR connection drops | Medium | Medium | Auto-reconnect, message queue fallback |
| Team coordination conflicts | Low | Medium | api-contracts.md, code review gates |
| Supabase free tier limitations | Medium | Medium | Optimize queries, pagination |

---

## 8. Definition of Done (DoD)

Một feature được coi là **DONE** khi:
1. ✅ Code đã implement đúng spec trong SRS
2. ✅ Unit tests đạt ≥80% coverage cho service layer
3. ✅ Integration test pass cho happy path + edge cases
4. ✅ Code review approved bởi Opus
5. ✅ UI responsive trên 3 breakpoints (mobile/tablet/desktop)
6. ✅ No security vulnerabilities (OWASP Top 5)
7. ✅ API documentation updated
8. ✅ Debug log cleared (no open issues for this feature)

---

## 9. Future Improvements & Recommendations (Post Sprint 3.5)

### 🚀 High Priority Enhancements

#### Performance
- **Response Compression**: Configure Brotli + Gzip in Program.cs (30-40% bandwidth reduction)
- **Redis Caching**: Replace in-memory cache for distributed scenarios
- **CDN Integration**: Offload static asset serving (images, CSS, JS)
- **Database Connection Pooling**: Tune PostgreSQL settings for high concurrency
- **Query Result Caching**: Cache frequently accessed data (zones, categories)

#### Security
- **JWT in httpOnly Cookies**: Migrate from localStorage to prevent XSS attacks
- **Token Rotation**: Implement refresh token mechanism
- **CSRF Protection**: Add anti-forgery tokens for state-changing operations
- **Content Security Policy**: Add CSP headers to prevent injection attacks
- **API Rate Limiting**: Extend to all endpoints (currently only auth)

#### Scalability
- **Horizontal Scaling**: Prepare for multi-instance deployment
- **Message Queue**: Implement RabbitMQ/Azure Service Bus for async operations
- **Database Read Replicas**: Separate read/write operations
- **Microservices Migration**: Consider splitting map/social/chatbot into separate services

### 💡 Medium Priority Features

#### User Experience
- **Progressive Web App (PWA)**: Enable offline functionality
- **Push Notifications**: Browser notifications for SOS alerts
- **Multi-language Support**: Expand beyond Vietnamese/English
- **Accessibility (WCAG 2.1)**: Screen reader support, keyboard navigation
- **Mobile App**: React Native version for better mobile experience

#### Analytics & Monitoring
- **Application Insights**: Real-time performance monitoring
- **User Analytics**: Track feature usage, engagement metrics
- **Error Tracking**: Sentry/Rollbar integration
- **Performance Dashboards**: Grafana/Prometheus for system health

#### Advanced Features
- **AI-Powered Matching**: ML model to match sponsors with cases
- **Blockchain Donation Tracking**: Transparent donation verification
- **Video Call Integration**: WebRTC for remote assistance
- **Document Verification**: OCR for ID/certificate verification
- **SMS Notifications**: Twilio integration for critical alerts

### 🔧 Technical Debt

- **Test Coverage**: Increase from current level to 80%+ coverage
- **API Versioning**: Implement v1/v2 versioning strategy
- **Code Documentation**: Add XML comments for all public APIs
- **Dependency Updates**: Regular security patches and updates
- **Performance Benchmarks**: Establish baseline metrics and monitoring

### 📊 Metrics to Track

**Performance KPIs:**
- API response time: Target <500ms (currently <1s)
- Frontend load time: Target <2s
- Database query time: Target <100ms
- Concurrent users: Target 1000+

**Business KPIs:**
- SOS response time: Average time from alert to volunteer acceptance
- Donation conversion rate: Sponsors who donate after viewing cases
- User retention: Monthly active users
- Platform reliability: 99.9% uptime target

---

**Last Updated**: 2026-03-17
**Next Review**: After Sprint 4 completion
