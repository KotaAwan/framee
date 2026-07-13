# 07-05 Activity Timeline API

## Purpose

Documents the API endpoints for the Activity Timeline feature — retrieving the per-document activity log (comments, system events, likes), posting comments, and toggling likes.

---

## Base URL

`/api/v1/activity`

---

## Endpoints

### GET `/api/v1/activity/:doctype/:id`

Returns the Activity Timeline for a specific document — all events in chronological order from a single `dt_*_logs` query.

This includes:
- System events: `CREATE`, `UPDATE`, `SUBMIT`, `CANCEL`, `LOCK`, `ARCHIVE`, `DELETE`
- Social events: `COMMENT`, `LIKE`, `UNLIKE`

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 30)

**Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid-1",
      "action": "CREATE",
      "change_summary": "Document created",
      "user_id": "user-uuid",
      "user_name": "Sutikno",
      "user_avatar": "https://cdn.framee.io/avatars/sutikno.jpg",
      "comment": null,
      "diff": null,
      "created_at": "2026-07-13T08:00:00Z"
    },
    {
      "id": "log-uuid-2",
      "action": "UPDATE",
      "change_summary": "Updated customer_name, phone",
      "user_id": "user-uuid",
      "user_name": "Sutikno",
      "user_avatar": "...",
      "comment": null,
      "diff": { "fields_changed": ["customer_name", "phone"] },
      "created_at": "2026-07-13T08:15:00Z"
    },
    {
      "id": "log-uuid-3",
      "action": "COMMENT",
      "change_summary": null,
      "user_id": "user-uuid-2",
      "user_name": "Budi",
      "user_avatar": "...",
      "comment": "Sudah saya cek, silahkan dilanjutkan.",
      "diff": null,
      "created_at": "2026-07-13T09:00:00Z"
    },
    {
      "id": "log-uuid-4",
      "action": "LIKE",
      "change_summary": null,
      "user_id": "user-uuid-3",
      "user_name": "Siti",
      "user_avatar": "...",
      "comment": null,
      "diff": null,
      "created_at": "2026-07-13T09:05:00Z"
    }
  ],
  "meta": { "total": 10, "page": 1, "pageSize": 30, "totalPages": 1 }
}
```

---

### GET `/api/v1/activity/:doctype/:id/likes`

Returns the like state for the current user and the total like count.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "total_likes": 3,
    "liked_by_me": true
  }
}
```

---

### POST `/api/v1/activity/:doctype/:id/comment`

Posts a new comment on a document.

**Request Body:**
```json
{
  "comment": "This document looks good. Approved."
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "data": {
    "id": "new-log-uuid",
    "action": "COMMENT",
    "comment": "This document looks good. Approved.",
    "user_name": "Sutikno",
    "created_at": "2026-07-13T10:00:00Z"
  }
}
```

---

### PUT `/api/v1/activity/:doctype/:id/comment/:commentId`

Edits an existing comment. Only the comment's original author can edit it, and only within the configurable time window (`COMMENT_EDIT_WINDOW_MINUTES`, default: 15 minutes).

**Request Body:**
```json
{ "comment": "Updated comment text." }
```

**Error Responses:**
- `403` — Not the comment author.
- `409` — Edit window has expired.

---

### POST `/api/v1/activity/:doctype/:id/like`

Toggles the Like state for the current user on a document:
- If not liked → Likes it (inserts into `dt_*_likes` + records `LIKE` event in `dt_*_logs`).
- If already liked → Unlikes it (deletes from `dt_*_likes` + records `UNLIKE` event in `dt_*_logs`).

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "liked": true,
    "total_likes": 4
  }
}
```
