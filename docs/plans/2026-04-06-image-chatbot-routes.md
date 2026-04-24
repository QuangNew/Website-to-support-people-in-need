# Plan: Image Fix + Chatbot Image + Alternative Routes

**Date:** 2026-04-06  
**Scope:** 3 features + docs + security review

---

## Feature 1: Fix Image Display (Community + Verification)

### Root Cause
- `PostController.UploadImage` returns `{ imageUrl: "/uploads/{filename}" }` (relative path)
- `SocialPage.tsx` L323: hardcodes `http://localhost:5164` prefix — works only in dev
- `SocialPanel.tsx` L311: uses raw `post.imageUrl` — relative path doesn't resolve in browser
- `MyWallPage.tsx` L291: same issue

### Fix
1. Create a helper `getImageUrl(path)` that prepends `API_BASE_URL` (minus `/api`) when path is relative
2. Use in SocialPage, SocialPanel, MyWallPage
3. Also check AdminPage for verification image display

### Files
- `client/src/services/api.ts` — export `getImageUrl` helper
- `client/src/pages/SocialPage.tsx` — use helper (L323)
- `client/src/components/panels/SocialPanel.tsx` — use helper (L311)
- `client/src/pages/MyWallPage.tsx` — use helper (L291)
- `client/src/pages/AdminPage.tsx` — check verification images

---

## Feature 2: Chatbot Image Support

### Design
- Frontend: add image upload button to ChatPanel input area
- Convert image to base64 data URL, cache in localStorage with timestamp
- Send image as base64 inline_data to Gemini Vision API alongside a template prompt
- After 24h, cached images show "Ảnh đã hết hạn" placeholder
- On logout, all image cache is cleared

### Backend Changes
- `SendMessageDto`: add optional `ImageBase64` and `ImageMimeType` fields
- `GeminiService.SendMessageAsync`: accept optional image data, build multimodal parts
- `ChatbotController`: pass image data through to Gemini

### Frontend Changes
- `ChatPanel.tsx`: add image picker, preview, send with base64
- Message model: add optional `imageUrl` (base64 data URL) and `imageTimestamp`
- Display: show image in bubble, check 24h expiry, show "expired" placeholder
- Logout: already clears `chatpanel_messages` (includes image data)

### Files
- `src/ReliefConnect.Core/DTOs/DTOs.cs` — extend SendMessageDto
- `src/ReliefConnect.Infrastructure/Services/GeminiService.cs` — multimodal support
- `src/ReliefConnect.API/Controllers/ChatbotController.cs` — pass image data
- `client/src/components/panels/ChatPanel.tsx` — UI + cache
- `client/src/styles/layout.css` — image message styling

---

## Feature 3: Alternative Routes (2 Secondary)

### Current State
- `mapStore.ts` fetchRoute uses OSRM API with `alternatives=true`
- Only stores 1 alternative (data.routes[1])
- MapView only draws primary + 1 dashed alternative
- PingDetailPanel shows 1 alternative info line

### Changes
- `RouteData` interface: change `alternative`/`alternativeInfo` to arrays (up to 2)
- `fetchRoute`: extract routes[1] and routes[2] if available
- Add `selectedRouteIndex` state (0 = primary, 1 = alt1, 2 = alt2)
- MapView: draw up to 3 routes with different styles, highlight selected
- PingDetailPanel: show all alternatives as clickable options

### Files
- `client/src/stores/mapStore.ts` — RouteData interface + fetchRoute + selectedRouteIndex
- `client/src/components/map/MapView.tsx` — draw 3 routes
- `client/src/components/map/PingDetailPanel.tsx` — route selector UI
- `client/src/styles/layout.css` — route selector styles
- `client/src/i18n/en.json` + `vi.json` — new i18n keys

---

## Highest Risk: MEDIUM
- GeminiService signature change affects ChatbotController (d=1)
- RouteData interface change affects MapView + PingDetailPanel (d=1)
- Image URL helper is additive (LOW risk)
