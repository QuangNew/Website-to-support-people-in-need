# Plan: Notification Fix + Chatbot Cache + Role Change with Expiry

## Task 1: Fix Notification Bell

### Problem
1. `fetchNotifications()` casts `res.data` directly as `Notification[]`, but API returns `{ items, totalCount, page, pageSize, totalPages }`. Should be `res.data.items`.
2. Dropdown uses `left: 44px` — in a collapsed/narrow sidebar this clips outside visible area.

### Files
- `client/src/components/ui/NotificationBell.tsx`

### Fix
- Change `const items = res.data as Notification[]` → `const items = (res.data as any).items as Notification[]`
- Reposition dropdown: `left: -220px` (centered relative to bell) or use `right: 0` with `transform: none`

---

## Task 2: Chatbot Conversation Cache

### Problem
`ChatbotPage.tsx` has no persistence — messages disappear on navigation.

### Files
- `client/src/pages/ChatbotPage.tsx`

### Fix
- Key: `chatbot_messages_{userId}` in localStorage (or just `chatbot_messages` if not user-specific)
- On mount: load from localStorage → use as initial state
- On message change: save to localStorage
- Add "New Chat" button in header area: shows `window.confirm()` dialog, if confirmed → clear messages + clear localStorage, reset to initial greeting message

---

## Task 3: Role Change with 1.5-Year Expiry

### Problem
`VerificationPanel` blocks verified users from submitting a new verification request.

### Files
- `client/src/components/panels/VerificationPanel.tsx`
- `src/ReliefConnect.Core/Entities/ApplicationUser.cs`
- `src/ReliefConnect.API/Controllers/AuthController.cs`
- `src/ReliefConnect.API/Controllers/AdminController.cs` (if role approval grants expiry)

### Fix
1. `ApplicationUser.cs`: Add `public DateTime? RequestedRoleExpiry { get; set; }`
2. `AuthController.SubmitVerification`: Allow any non-pending status (remove Verified block), set `RequestedRoleExpiry = DateTime.UtcNow.AddYears(1).AddMonths(6)` (1.5 years)
3. `VerificationPanel`: Change `canVerify` to allow ALL statuses (Verified too) — remove the `user.verificationStatus === 'None' || user.verificationStatus === 'Rejected'` block
4. Add migration: `dotnet ef migrations add AddRequestedRoleExpiry --project ../ReliefConnect.Infrastructure --startup-project .`
