# Master Plan - Project Review And Repair Reset

**Date:** 2026-04-18
**Purpose:** Reset the project repair process so future work is done in small, verifiable slices instead of large mixed batches.

## Why A Reset Is Necessary

The project is not blocked by one single defect. It is being affected by several classes of problems at the same time:

1. Runtime and infrastructure drift
2. Database schema mismatch with the deployed Supabase state
3. Authentication and admin-access instability
4. Incomplete or inconsistent role-based workflows
5. Moderation behavior split across multiple UI surfaces
6. Missing focused tests for critical flows
7. Too many unrelated fixes being attempted in the same pass

When these are mixed together, the result is misleading diagnosis, partial fixes, regressions, and a codebase that becomes harder to reason about after each large AI-generated task.

## Core Operating Rules From Now On

1. One workstream per implementation pass.
2. No task may mix infrastructure, auth, role UX, moderation UX, and unrelated admin work in the same execution slice.
3. Every slice must begin with reproducible evidence:
   - log excerpt
   - API failure
   - broken UI flow
   - test failure
4. Every symbol change must have an impact check before editing.
5. Every slice must end with explicit validation:
   - diagnostics clean
   - build passes
   - targeted runtime or test verification
6. If evidence is stale or comes from a subagent, verify source directly before patching.
7. No new feature expansion until the current workstream is behaviorally stable.

## Delivery Structure

The reset plan is divided into gated tracks. Each track must be reviewed and closed before the next one begins.

## Track 0 - Stabilization Baseline

**Goal:** Establish one trustworthy baseline for code, runtime, and database state.

### Tasks

1. Capture current local build status for backend and frontend.
2. Capture current runtime status for:
   - frontend startup
   - backend startup
   - admin page load
   - login flows
   - map ping load
3. Inventory current environment dependencies:
   - Supabase schema version
   - pending migrations
   - Hangfire configuration mode
   - auth seed/admin credentials availability
4. Create one issue ledger with reproducible symptoms and evidence links.

### Required Outputs

- Build report
- Runtime report
- Schema drift report
- Issue ledger

### Exit Criteria

- The team can say which failures are code defects, which are environment defects, and which are data/schema defects.

## Track 1 - Database And Environment Alignment

**Goal:** Remove false application failures caused by infrastructure mismatch.

### High-Priority Scope

1. Align Supabase schema with current entity and migration expectations.
2. Resolve `ConditionImageUrl` drift and any adjacent `Pings` column drift.
3. Re-check Hangfire and connection pooler compatibility.
4. Re-check blacklist persistence and auth-related database pressure.

### Review Questions

1. Which migrations exist in code but are absent in Supabase?
2. Which runtime queries fail because the database shape is older than the code?
3. Which background services are safe in the current local/dev environment?

### Validation

- `GET /api/map/pings` succeeds
- `POST /api/map/pings` succeeds
- auth-protected requests no longer fail because of schema drift

### Do Not Mix With

- role UX
- comment moderation UI
- chatbot changes

## Track 2 - Authentication And Admin Access

**Goal:** Make admin and core auth flows trustworthy before deeper UI diagnosis.

### Scope

1. Standard login
2. Google login
3. admin auth and authorization
4. token blacklist behavior under load
5. unauthorized admin page failure states

### Tasks

1. Reproduce 401/timeout paths with known credentials or seeded users.
2. Verify role claims and policies for admin endpoints.
3. Verify JWT validation path and blacklist query behavior.
4. Confirm whether the admin icon issue is real UI rendering or only a symptom of admin data failure.

### Validation

- admin dashboard loads with valid admin session
- admin system stats endpoint succeeds
- logout/login/token blacklist path does not cause avoidable DB pressure

## Track 3 - Comment Moderation And Restore Flow

**Goal:** Make comment moderation consistent across API, admin restore views, and social surfaces.

### Scope

1. hide comment flow
2. restore comment flow
3. hidden comment listing rules
4. notification sent/not-sent behavior
5. audit visibility in admin

### Tasks

1. Review all moderation endpoints and DTOs.
2. Review all UI surfaces using comment hide/restore.
3. Normalize shared moderation semantics.
4. Add focused tests for hide, restore, expiry, and notification behavior.

### Current Session Carry-Over

- SocialPage was aligned to `HideCommentModal`.
- Admin hidden comments now show notification state.
- Expired hidden comments are excluded in the admin query.

### Still Needed

- confirm public comment queries match the final moderation semantics
- add targeted automated coverage
- verify restore behavior against cleanup timing

