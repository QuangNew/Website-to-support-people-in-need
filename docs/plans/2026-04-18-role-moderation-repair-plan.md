# Plan: Role Features + Comment Moderation Repair

**Date:** 2026-04-18

## Verified Current State

- `PersonInNeedPanel`, `VolunteerPanel`, and `SponsorPanel` already exist and are wired via `Sidebar` + `MapShell`.
- `SocialPanel` and `MyWallPage` already integrate `HideCommentModal`.
- `AdminPage` already imports `Eye`, `Ban`, and `LogOut`, so the admin user icon issue is not caused by missing imports in the current source.
- `SoftDeleteCleanupService` hard-deletes hidden comments after `HiddenUntil` expires, so comment moderation semantics are "hide until expiry, then delete", not "hide then auto-restore".

## Confirmed Problems

### Comment Moderation

1. Hidden comments remain in the admin hidden list until the cleanup worker deletes them, even when `HiddenUntil` has already passed.
2. The moderation flow is split across multiple UI surfaces, so behavior is inconsistent between map panel and full social page.
3. The public comment query and moderation review query do not proactively normalize expired hidden comments.

### Volunteer

1. `VolunteerController.AcceptTask` changes status to `InProgress` but does not set `Ping.AssignedVolunteerId`.
2. `VolunteerController.GetActiveTasks` returns all `InProgress` tasks instead of only the current volunteer's tasks.
3. The current frontend panel assumes accepted tasks belong to the acting volunteer, but backend state does not guarantee that.

### Sponsor

1. `SponsorController.OfferHelp` sends a notification only and does not persist a `HelpOffer` record.
2. `SponsorPanel` exposes a support action, but there is no durable offer history behind it.

### PersonInNeed

1. `PersonInNeedPanel` supports "My SOS" and `confirm-safe`, but broader offer/history workflows are still missing.
2. The role is partially implemented, not absent.

### Admin User Icons

1. Current source already contains the icon imports and JSX.
2. This issue needs runtime verification before code changes; likely causes are data-loading or environment-specific rendering, not the missing imports reported earlier.

## Phase 1

1. Fix volunteer assignment persistence in `VolunteerController.AcceptTask`.
2. Restrict `VolunteerController.GetActiveTasks` to the current volunteer.
3. Persist `HelpOffer` records in `SponsorController.OfferHelp` while keeping notifications.
4. Normalize expired hidden comments in moderation-facing queries so the hidden list matches effective state.
5. Reproduce the admin icon issue locally before changing `AdminPage`.

## Phase 2

1. Add sponsor offer history endpoints and frontend display.
2. Add volunteer completion/history/stats endpoints and frontend hooks.
3. Consolidate comment moderation UX between `SocialPage`, `SocialPanel`, and admin restore/review screens.

## Phase 3

1. Expand PersonInNeed beyond "My SOS" into offers/history/reporting workflows.
2. Add focused E2E coverage for moderation and role-specific flows.

## Verification Targets

- Volunteer accepts a task and only sees their own active tasks afterward.
- Sponsor offer creates a row in `HelpOffers` and notifies the target user.
- Expired hidden comments no longer appear in the admin hidden list.
- Admin user action icons are either reproduced locally with a real cause or marked as runtime-only after verification.