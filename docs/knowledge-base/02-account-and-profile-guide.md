# ReliefConnect Knowledge Base: Account and Profile Guide

> Last synchronized: 2026-04-16
> Scope: account creation, authentication, profile management, and role request flow.
> Retrieval note: this file keeps all onboarding and profile steps together so account-related questions embed cleanly.

## 1. Creating an Account

To create an account, a user registers with username, email, full name, and password. The password must meet ASP.NET Core Identity rules configured by the application: minimum length 8, at least one uppercase letter, one lowercase letter, and one digit.

After registration, the system sends a 6-digit email verification code. That code expires after 15 minutes.

## 2. Verifying Email

After login, the user can submit the 6-digit verification code through the email verification endpoint. The verification code comparison uses a constant-time comparison function to reduce timing attack risk.

## 3. Logging In

ReliefConnect supports login by either email or username. This behavior is both implemented in the backend and covered by automated API tests.

## 4. Google Sign-In

ReliefConnect supports Google OAuth login. If the Google account email matches an existing ReliefConnect user, the system links or reuses that identity. If not, it can create a new guest account from the Google profile.

## 5. Resetting a Password

Users can request a password reset through email. The system sends a 6-digit reset token with a 15-minute expiry. The reset token is validated with constant-time comparison before the password is changed.

## 6. Updating a Profile

Authenticated users can retrieve profile data and update basic profile information such as full name and avatar URL. Profile pages also surface role and verification state.

## 7. Requesting a Role

Users request `PersonInNeed`, `Volunteer`, or `Sponsor` through the role verification flow. The request includes reason, phone number, optional address, and up to five image URLs. The system stores requested role details and marks the account as pending review.

## 8. Verification State Meanings

ReliefConnect uses four main verification states for role review:

- `None`: the user has not submitted a verification request yet.
- `Pending`: the request has been submitted and is waiting for admin review.
- `Verified`: the request was approved and the requested role was granted.
- `Rejected`: the request was reviewed and denied.

## 9. Account-Related Security Notes

Account access is protected by ASP.NET Core Identity and JWT Bearer authentication. The platform enforces password complexity, lockout after repeated failed logins, issuer and audience validation, and a minimum 256-bit JWT signing key.

Logout invalidation is supported through a token blacklist keyed by JWT `jti`, although the current frontend still primarily stores tokens in localStorage.