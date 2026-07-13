# 04-06 Metadata Loading

## Purpose

Documents how the Metadata Engine (the heart of Framee) reads, loads, caches, and serves metadata to all system components (CRUD, API, Permission, Frontend).

---

## 1. Metadata Sources

Metadata in Framee is ultimately stored in the Database:
- `sys_doctype` (table definitions)
- `sys_docfield` (column definitions)
- `sys_workflow` (workflow definitions)
- Etc.

However, during development or plugin deployment, metadata often originates from JSON files (`.json`).

---

## 2. Bootstrapping (JSON to DB)

When the application starts (or when `npm run migrate:meta` is run):
1. The system scans the `/metadata` folder in core and all active plugins.
2. Reads `.json` files.
3. Performs a synchronization (UPSERT) to the `sys_doctype` and `sys_docfield` tables.
4. The Database Engine triggers DDL (`CREATE TABLE` / `ALTER TABLE`) if there are schema changes (see `02-02-doctype.md`).

---

## 3. Caching Strategy (DB to Memory)

Reading from the database (MySQL) on every request would be very slow. Therefore, the Metadata Engine uses aggressive caching.

### Level 1: In-Memory Cache (Node.js Map)
- The engine stores metadata objects in a `Map` in Node.js RAM.
- Access is instant (0 ms).
- Because the backend architecture is stateless, if multiple workers/pods are running, each pod has its own in-memory cache.

### Level 2: Distributed Cache (Redis)
- On an in-memory cache miss, data is fetched from Redis.
- When an administrator changes metadata (e.g., adding a field via UI), the Metadata Engine updates the DB, invalidates the Redis key, then broadcasts a Pub/Sub event `meta_changed`.
- All workers/pods listen to `meta_changed` and clear their In-Memory Cache.

---

## 4. Metadata Object Structure

When `MetadataEngine.getDocMeta('Customer')` is called, it returns a fully merged structured object:

```json
{
  "name": "Customer",
  "is_submittable": false,
  "track_changes": true,
  "fields": [
    {
      "fieldname": "customer_name",
      "fieldtype": "Data",
      "reqd": 1,
      "in_list_view": 1
    },
    {
      "fieldname": "status",
      "fieldtype": "Select",
      "options": ["Draft", "Active", "Archived"]
    }
  ],
  "permissions": [ ... ],
  "workflow": null
}
```

*This object is the "blueprint" that the CRUD Engine will execute against.*

---

## 5. Serving Metadata to the Frontend

The frontend does not hardcode any table definitions.
1. When a user opens `/doctype/Customer`, Next.js calls `GET /api/v1/meta/doctype/Customer`.
2. The frontend stores it in the Zustand Store (`useMetaStore`).
3. Dynamic Form and Dynamic List render the UI purely based on the fields from the JSON above.
