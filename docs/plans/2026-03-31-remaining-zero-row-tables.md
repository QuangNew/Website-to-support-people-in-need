# Plan: Complete Remaining Zero-Row Tables

> **Date**: 2026-03-31
> **Scope**: Tables with 0 rows that are NOT covered by existing plans in dev.md
> **Pre-analysis**: Cross-referenced plan.md + dev.md to avoid duplication

---

## Summary: What's Already Planned (SKIP)

These are already in dev.md and should NOT be re-planned here:

| Table | Existing Plan Location | Status |
|---|---|---|
| **Notifications** | dev.md line 170-182: NotificationController CRUD | Partially implemented this session (NotificationService + triggers done, controller still needed) |
| **HelpOffers** | dev.md line 157-159: SponsorController HelpOffer entity creation | Planned, not started |
| **Reports** | dev.md line 75-76: Entity + AdminModerationController | Backend DONE |
| **SystemAnnouncements** | dev.md line 78-80: Entity + AdminSystemController CRUD | Backend DONE |

---

## What This Plan Covers (REMAINING GAPS)

After eliminating everything already planned + already implemented this session, these gaps remain:

### Gap 1: NotificationController (Backend API — READ side)

**Context**: This session created `INotificationService` + `NotificationService` (WRITE side - creating notifications). dev.md plans a NotificationController but it hasn't been built. We need the READ side.

