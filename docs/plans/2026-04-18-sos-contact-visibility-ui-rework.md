# SOS Contact, Visibility, and UI Rework Plan

Date: 2026-04-18
Scope: SOS ping creation requirements, role-based detail visibility, and ping detail UI rework.

## Goal

Improve SOS handling so each SOS ping captures trustworthy contact data, hides sensitive fields from low-trust viewers, and presents ping details in a clearer, denser, more usable UI.

## Confirmed Requirements

1. SOS creation must require real name and phone number.
2. Situation image is optional but supported during SOS creation.
3. When viewing an SOS ping:
   - unauthenticated guests,
   - logged-in guests,
   - and PersonInNeed users
   only see the pinger's name and situation image.
4. Other roles should see name, phone number, email, and situation image.
5. Existing ping detail UI needs a careful layout rework for clarity and space efficiency.

## Research Findings

- `client/src/components/map/SOSCreationFlow.tsx` currently sends only `lat`, `lng`, `type`, `details`, and `sosCategory`.
- `src/ReliefConnect.API/Controllers/MapController.cs::CreatePing` currently persists only map/status/details/category and user ownership.
- `src/ReliefConnect.Core/Entities/Ping.cs` currently has no snapshot fields for SOS contact name, phone, or condition image.
- `src/ReliefConnect.Core/DTOs/DTOs.cs::PingResponseDto` currently exposes only generic ping fields plus `UserName`.
- `client/src/stores/authStore.ts` drops `PhoneNumber` even though `GET /api/auth/me` already returns it.
- `client/src/components/map/PingDetailPanel.tsx` renders one dense card with limited hierarchy and no privilege-based field gating.
- Existing upload path can reuse `POST /api/social/upload-image`, which already validates image type and size.
- Design direction from `awesome-design-md`: prefer clear visual hierarchy, component rules, responsive collapse strategy, and deliberate surface layering rather than adding more density to the existing card.

## Conflict Map

### Backend ownership

- `Ping` entity
- `CreatePingDto`
- `PingResponseDto`
- `AppDbContext` ping configuration
- `MapController.CreatePing`
- `MapController.GetPings`
- `MapController.GetPingById`
- `MapController.GetPingsByUser`
- `MapController.UpdatePingStatus`
- `MapController.ConfirmSafe`
- `MapController.MapPingToDto`
- new EF migration for ping columns

### Frontend ownership

- `client/src/services/api.ts` map payload typing
- `client/src/stores/authStore.ts` user profile typing for phone prefill
- `client/src/stores/mapStore.ts` ping shape + ping mapping
- `client/src/components/map/SOSCreationFlow.tsx`
- `client/src/components/map/PingDetailPanel.tsx`
- `client/src/styles/layout.css` ping detail and SOS form styles
- `client/src/i18n/en.json`
- `client/src/i18n/vi.json`

## Blast Radius

### GitNexus results

- `MapController.CreatePing`: LOW risk from symbol graph; direct graph callers not modeled because it is an HTTP entrypoint.
- `MapController.MapPingToDto`: LOW risk with 3 direct callers:
  - `GetPingById`
  - `UpdatePingStatus`
  - `ConfirmSafe`

### Manual d=1 callers not captured by GitNexus

- Frontend HTTP consumers of map payloads:
  - `client/src/services/api.ts::mapApi.getPings`
  - `client/src/services/api.ts::mapApi.getPingById`
  - `client/src/services/api.ts::mapApi.createPing`
  - `client/src/services/api.ts::mapApi.getPingsByUser`
- Frontend readers of mapped ping data:
  - `client/src/stores/mapStore.ts::fetchPings`
  - `client/src/stores/mapStore.ts::fetchPingsInBounds`
  - `client/src/components/map/PingDetailPanel.tsx`
  - `client/src/components/layout/FilterBar.tsx`
  - `client/src/components/map/MapView.tsx`

### Overall risk assessment

- Risk level: MEDIUM
- Reason: multiple files across API, EF model, store mapping, and primary UI surface; no auth/payment critical path is being altered.

## Implementation Boundaries

### Backend

1. Add `ContactName`, `ContactPhone`, and `ConditionImageUrl` to `Ping`.
2. Make `CreatePingDto` require name and phone, keep image optional.
3. Preserve email as user-owned data; expose it only for allowed roles.
4. Centralize visibility policy in ping DTO mapping so list/detail/status endpoints stay consistent.
5. Keep public read access for pings, but redact sensitive fields for low-trust viewers.

### Frontend

1. Prefill contact name from `user.fullName` and phone from `user.phoneNumber` when available.
2. Require name and phone in the SOS form before submit.
3. Reuse existing upload flow for optional condition image.
4. Rebuild ping detail into a more structured drawer with clear sections:
   - status and category,
   - primary incident summary,
   - person snapshot,
   - sensitive contact block when allowed,
   - route/actions.
5. Keep mobile behavior careful: form remains GPS-first and drawer remains readable in limited viewport height.

## Validation Plan

1. Backend build: `dotnet build` for API solution.
2. Frontend validation: `pnpm build` and `pnpm lint` in `client`.
3. Spot-check GitNexus status after edits.
4. Review git diff scope and ensure only intended SOS/map files changed.

## CLAUDE.md Follow-up

If implementation adds required SOS contact/image fields or changes ping response behavior, update the map and technical-detail sections only where facts are stale.