## Track 4 - Role Workflow Review

**Goal:** Review each role as a separate product flow, not as a shared "role features" bucket.

### Rule

Each role must be reviewed in its own sub-phase. Do not bundle all three in one pass.

### Track 4A - Person In Need

Review:

1. create SOS
2. view my SOS
3. confirm safe
4. receive sponsor offers
5. receive volunteer progress notifications
6. profile and contact snapshot behavior

Exit criteria:

- a person-in-need user can complete their full SOS lifecycle without manual DB intervention

### Track 4B - Volunteer

Review:

1. browse available tasks
2. accept task
3. view only my active tasks
4. complete task with notes
5. see history and stats
6. confirm notifications and route behavior

Current session carry-over:

- backend assignment persistence added
- completion, history, and stats endpoints added
- panel history/stats/complete flow added

Still needed:

- runtime verification with a real volunteer user
- regression testing around task ownership and status transitions

### Track 4C - Sponsor

Review:

1. search cases
2. offer help
3. prevent duplicate pending offers
4. view offer history
5. inspect support impact summary
6. confirm target-user notification behavior

Current session carry-over:

- persisted `HelpOffer`
- duplicate pending offer guard
- offer history and impact endpoints
- sponsor history and impact UI

Still needed:

- runtime verification with a real sponsor user
- confirm status transition rules for accepted and declined offers

## Track 5 - Map, Ping, And Operational SOS Flow

**Goal:** Stabilize the main emergency flow after schema and role issues are controlled.

### Scope

1. create ping
2. load pings
3. map filtering
4. ping detail visibility
5. OSRM route generation
6. volunteer and sponsor interaction from map surfaces

### Validation

- authenticated and unauthenticated map behaviors match the intended access rules
- ping detail redaction works correctly by role
- route selection behaves correctly with alternatives

## Track 6 - Social, Reports, And Community Safety

**Goal:** Review the social system as its own bounded feature set.

### Scope

1. post creation and pagination
2. image handling
3. comments and moderation
4. reactions
5. reports
6. sanitization and abuse handling

### Needed Deliverables

- abuse and moderation rule inventory
- missing automation list
- follow-up plan for warnings and repeat violations

## Track 7 - Chatbot, Media, And AI Surfaces

**Goal:** Isolate chatbot and image-related behavior from the core rescue flow.

### Scope

1. Gemini request path
2. image validation and size enforcement
3. cache behavior
4. failure states and user messaging

### Rule

- Do not touch chatbot work until Tracks 0 through 5 are stable unless a production blocker explicitly points there.

## Track 8 - Test And Release Hardening

**Goal:** Close the loop so future repairs do not degrade previously fixed flows.

### Tasks

1. Build a targeted test matrix by workstream.
2. Add regression tests only after behavior is agreed and stable.
3. Separate smoke tests from deeper E2E suites.
4. Create a release checklist for schema, config, and auth validation.

### Minimum Regression Set

1. login and logout
2. admin dashboard load
3. create SOS
4. volunteer accept and complete
5. sponsor offer help
6. hide and restore comment
7. person in need confirm safe

## Mandatory Workflow For Each Future Task

### Before Editing

1. Write the exact symptom.
2. Gather the exact log, request, or screenshot evidence.
3. Map the symbols and direct callers.
4. Declare what is out of scope.

### During Editing

1. Touch one workstream only.
2. Prefer the smallest complete fix that resolves the root cause.
3. Do not fold opportunistic refactors into the same pass.

### After Editing

1. Run diagnostics on edited files.
2. Run backend compile and frontend build when relevant.
3. Run targeted runtime or test verification.
4. Record remaining risk explicitly.

## Recommended Work Order

1. Track 0 - Stabilization baseline
2. Track 1 - Database and environment alignment
3. Track 2 - Authentication and admin access
4. Track 3 - Comment moderation and restore flow
5. Track 4A - Person In Need
6. Track 4B - Volunteer
7. Track 4C - Sponsor
8. Track 5 - Map and ping flow
9. Track 6 - Social and reports
10. Track 7 - Chatbot and AI surfaces
11. Track 8 - Test and release hardening

## Immediate Recommendation After This Session

The next task should not be another mixed repair pass. It should be a clean Track 0 plus Track 1 execution focused on environment truth:

1. prove local and remote runtime state
2. align Supabase schema with current code
3. re-verify admin access with a valid admin user
4. only then continue deeper feature review

That sequence will reduce false failures and stop the project from accumulating more partially verified fixes.