# 04-14 Error Handling

## Purpose

Documents how Error Handling works in Framee. The primary goal is to ensure the client (frontend) always receives a standardized, predictable error format, while internal logs retain adequate stack traces for debugging.

---

## 1. Custom Error Classes (FrameeError)

Framee does not use the built-in JavaScript `Error` object for HTTP responses. Framee has a custom Error hierarchy that maps directly to HTTP Status Codes.

| Class | HTTP Status | Use Case |
|-------|-------------|----------|
| `ValidationError` | 422 | Wrong input format, empty required fields. |
| `AuthenticationError` | 401 | JWT token is invalid / expired / missing. |
| `ForbiddenError` | 403 | User does not have Permission for that Role. |
| `NotFoundError` | 404 | Document, Route, or DocType not found. |
| `ConflictError` | 409 | Document is already Locked, Version mismatch (optimistic locking). |
| `BusinessRuleError` | 400 | Business rule violated (e.g., "Insufficient stock"). |
| `SystemError` | 500 | Database down, Redis offline, backend syntax error. |

---

## 2. Standard Error Response Structure

All errors thrown inside a Controller, Service, or CRUDEngine are caught by the **Global Error Handler Middleware**.

That middleware transforms the error into this uniform format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is invalid.",
    "details": [
      {
        "field": "customer_name",
        "message": "This field is required."
      },
      {
        "field": "discount_amount",
        "message": "Discount cannot exceed 100%."
      }
    ]
  }
}
```

*The frontend only needs to read `response.data.error.message` to display to the User.*

---

## 3. Global Error Handler (Express Middleware)

At the end of the Express router chain (in `server.js`):

```javascript
app.use((err, req, res, next) => {
  // 1. Determine status code
  const status = err.statusCode || 500;
  
  // 2. Logging (hide stack trace from production response, but record to logger)
  if (status >= 500) {
    logger.error(`[SystemError] ${err.message}`, { stack: err.stack, path: req.path });
  } else {
    logger.warn(`[${err.name}] ${err.message}`, { user: req.user?.id });
  }
  
  // 3. Format payload
  const errorPayload = {
    code: err.errorCode || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An internal server error occurred.',
  };
  
  if (err.details) errorPayload.details = err.details;
  
  // 4. Send response
  res.status(status).json({
    success: false,
    error: errorPayload
  });
});
```

---

## 4. Throwing Errors in Services / Plugins

Inside a plugin or service, you **MUST NOT** return an error object or call `res.status(400)`. You **MUST** throw.

**Correct:**
```javascript
if (doc.status === 'Locked') {
  throw new ConflictError("A Locked document cannot be modified.");
}
```

**Wrong (Anti-Pattern):**
```javascript
if (doc.status === 'Locked') {
  return res.status(409).json({ error: 'Locked' }); // Service layer must not touch res
}
```

---

## 5. Fail-Fast on Startup

If a Database or Redis connection fails during startup, the system must call `process.exit(1)` (Fail-Fast). Do not allow the API server to accept requests if its critical dependencies are unavailable. PM2 or Kubernetes will automatically restart the process (Self-Healing).
