# ReliefConnect Knowledge Base: Relief Map Guide

> Last synchronized: 2026-04-18
> Scope: relief map behavior, ping lifecycle, filters, routing, territory validation, and notifications.
> Retrieval note: this file is written to answer map, SOS, and geospatial workflow questions without requiring context from other files.

## 1. What the Relief Map Shows

The Relief Map is the core operational surface of ReliefConnect. The map shows pings representing SOS cases, supply-related points, and shelter-related points. The map is readable by the public through the `GET /api/map/pings` endpoint, with optional radius filtering.

## 2. Ping Types and Statuses

ReliefConnect uses map item types such as `SOS`, `Supply`, and `Shelter`. ReliefConnect uses SOS statuses such as `Pending`, `InProgress`, `Resolved`, and `VerifiedSafe`.

In the current implementation:

- Public users can read pings.
- Authenticated users can create pings.
- Volunteers can update ping status.
- People in need can confirm their own safety.
- Supply and shelter ping creation is restricted to administrators.

## 3. Creating an SOS Request

The current SOS flow is stricter than the earlier minimal version. A signed-in user can create an SOS ping only after the form captures:

- GPS location inside Vietnam territory.
- A real contact name.
- A phone number.
- Optional free-text details.
- An optional condition image uploaded through the shared image upload flow.

The user guide content inside the frontend still follows the same high-level sequence:

- Open the map.
- Press the red SOS button.
- Confirm GPS location.
- Add contact details.
- Add situation details and an optional image.
- Submit the request so it appears on the map.

The map tests confirm that the SOS button exists, the map loads correctly, and the filter bar is visible.

## 4. SOS Contact Visibility

SOS responses now use role-aware redaction rules.

- Unauthenticated viewers can see the reporter name and condition image only.
- Logged-in guests can see the reporter name and condition image only.
- `PersonInNeed` users can see the reporter name and condition image only.
- Volunteers, sponsors, and administrators can also see the reporter phone number and email.

This visibility rule is enforced in the backend DTO mapping, not only in the React UI, so list and detail endpoints stay consistent.

## 5. Filtering the Relief Map

The relief map supports type-based filtering and search-oriented browsing. The frontend guide text describes filters for help requests, supply points, and shelters. The backend supports radius-based retrieval using latitude, longitude, and `radiusKm`.

## 6. Route Guidance

ReliefConnect uses OSRM for route guidance on the frontend side. The user can inspect route alternatives and choose a preferred route visually. This is a client-driven routing experience rather than a dedicated backend route-planning service.

## 7. Vietnam Territory Validation

Map ping creation validates that coordinates are inside Vietnam territory, including mainland and island zones such as Hoang Sa, Truong Sa, Con Dao, and Phu Quoc. This prevents irrelevant or invalid map submissions from outside the intended operating region.

## 8. Safety Confirmation

People in need can confirm safety for their own ping. When a ping is confirmed safe, blinking alert state is cleared and volunteers can be notified.

## 9. Volunteer Notifications

When a new SOS ping is created, the backend can notify volunteers through the notification service. Real-time distribution is also supported through a SignalR hub mapped at `/hubs/sos-alerts`.

## 10. Map Retrieval Model Summary

ReliefConnect relies on PostgreSQL plus PostGIS for geospatial storage and filtering. Spatial filters are central to ping retrieval, and public access is supported while protected write actions remain role-aware.

The map experience is designed for Vietnam-specific emergency response and highlights local emergency contact expectations alongside geographic validation rules.