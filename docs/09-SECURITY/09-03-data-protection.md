# 09-03 Data Protection

## Purpose

Documents how Framee handles sensitive data, PII (Personally Identifiable Information), and cryptographic requirements to ensure data privacy and security.

---

## 1. Password Storage

- Passwords are never stored in plaintext.
- Hashing Algorithm: **Bcrypt**
- Cost Factor (Rounds): Minimum `12`.
- Passwords must be hashed at the Service Layer before passing the payload to the CRUD/Database Engine.

```javascript
// Example in AuthService
import bcrypt from 'bcrypt';
const hashedPassword = await bcrypt.hash(plainPassword, 12);
```

---

## 2. JWT Secrets and Key Management

- `JWT_SECRET` must be a cryptographically secure random string of at least 64 characters.
- In production, it must be injected via Environment Variables or a Secret Manager (e.g., AWS Secrets Manager, HashiCorp Vault), never committed to code.
- Changing the `JWT_SECRET` will instantly invalidate all currently issued access tokens across the system, forcing users to use their refresh tokens (which are validated against the DB/Redis).

---

## 3. PII and Data Masking

For fields containing Highly Sensitive PII (e.g., National ID, Credit Card numbers):
1. **FieldType "Password"**: Framee supports a `Password` fieldtype in metadata. The API Engine will automatically mask the output of this field in GET requests (e.g., `********`).
2. **Encryption at Rest**: If required by tenant compliance, specific fields can be encrypted at the application level before being saved to MySQL, though MySQL TDE (Transparent Data Encryption) is the preferred approach for whole-database encryption at rest.

---

## 4. Prevent Data Leakage via Error Messages

The global error handler in Express must scrub technical details from error responses in production.

**Development Environment (`APP_ENV=development`):**
```json
{
  "success": false,
  "error": {
    "code": "DB_ERROR",
    "message": "ER_DUP_ENTRY: Duplicate entry 'test@test.com' for key 'users.email'",
    "stack": "Error: ER_DUP_ENTRY...\n at Query.execute..."
  }
}
```

**Production Environment (`APP_ENV=production`):**
```json
{
  "success": false,
  "error": {
    "code": "DB_ERROR",
    "message": "A database error occurred."
  }
}
```
*(The real error stack is written to Winston logs for administrators).*

---

## 5. Audit Logging for Security Events

The following events must trigger a mandatory write to `sys_audit_log`, regardless of the DocType's `track_changes` setting:
- Successful login
- Failed login attempt
- Password change/reset
- Role assignment changes (`sys_user_role`)
- Permission configuration changes (`sys_permission`)
