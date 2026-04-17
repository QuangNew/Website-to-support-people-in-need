# ReliefConnect Knowledge Base: Overview and Workflows

> Last synchronized: 2026-04-16
> Scope: product overview, mission, user roles, and core workflows.
> Retrieval note: this file is self-contained so it can be embedded independently from the rest of the knowledge base.

## 1. ReliefConnect Overview

ReliefConnect is a full-stack humanitarian web platform that connects people in need with volunteers, sponsors, and administrators during disasters, hardship, and community emergencies. The platform combines a live relief map, a community social feed, and an AI assistant in one application.

ReliefConnect is designed for Vietnam first. The product uses Vietnamese as the primary language, supports English as a secondary language, validates map coordinates against Vietnam territory, and surfaces local emergency numbers such as 113, 114, and 115.

ReliefConnect solves a coordination problem. Traditional relief coordination is often fragmented across phone calls, messages, spreadsheets, and social posts. ReliefConnect centralizes SOS requests, public support signals, volunteer action, moderation, and operational records into one system.

ReliefConnect is implemented as a client-server application with a React frontend, an ASP.NET Core backend, and a PostgreSQL plus PostGIS database hosted through Supabase.

## 2. Mission and Value

ReliefConnect exists to reduce the time between a request for help and a meaningful response.

ReliefConnect creates value through several connected capabilities:

- A relief map shows SOS requests, supply points, shelters, and risk-aware locations.
- A social layer lets users explain circumstances, share evidence, and attract community help.
- A role system separates people in need, volunteers, sponsors, and administrators.
- A chatbot helps with first-aid guidance, survival guidance, and platform usage questions.
- An admin system creates auditability through moderation, verification, logs, and announcements.

## 3. Primary Users and Roles

### 3.1 Guest

Guest users can browse the map in read-only mode and view community content that does not require authentication. Guest users cannot create SOS requests, accept volunteer tasks, or use protected profile functions.

### 3.2 Authenticated Guest

Authenticated guests have an account and can log in, manage their profile, verify email, and submit a role verification request. Authenticated guests are the bridge state before role approval.

### 3.3 Person in Need

Person in Need is the role for affected individuals or households. This role is intended for users who need to create SOS requests, confirm safety, describe hardship, and receive support.

### 3.4 Volunteer

Volunteer is the role for users who respond to active SOS work. Volunteers can browse available tasks, accept tasks, and update SOS status when helping in the field.

### 3.5 Sponsor

Sponsor is the role for users or organizations that want to offer money, supplies, or targeted assistance. Sponsors can search support cases and send help offers.

### 3.6 Admin

Admin is the system operator role. Administrators approve roles, moderate posts and reports, manage announcements, review logs, force-resolve SOS requests, and maintain platform integrity.

### 3.7 Verification Status

ReliefConnect uses explicit verification states:

- `None`: no verification request has been submitted.
- `Pending`: the user has submitted a role verification request.
- `Verified`: the request was approved and the role was granted.
- `Rejected`: the request was reviewed and denied.

## 4. Core User Workflows

### 4.1 SOS Request Workflow

The SOS workflow starts when an authenticated user creates a ping on the relief map. A ping stores location, type, status, details, creator, and timestamps. New SOS pings begin as `Pending`. Volunteers can move a ping to `InProgress` or `Resolved`, and a person in need can mark a ping as `VerifiedSafe` through the confirm-safe action.

If a ping remains unconfirmed for too long, the platform can mark it as blinking through `PingFlag` state. That visual state is intended to draw attention to urgent unresolved requests.

### 4.2 Role Verification Workflow

The role verification workflow begins after account creation and email verification. A user submits a requested role, a reason, contact information, and supporting image URLs. The request is reviewed by administrators. Approved requests change role and verification status. Rejected requests stay visible as a moderation outcome and can be resubmitted later.

### 4.3 Social Support Workflow

The social workflow allows users to create posts, add reactions, and add comments. Posts are categorized into humanitarian categories so that the feed can be filtered by theme and urgency. Sponsors can also use social content as part of support case discovery.

### 4.4 Sponsor Offer Workflow

The sponsor workflow currently supports searching across SOS cases and social posts, then sending a help offer message. In the current implementation, the offer action sends a notification to the target user. The repository also contains entity and schema support for `HelpOffer`, but the sponsor API path currently behaves more like a notification-first workflow than a full offer-tracking workflow.

### 4.5 Admin Batch Workflow

Administrative batch actions create parent-child log structures. A parent `SystemLog` entry records the batch, and child entries record the individual operations. This improves auditing and CSV export clarity.