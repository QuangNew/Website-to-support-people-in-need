# Forgot Password Implementation

## Backend Changes

### 1. DTOs Added (`src/ReliefConnect.Core/DTOs/DTOs.cs`)
- `ForgotPasswordDto` - Email input for password reset request
- `ResetPasswordDto` - Token and new password for reset

### 2. Entity Updated (`src/ReliefConnect.Core/Entities/ApplicationUser.cs`)
- `PasswordResetToken` - 6-digit reset code
- `PasswordResetTokenExpiry` - 15-minute expiration

### 3. API Endpoints (`src/ReliefConnect.API/Controllers/AuthController.cs`)
- `POST /api/auth/forgot-password` - Sends reset code via email (Hangfire background job)
- `POST /api/auth/reset-password` - Validates token and resets password

### 4. Database Migration
- Migration created: `AddPasswordResetFields`
- Run `dotnet ef database update` when database is available

## Frontend Changes

### 1. API Service (`client/src/services/api.ts`)
- `authApi.forgotPassword(email)` - Request reset code
- `authApi.resetPassword(token, newPassword)` - Reset password

### 2. Components Created
- `ForgotPasswordModal.tsx` - Email input form
- `ResetPasswordModal.tsx` - Token + new password form

### 3. State Management (`client/src/stores/mapStore.ts`)
- Added `'forgot-password'` and `'reset-password'` to modal states

### 4. UI Integration (`client/src/components/layout/MapShell.tsx`)
- Imported and rendered new modals

### 5. Login Modal Updated (`client/src/components/auth/LoginModal.tsx`)
- Added "Forgot Password?" link below login button

### 6. Translations Added
- English (`client/src/i18n/en.json`)
- Vietnamese (`client/src/i18n/vi.json`)

## User Flow

1. User clicks "Forgot Password?" on login modal
2. Enters email → receives 6-digit code via email (15-min expiry)
3. Enters code + new password → password reset
4. Redirected to login modal

## Security Features

- 6-digit random token (same pattern as email verification)
- 15-minute expiration
- Token cleared after successful reset
- Email sent via background job (Hangfire)
- Uses ASP.NET Identity's `ResetPasswordAsync` for secure password hashing
