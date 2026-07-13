# 04-02 Request Lifecycle

## Purpose

Documents the lifecycle of an HTTP request entering Framee. This is essential so all developers understand at which point they can intervene (middleware, hook, event), and how a request is processed from start to finish.

---

## 1. Gateway Phase (Express.js)

This phase handles requests at the HTTP level before they enter framework logic.

1. **Client Request**: The client (Browser, Mobile) sends an HTTP request to the Framee REST API.
2. **CORS Filter**: Express `cors` middleware checks the request origin.
3. **Rate Limiting**: `express-rate-limit` checks Redis based on IP or Client ID. If the limit is exceeded, returns `429 Too Many Requests`.
4. **Body Parsing**: `express.json()` and `express.urlencoded()` parse the payload into `req.body`.
5. **Authentication & Tenant Injection**:
   - Checks the `Authorization: Bearer <token>` header.
   - If a token is present, verifies it against the JWT Secret.
   - Extracts `user_id` and `tenant_id` from the token payload.
   - Injects into the request object: `req.user` and `req.tenant`.
   - If this is a *protected* route and the token is invalid or missing, returns `401 Unauthorized`.
6. **Request Logging**: Middleware records the beginning of execution to Winston (level: INFO or DEBUG).

---

## 2. API Routing Phase (API Engine)

Framee uses dynamic routing. There are no manually written `router.post('/customer')` calls for each DocType.

1. **Route Matching**: Express matches the URL against the dynamic route pattern (e.g., `/api/v1/doc/:doctype`).
2. **Controller Dispatch**: The generic route handler calls the appropriate CRUD Engine or Service Layer.
3. **Payload Normalization**: Ensures the payload conforms to the standard format before being forwarded to the Engine.

---

## 3. Pre-Execution Phase (Core Engines)

Before the database operation actually runs, the request must pass through several "gates".

1. **Metadata Loading** (Metadata Engine):
   - Fetches the DocType definition (e.g., "Customer") from Cache (Redis) or DB.
   - If the DocType does not exist, returns `404 Not Found`.
2. **Permission Check** (Permission Engine):
   - Checks whether `req.user` has a role with the appropriate permission for this action (Read, Write, Create, Delete, Submit, etc.) on this DocType.
   - If not, returns `403 Forbidden`.
3. **Lifecycle Gate** (Document Lifecycle Engine):
   - If this is a Write/Update/Delete/Submit operation:
     - Fetches the current document status from the DB.
     - Checks whether the status transition or operation is permitted at the current status.
     - If the document is already "Locked" and the action is not "Amend", returns `409 Conflict`.
4. **Validation** (CRUD Engine + Metadata):
   - Validates `req.body` against DocField rules (data type, required, max length).
   - Validates Link field values to confirm they exist in the DB.
   - If validation fails, returns `422 Unprocessable Entity` with error details.
5. **Before Hook / Event Emission** (Event Engine):
   - Emits a sync event: `emitSync('{doctype}.before_insert', { payload, user, tenant })`.
   - Plugins or custom code can throw an error here to abort the entire process.

---

## 4. Execution Phase (Database Engine)

The phase where changes actually happen in the Database.

1. **Transaction Start** (Optional / If needed): Opens a database transaction.
2. **Tenant Scoping**: The Database Engine automatically appends `WHERE tenant_id = :tenant` to every query.
3. **Execution**: Executes the SQL command (INSERT, UPDATE, DELETE, or SELECT).
4. **Transaction Commit**: Commits the transaction if successful.

---

## 5. Post-Execution Phase (Event Engine)

After the database operation completes, asynchronous events are fired.

1. **After Hook / Event Emission**:
   - Emits an async event: `emitAsync('{doctype}.after_insert', { payload, user, tenant })`.
2. **Audit Logging** (Audit Engine):
   - Subscribed to the above event.
   - Calculates the "diff" (changed field values) for UPDATE operations.
   - Writes to `sys_audit_log` (Global Log) and `dt_{doctype}_logs` (Local Log).
   - Runs asynchronously in the background — does not block the client response.
3. **Version Snapshot** (Version Engine):
   - If `track_changes = true`, creates a JSON snapshot of the document after the change.
4. **Trigger Workflow / Notifications**:
   - Other plugins or workers react to the event.

---

## 6. Response Phase

1. **Format Output**: Wraps the result data into Framee's standard JSON structure (typically `success: true, data: {...}`).
2. **Send Response**: Sends the HTTP response (e.g., `201 Created` or `200 OK`) to the client.
3. **End Request Logging**: Calculates duration (latency) and logs to Winston.

---

## Error Handling Flow

If an error is thrown at any phase:
1. Caught by the global error handler middleware in Express.
2. Determines the status code based on error type (e.g., `ValidationError` → 422, `DatabaseError` → 500, `UnauthorizedError` → 401).
3. Logs the error in detail to the logger (with full stack trace in dev environment).
4. Sends a standardized error response to the client:
   ```json
   {
     "success": false,
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Field 'customer_name' is required.",
       "details": [...]
     }
   }
   ```
