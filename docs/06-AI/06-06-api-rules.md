# 06-06 API Rules

## Purpose

Standard rules for creating and calling APIs in Framee — both on the backend (Express) and frontend (Axios). Consistent API design simplifies integration and reduces communication bugs between frontend and backend.

---

## 1. Standard Response Format (Backend)

Every response from the Framee API MUST follow this format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```
`meta` is only present on list responses. Single document responses do not need `meta`.

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A user-friendly error message.",
    "details": [
      { "field": "customer_name", "message": "This field is required." }
    ]
  }
}
```
`details` is only present if the error is per-field (ValidationError).

---

## 2. HTTP Status Codes Used

| Status | When |
|--------|------|
| `200 OK` | GET, PUT success |
| `201 Created` | POST create success |
| `204 No Content` | DELETE success (no body) |
| `400 Bad Request` | BusinessRuleError (business rule violated) |
| `401 Unauthorized` | Token missing / expired |
| `403 Forbidden` | User lacks permission |
| `404 Not Found` | Document / DocType not found |
| `409 Conflict` | Document is Locked / Version mismatch |
| `422 Unprocessable Entity` | ValidationError (wrong input format) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | System error |

---

## 3. Endpoint Rules (Backend)

### Use Nouns, Not Verbs in URLs
- ✅ `GET /api/v1/doc/Customer` (noun: Customer document)
- ❌ `GET /api/v1/getCustomer` (verb)

### Special Actions (Lifecycle)
For actions that are not pure CRUD, use sub-resources:
- ✅ `POST /api/v1/doc/SalesInvoice/:id/submit`
- ✅ `POST /api/v1/doc/SalesInvoice/:id/cancel`
- ❌ `POST /api/v1/submitSalesInvoice`

### Versioning
Always use the version prefix `/api/v1/`. On breaking changes, bump to `/api/v2/` and maintain `/api/v1/` for backward compatibility.

---

## 4. Standard Query Parameters (GET List)

All list endpoints MUST support these parameters:

| Parameter | Example | Description |
|-----------|---------|-------------|
| `page` | `?page=2` | Page number (default: 1) |
| `pageSize` | `?pageSize=50` | Records per page (default: 20, max: 200) |
| `sort` | `?sort=created_at:desc` | Sorting: `{field}:{asc\|desc}` |
| `search` | `?search=maju` | Full-text search |
| `filters[field]` | `?filters[status]=Draft` | Field-specific filter |
| `fields` | `?fields=name,status` | Select returned fields |

---

## 5. API Calling Rules (Frontend — Axios)

### Use a Centralized Axios Instance
Never call `axios.get(...)` directly. Always use the instance from `lib/axios.js` that is pre-configured with the base URL and interceptors.

```javascript
// ✅ Correct
import api from '@/lib/axios';
const { data } = await api.get('/doc/Customer');

// ❌ Wrong
import axios from 'axios';
const { data } = await axios.get('http://localhost:3001/api/v1/doc/Customer');
```

### Use Custom Hooks for Fetching
Create a custom hook for each repeated fetching pattern. Do not repeat the same fetch logic in multiple components.

```javascript
// ✅ Correct
function DocList({ doctype }) {
  const { data, isLoading } = useDocList(doctype);
}

// ❌ Wrong — fetch logic directly in component
function DocList({ doctype }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    api.get(`/doc/${doctype}`).then(r => setData(r.data.data));
  }, [doctype]);
}
```

---

## 6. API Security Rules

1. **All endpoints (except `/auth/login` and `/auth/refresh`) must be protected** by the Auth Middleware.
2. **No endpoint may accept `tenant_id` from the request body**. `tenant_id` is always derived from the JWT token.
3. **No endpoint reads data across tenants**. All queries are automatically scoped to the tenant from the token.
4. Admin endpoints (e.g., `/admin/audit-log`) must validate the `System Manager` role inside the Controller, not just rely on the JWT middleware.