**Priority**: HIGH (notifications are created but users can't see them)

**Tasks**:

1. **Create `NotificationController.cs`** (`api/notifications`)
   - `GET /notifications` — List user's notifications (paginated, filter by unread)
   - `GET /notifications/unread-count` — Get unread count (cached 30s via IMemoryCache)
   - `PUT /notifications/{id}/read` — Mark single as read
   - `PUT /notifications/read-all` — Mark all as read
   - `DELETE /notifications/{id}` — Delete a notification
   - All endpoints require `[Authorize]`

2. **Register in Program.cs DI** — Controller auto-discovered, just verify routing

3. **Add `notificationApi` to frontend `api.ts`**
   ```typescript
   export const notificationApi = {
     getNotifications: (page = 1, unreadOnly = false) =>
       api.get(`/notifications?page=${page}&unreadOnly=${unreadOnly}`),
     getUnreadCount: () =>
       api.get('/notifications/unread-count'),
     markRead: (id: number) =>
       api.put(`/notifications/${id}/read`),
     markAllRead: () =>
       api.put('/notifications/read-all'),
     deleteNotification: (id: number) =>
       api.delete(`/notifications/${id}`),
   };
   ```

4. **Create `NotificationBell` component** (Header area)
   - Show unread count badge (red dot with number)
   - Dropdown panel listing recent notifications
   - Click notification → mark as read
   - "Mark all as read" button
   - Poll every 30s OR use SignalR real-time push
   - Animate new notifications (slide-in)

5. **Integrate NotificationBell into Header/Sidebar**
   - Add to `client/src/components/layout/Header.tsx` or equivalent
   - Only show for authenticated users

**Files to create/modify**:
- NEW: `src/ReliefConnect.API/Controllers/NotificationController.cs`
- EDIT: `client/src/services/api.ts` (add notificationApi)
- NEW: `client/src/components/layout/NotificationBell.tsx`
- EDIT: `client/src/components/layout/Header.tsx` (integrate NotificationBell)

**Estimated effort**: 4-5 hours

---

### Gap 2: Zone Map Editor (Admin — Visual polygon drawing)

**Context**: This session added a ZonesPanel to AdminPage with table CRUD (name, GeoJSON text, risk level). But the current UX requires manually typing GeoJSON. The plan.md Sprint 4 mentions "Priority Zone editor (draw polygons on map)" but this was never implemented.

**Priority**: MEDIUM (admin panel table CRUD works, but polygon drawing would be much better UX)

**Tasks**:

1. **Add `react-leaflet-draw` package**
   ```bash
   cd client && pnpm add react-leaflet-draw leaflet-draw @types/leaflet-draw
   ```

2. **Create `ZoneMapEditor` component**
   - Full-screen or large modal with Leaflet map
   - Draw polygon tool (click vertices to create boundary)
   - Edit existing polygons (drag vertices)
   - Delete polygon
   - Auto-convert drawn polygon to GeoJSON string
   - Color-code zones by risk level

3. **Integrate with ZonesPanel**
   - "Draw on Map" button next to "New Zone" button
   - When creating/editing a zone, option to switch between:
     - Manual GeoJSON text input (current)
     - Visual map drawing (new)
   - Preview zone boundary on mini-map in table

4. **Display zones on main MapView**
   - Render zone polygons as colored overlays on the relief map
   - Color by risk level: green (low) → yellow (medium) → red (high) → purple (critical)
   - Zone name label on polygon center
   - Click zone → show zone info popup

**Files to create/modify**:
- NEW: `client/src/components/map/ZoneMapEditor.tsx`
- EDIT: `client/src/pages/AdminPage.tsx` (ZonesPanel integration)
- EDIT: `client/src/components/map/MapView.tsx` (zone overlay display)
- EDIT: `client/package.json` (add leaflet-draw dependency)

**Estimated effort**: 6-8 hours

---

### Gap 3: Supply Items Map Visualization

**Context**: This session added SupplyPanel to AdminPage with CRUD table. SupplyItems have lat/lng coordinates but are NOT displayed on the map. The MapView only shows Pings (SOS markers).

**Priority**: MEDIUM (data exists, admin can CRUD, but users can't see supply points on map)

**Tasks**:

1. **Add supply markers to MapView**
   - Fetch supply items: `supplyApi.getSupplies()`
   - Create distinct supply marker icon (box/package icon, blue/green color)
   - Add to marker cluster group (separate layer from SOS pings)
   - Click supply marker → show detail popup (name, quantity, coordinates)

2. **Add filter toggle for supply markers**
   - Add "Supply Points" checkbox to FilterBar
   - Toggle visibility of supply marker layer
   - Show supply count in filter bar

3. **Update mapStore with supply data**
   - Add `supplyItems` state to Zustand map store
   - Fetch on map load alongside pings and zones

**Files to create/modify**:
- EDIT: `client/src/components/map/MapView.tsx` (add supply markers + layer)
- EDIT: `client/src/stores/mapStore.ts` (add supplyItems state)
- EDIT: `client/src/components/panels/FilterBar.tsx` (add supply filter toggle)

**Estimated effort**: 3-4 hours

---

### Gap 4: PingFlag Blinking — Complete the Loop

**Context**: This session created:
- `PingFlagMonitorService` (Hangfire job that sets `IsBlinking=true` after 15min in zone)
- Frontend pulse animation using `isBlinking` from API response

BUT there are still gaps in the full blinking loop:

**Priority**: LOW-MEDIUM (core mechanism works, but needs polish)

**Tasks**:

1. **SignalR broadcast when flag changes**
   - When `PingFlagMonitorService` sets `IsBlinking=true`, broadcast via `SOSAlertHub`
   - Frontend SignalR listener auto-updates the marker to blinking state
   - Currently: map must refresh to see blinking status change

2. **Admin override for blinking**
   - Admin can manually set/clear blinking on any ping
   - Add toggle button in PingDetailPanel for admin users
   - API: `PUT /api/map/pings/{id}/flag` with `{ isBlinking: bool }`

3. **Blinking notification**
   - When a ping starts blinking, auto-create notification for:
     - The ping owner ("Your SOS has been flagged — please confirm safety")
     - Assigned volunteer ("SOS #{id} is now flagged as urgent")
     - All admins ("SOS #{id} in zone X is blinking")

4. **Auto-escalation**
   - If blinking for >30 min without response → increase priority level by 1
   - If blinking for >1 hour → notify all volunteers in nearby area

**Files to create/modify**:
- EDIT: `src/ReliefConnect.Infrastructure/Services/PingFlagMonitorService.cs` (add SignalR broadcast)
- EDIT: `src/ReliefConnect.API/Hubs/SOSAlertHub.cs` (add flag update method)
- EDIT: `src/ReliefConnect.API/Controllers/MapController.cs` (add flag toggle endpoint)
- EDIT: `client/src/components/map/MapView.tsx` (SignalR listener for flag changes)
- EDIT: `client/src/components/panels/PingDetailPanel.tsx` (admin flag toggle button)

**Estimated effort**: 5-6 hours

---

## Implementation Priority Order

| # | Gap | Priority | Effort | Depends On |
|---|-----|----------|--------|------------|
| 1 | **NotificationController + NotificationBell** | HIGH | 4-5h | NotificationService (DONE) |
| 2 | **Supply Items Map Visualization** | MEDIUM | 3-4h | SupplyPanel (DONE) |
| 3 | **Zone Map Editor** | MEDIUM | 6-8h | ZonesPanel (DONE) |
| 4 | **PingFlag Blinking Complete Loop** | LOW-MED | 5-6h | PingFlagMonitorService (DONE) |

**Total estimated effort**: 18-23 hours

---

## What NOT to Plan Here (Already in dev.md)

These are tracked in dev.md "Pending Tasks" section and should be implemented following those plans:

- [ ] PersonInNeedController (my pings, received offers, report post)
- [ ] VolunteerController gaps (complete task, history, stats)
- [ ] SponsorController gaps (HelpOffer entity creation, offer history, impact dashboard)
- [ ] Synchronous JWT validation query fix
- [ ] VolunteerController Include-before-Where anti-pattern
- [ ] SponsorController in-memory aggregation fix
- [ ] Frontend `any` types cleanup
- [ ] Frontend error handling
- [ ] UsersPanel debounce fix
- [ ] `volunteerApi.acceptTask` route fix

---

## Cross-Reference Verification

| Table | plan.md | dev.md | This Session | This Plan | Complete? |
|---|---|---|---|---|---|
| **Zones** | Sprint 2+4: CRUD + editor | Zone CRUD mentioned | ZonesPanel (table CRUD) | Gap 2: Map Editor | After Gap 2 |
| **SupplyItems** | Sprint 2: CRUD | Supply CRUD mentioned | SupplyPanel (table CRUD) | Gap 3: Map Viz | After Gap 3 |
| **PingFlags** | Sprint 2: SOS blinking | PingFlag mentioned | MonitorService + pulse | Gap 4: Complete loop | After Gap 4 |
| **Notifications** | Hệ thống phụ trợ | NotificationController planned | NotificationService done | Gap 1: Controller + UI | After Gap 1 |
| **HelpOffers** | N/A | SponsorController gap | Not touched | IN dev.md | dev.md plan |
| **Reports** | N/A | Entity + Controller done | Not touched | N/A | Backend DONE |
| **SystemAnnouncements** | N/A | Entity + Controller done | Not touched | N/A | Backend DONE |
