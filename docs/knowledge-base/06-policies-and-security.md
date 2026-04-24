# ReliefConnect Knowledge Base: Policies and Security Controls

> Last synchronized: 2026-04-16
> Scope: acceptable use, privacy, moderation, role policy, enforcement, and security posture.
> Retrieval note: this file is designed to answer compliance, policy, and security questions without requiring the operational or architecture files.

## 1. Acceptable Use Policy

ReliefConnect exists for humanitarian coordination. Acceptable use includes creating genuine SOS requests, offering real help, sharing hardship stories, performing verified volunteer work, and using the AI assistant for relevant support.

Prohibited use includes false SOS reports, impersonation, spam, malicious uploads, system abuse, sharing other people’s personal data without consent, harassment, hate speech, and bypassing platform controls.

## 2. Privacy and Data Handling Policy

ReliefConnect processes several categories of data:

- account data such as email, username, and password hash,
- verification data such as phone number, address, and supporting image URLs,
- location data from map pings,
- content data such as posts, comments, and chatbot messages,
- operational and security data such as logs and access signals.

The application uses this data to deliver services, moderate content, secure access, and coordinate response. The project documentation explicitly states that the platform does not sell user data.

## 3. Role Verification Policy

Higher-trust roles require human review. The system supports one active business role per user. Admin is not self-service and must be assigned separately.

## 4. Content Moderation Policy

Content moderation uses a mix of automated sanitation and administrative review. Users can react, comment, and report. Admins can pin, delete, review, dismiss, or otherwise moderate content.

## 5. SOS Integrity Policy

ReliefConnect treats false SOS requests as serious abuse because they redirect volunteer attention away from real emergencies. The system is built around the expectation that location and emergency details are truthful.

## 6. AI Chatbot Usage Policy

The chatbot is a guidance tool. It is not a replacement for professional emergency, medical, or legal support. Emergency numbers must be used when a situation is truly urgent. Users should treat AI output as assistance, not as a final authoritative decision.

## 7. Enforcement Policy

The repository’s policy material describes a graduated enforcement model that can include content removal, warnings, temporary suspension, permanent ban, and forced logout. Administrative actions are logged through the system log infrastructure.

## 8. Authentication and Authorization Controls

ReliefConnect uses ASP.NET Core Identity with JWT Bearer authentication. The backend enforces:

- minimum 256-bit JWT signing key,
- issuer and audience validation,
- zero clock skew,
- account lockout after repeated failed login attempts,
- authorization policies for admin, volunteer, sponsor, person in need, and verified users.

## 9. Token Safety Controls

The system supports logout invalidation through a token blacklist service keyed by JWT `jti`. Token cleanup is handled by a hosted service. The backend can also read an `auth_token` cookie if present, though the current frontend primarily stores tokens in localStorage and sends them through the API client.

## 10. Request and Browser Security Controls

The application adds security headers including:

- `X-Content-Type-Options: nosniff`,
- `X-Frame-Options: DENY`,
- `Content-Security-Policy`,
- `Strict-Transport-Security`,
- `Referrer-Policy`,
- `Permissions-Policy`.

The backend also configures CORS for frontend origins and enables HTTPS redirection.

## 11. Input and Content Safety Controls

ReliefConnect uses `HtmlSanitizer` for posts, comments, and chatbot messages. Image uploads are type-checked and size-limited. The chatbot validates image MIME type and decodes base64 before processing. The social upload endpoint validates content type, extension, and max size.

## 12. Data and Export Safety Controls

Entity Framework Core parameterized queries reduce SQL injection risk. CSV exports use formula-escaping helpers. Administrative actions are logged for audit review.

## 13. Known Security Limitations

The current repository and project docs identify several important limitations:

- The frontend stores JWT tokens in localStorage, which leaves them exposed if an XSS bug appears.
- The platform does not yet implement refresh-token rotation.
- OSRM routing can expose coordinates to a public routing service.
- Client-side chatbot image cache is not encrypted.