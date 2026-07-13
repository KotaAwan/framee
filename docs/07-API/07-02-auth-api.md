# 07-02 Authentication API

## Purpose

Documents all API endpoints related to Authentication — login, logout, token refresh, and password management. These are the only endpoints that do not require a valid JWT Bearer token.

---

## Base URL

`/api/v1/auth`

---

## Endpoints

### POST `/api/v1/auth/login`

Authenticates a user and returns access and refresh tokens.

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "your_password"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "uuid-here",
      "email": "admin@company.com",
      "full_name": "Administrator",
      "tenant_id": "t-company"
    }
  }
}
```

The `refresh_token` is set as an **httpOnly cookie** (`framee_refresh`) — not in the response body.

**Error Responses:**
- `401` — Invalid email or password.
- `403` — Account is deactivated (`status != 'Active'`).
- `429` — Too many failed attempts. Rate limited.

---

### POST `/api/v1/auth/refresh`

Issues a new access token using the refresh token from the httpOnly cookie.

**Request:** No body required. The `framee_refresh` cookie must be present.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

**Error Responses:**
- `401` — Refresh token missing, expired, or revoked.

---

### POST `/api/v1/auth/logout`

Revokes the current refresh token and clears the httpOnly cookie.

**Request:** Requires valid Bearer token in header.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully." }
}
```

---

### POST `/api/v1/auth/forgot-password`

Initiates a password reset flow by sending an email.

**Request Body:**
```json
{ "email": "admin@company.com" }
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "If this email exists, a password reset link has been sent." }
}
```

> Note: Always returns 200 even if email does not exist (prevents email enumeration).

---

### POST `/api/v1/auth/reset-password`

Resets the password using the token from the email link.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "password": "new_secure_password",
  "password_confirmation": "new_secure_password"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "Password has been reset successfully." }
}
```

**Error Responses:**
- `400` — Token expired, invalid, or passwords do not match.

---

### POST `/api/v1/auth/change-password`

Changes password for the currently authenticated user.

**Request Body:**
```json
{
  "current_password": "old_password",
  "new_password": "new_secure_password"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "data": { "message": "Password changed successfully." }
}
```

**Error Responses:**
- `401` — Current password is incorrect.
