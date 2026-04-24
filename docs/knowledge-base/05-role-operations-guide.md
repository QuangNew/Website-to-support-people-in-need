# ReliefConnect Knowledge Base: Role Operations Guide

> Last synchronized: 2026-04-16
> Scope: volunteer workflow, sponsor workflow, notifications, announcements, and admin operations.
> Retrieval note: this file groups all role-specific operational behavior so administrative and field-work queries stay close in retrieval space.

## 1. Volunteer Guide

### 1.1 Volunteer Access

Volunteers require the `RequireVolunteer` authorization policy. That policy allows volunteer-only operational endpoints.

### 1.2 Available Volunteer Tasks

The volunteer task endpoint returns up to 50 pending SOS tasks and can sort them by proximity if the volunteer supplies location coordinates.

### 1.3 Accepting a Task

When a volunteer accepts a task, the current implementation moves the ping status from `Pending` to `InProgress`.

### 1.4 Active Tasks

The active-task endpoint lists `InProgress` pings ordered by creation time.

### 1.5 Current Volunteer Limitations

The current codebase still has volunteer gaps that matter for documentation and retrieval:

- There is no dedicated complete-task endpoint in `VolunteerController` yet.
- Task history and volunteer metrics are not fully implemented.
- `AcceptTask` currently changes status but does not persist an assigned volunteer ID in the controller path.
- Active tasks currently list all in-progress tasks, not just volunteer-owned tasks.

## 2. Sponsor Guide

### 2.1 Sponsor Access

Sponsors require the `RequireSponsor` authorization policy. Sponsor endpoints are intended for discovery and outreach rather than direct administrative control.

### 2.2 Searching Support Cases

The sponsor search endpoint can search SOS cases by status and optional radius, and it also returns social posts filtered by category. This creates a combined discovery surface for humanitarian matching.

### 2.3 Offering Help

Sponsors can submit a help offer message referencing a ping. In the current implementation, the offer action sends a notification to the ping owner through the centralized notification service.

### 2.4 Current Sponsor Limitations

The current sponsor path still has gaps:

- The current API does not yet persist a full `HelpOffer` record during `offer-help`.
- There is no sponsor offer history endpoint yet.
- There is no sponsor impact dashboard endpoint yet.

## 3. Notifications and Announcements Guide

### 3.1 Notifications

ReliefConnect includes authenticated notification endpoints at `/api/notifications`. Users can:

- list notifications with pagination,
- request unread count,
- mark a notification as read,
- mark all notifications as read,
- delete a notification.

Notification access is scoped to the current authenticated user, and the controller explicitly blocks cross-user access.

### 3.2 Announcements

ReliefConnect includes an announcement endpoint at `/api/announcements/active`. The endpoint returns non-expired announcements ordered newest first. The current API requires authentication.

## 4. Admin Guide

### 4.1 Admin Areas

Administrative functionality is split across several controllers:

- `AdminController`: user management, verification, batch actions.
- `AdminModerationController`: post moderation and report review.
- `AdminSystemController`: system stats, logs, announcements, export operations, forced SOS resolution.
- `ApiKeyController`: programmatic key management.

### 4.2 Verification Review

Admins review pending role verification requests, approve role changes, or reject requests. Verification review is a core trust-building feature because higher-trust roles can affect public relief operations.

### 4.3 User Enforcement

Admins can suspend, unsuspend, ban, force-logout, or reset verification state for users. The project documentation treats this as a graduated anti-abuse and moderation workflow.

### 4.4 Content Moderation

Admins can review posts, delete posts, delete comments, pin important posts, and process user reports.

### 4.5 System Logs and Exports

Admins can inspect audit logs and export users or logs as CSV. CSV export is protected by `CsvSafe` escaping so spreadsheet software does not interpret dangerous content as formulas.

### 4.6 Announcements and System Status

Admins can create and manage system announcements, inspect statistics, and oversee operational signals such as unresolved SOS items.