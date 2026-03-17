# Role-Specific Features Implementation

## Summary

Implemented missing role-specific functionality based on SRS documentation.

## Implementation Status

### ✅ PersonInNeed (Already Implemented)
- **POST /api/map/pings** - Create SOS requests
- **POST /api/social/posts** - Create social posts
- **POST /api/map/pings/{id}/confirm-safe** - Confirm safety

### ✅ Sponsor (NEW)
**Controller:** `SponsorController.cs`

- **GET /api/sponsor/cases** - Search support cases
  - Filter by category, status, location radius
  - Returns both SOS cases and social posts

- **POST /api/sponsor/offer-help** - Offer help to specific case
  - Sends notification to person in need

### ✅ Volunteer (NEW)
**Controller:** `VolunteerController.cs`

- **GET /api/volunteer/tasks** - View available SOS tasks
  - Optional location-based sorting

- **POST /api/volunteer/accept-task** - Accept task
  - Updates ping status to InProgress

- **GET /api/volunteer/my-tasks** - View accepted tasks

- **PUT /api/map/pings/{id}/status** - Update task status (existing)

### ✅ Admin (Already Implemented)
- **GET /api/admin/users** - Manage users
- **PUT /api/admin/users/{id}/role** - Approve roles
- **DELETE /api/admin/posts/{id}** - Moderate content
- **GET /api/admin/stats** - View statistics
- **POST /api/zone** - Manage priority zones

## New DTOs Added

```csharp
// Sponsor
public class OfferHelpDto
{
    public int PingId { get; set; }
    public string? Message { get; set; }
}

// Volunteer
public class AcceptTaskDto
{
    public int PingId { get; set; }
}
```

## Files Modified/Created

1. **Created:** `src/ReliefConnect.API/Controllers/SponsorController.cs`
2. **Created:** `src/ReliefConnect.API/Controllers/VolunteerController.cs`
3. **Modified:** `src/ReliefConnect.Core/DTOs/DTOs.cs` (added new DTOs)

## Authorization Policies Used

- `RequireSponsor` - Sponsor endpoints
- `RequireVolunteer` - Volunteer endpoints
- `RequirePersonInNeed` - Person in need endpoints
- `RequireAdmin` - Admin endpoints

All implementations follow minimal code principles and integrate with existing infrastructure.
