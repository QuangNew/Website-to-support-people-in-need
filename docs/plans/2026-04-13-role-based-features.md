# Plan: Role-Based Feature Implementation
**Date**: 2026-04-13  
**Scope**: People In Need, Sponsor, Volunteer — Frontend + Backend gaps

## Current State Analysis

### Backend ✅ (Already Implemented)
- `VolunteerController` — 3 endpoints (GetAvailableTasks, AcceptTask, GetActiveTasks)
- `SponsorController` — 2 endpoints (SearchSupportCases, OfferHelp)
- `MapController` — ConfirmSafe (PersonInNeed), UpdatePingStatus (Volunteer), GetPingsByUser
- `NotificationController` — Full CRUD
- `SOSAlertHub` — SignalR real-time alerts

### Frontend ❌ (Gaps)
1. **No `volunteerApi` or `sponsorApi`** in `api.ts`
2. **No role-specific panels** — all 3 roles use same generic map  
3. **No task management UI** for Volunteer
4. **No case search/offer UI** for Sponsor
5. **No SOS history dashboard** for People In Need
6. **Sidebar has no role-specific navigation**

---

## Implementation Plan — 3 Role Panels + API Integration

### Phase 1: API Client (Shared — `api.ts`)

Add `volunteerApi` and `sponsorApi` objects:

```typescript
// VOLUNTEER API
export const volunteerApi = {
  getAvailableTasks: (params?: { lat?: number; lng?: number }) =>
    api.get('/volunteer/tasks', { params }),
  acceptTask: (data: { pingId: number }) =>
    api.post('/volunteer/accept-task', data),
  getActiveTasks: () =>
    api.get('/volunteer/active-tasks'),
};

// SPONSOR API
export const sponsorApi = {
  searchCases: (params?: { category?: string; status?: string; lat?: number; lng?: number; radiusKm?: number }) =>
    api.get('/sponsor/cases', { params }),
  offerHelp: (data: { pingId: number; message?: string }) =>
    api.post('/sponsor/offer-help', data),
};
```

### Phase 2: Panel Components (Parallel per Role)

#### 2A — People In Need Panel (`PersonInNeedPanel.tsx`)
**Features:**
- "My SOS Requests" — list user's own pings via `mapApi.getPingsByUser(userId)`
- Status tracking (Pending → InProgress → Resolved → VerifiedSafe)
- "Confirm Safe" button (calls `mapApi.confirmSafe(id)`)
- View notifications for help offers
- Click SOS to fly to it on map

**Symbols Owned:** `PersonInNeedPanel`
**Backend Endpoints Used:** `GET /map/pings/user/{userId}`, `POST /map/pings/{id}/confirm-safe`, `GET /notifications`

#### 2B — Volunteer Panel (`VolunteerPanel.tsx`)  
**Features:**
- "Available Tasks" tab — nearby pending SOS sorted by proximity
- "My Active Tasks" tab — tasks in progress
- "Accept Task" button with confirmation
- "Get Directions" → triggers OSRM routing
- Status badge + priority level display

**Symbols Owned:** `VolunteerPanel`
**Backend Endpoints Used:** `GET /volunteer/tasks`, `POST /volunteer/accept-task`, `GET /volunteer/active-tasks`

#### 2C — Sponsor Panel (`SponsorPanel.tsx`)
**Features:**
- Search cases with filters (category, status, location radius)
- Two sections: SOS Cases + Social Posts
- "Offer Help" button with message dialog
- Case details card with location, description, author

**Symbols Owned:** `SponsorPanel`
**Backend Endpoints Used:** `GET /sponsor/cases`, `POST /sponsor/offer-help`

### Phase 3: Integration

#### 3A — MapStore Updates
- Add 3 new panel types: `'pin-dashboard' | 'volunteer' | 'sponsor'`
- Update `PanelType` union

#### 3B — Sidebar Updates  
- Show role-specific navigation item based on `user.role`:
  - PersonInNeed → "My SOS" icon (HeartPulse)
  - Volunteer → "Tasks" icon (ClipboardCheck)
  - Sponsor → "Support" icon (HandHeart)
- Only show when `user.verificationStatus === 'Approved'`

#### 3C — MapShell Updates
- Register 3 new panel components in `PANEL_COMPONENTS`

#### 3D — i18n Updates
- Add keys for all 3 panels in `en.json` and `vi.json`

---

## Risk Assessment
- **Risk Level**: LOW — all changes are additive, no existing symbols modified
- **d=1 callers**: MapShell (register panels), Sidebar (add nav items), mapStore (extend PanelType)
- **No breaking changes** — existing panels/routes untouched

## File Change Matrix

| File | Change | Role |
|------|--------|------|
| `client/src/services/api.ts` | Add `volunteerApi`, `sponsorApi` | Shared |
| `client/src/stores/mapStore.ts` | Extend `PanelType` | Shared |
| `client/src/components/panels/PersonInNeedPanel.tsx` | **NEW** | PIN |
| `client/src/components/panels/VolunteerPanel.tsx` | **NEW** | Volunteer |
| `client/src/components/panels/SponsorPanel.tsx` | **NEW** | Sponsor |
| `client/src/components/layout/MapShell.tsx` | Register panels | Shared |
| `client/src/components/layout/Sidebar.tsx` | Add role nav items | Shared |
| `client/src/i18n/en.json` | Add panel keys | Shared |
| `client/src/i18n/vi.json` | Add panel keys | Shared |
