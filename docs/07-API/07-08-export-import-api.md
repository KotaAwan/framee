# 07-08 Export & Import API

## Purpose

Documents the API endpoints for bulk data Export (CSV, XLSX, PDF) and Import (CSV) operations on DocType documents.

---

## Base URL

`/api/v1/export` and `/api/v1/import`

---

## Export Endpoints

### POST `/api/v1/export/:doctype`

Initiates a background export job. Because exporting large datasets can take time, this endpoint immediately returns a Job ID and processes the export asynchronously.

**Request Body:**
```json
{
  "format": "xlsx",
  "fields": ["name", "customer_name", "status", "created_at"],
  "filters": {
    "status": "Active"
  }
}
```

**`format`** options: `csv`, `xlsx`, `pdf` (pdf only for single document, see below).

**Response `202 Accepted`:**
```json
{
  "success": true,
  "data": {
    "job_id": "job-uuid",
    "message": "Export job started. Check the status with the job ID."
  }
}
```

---

### GET `/api/v1/export/status/:jobId`

Polls the status of an export job.

**Response `200 OK` (while processing):**
```json
{
  "success": true,
  "data": {
    "job_id": "job-uuid",
    "status": "processing",
    "progress": 65
  }
}
```

**Response `200 OK` (when complete):**
```json
{
  "success": true,
  "data": {
    "job_id": "job-uuid",
    "status": "completed",
    "download_url": "/api/v1/export/download/job-uuid",
    "expires_at": "2026-07-13T12:00:00Z"
  }
}
```

---

### GET `/api/v1/export/download/:jobId`

Downloads the completed export file. Streams the file directly.

**Response:** Binary file stream with `Content-Disposition: attachment` header.

---

### GET `/api/v1/export/:doctype/:id/pdf`

Generates and downloads a PDF for a single document. This is synchronous (not queued) and typically used for printing invoices, receipts, etc.

**Response:** PDF binary stream.

**Error Responses:**
- `404` — Document not found.
- `403` — No `can_print` permission.

---

## Import Endpoints

### POST `/api/v1/import/:doctype`

Initiates a bulk import from a CSV file. Processes asynchronously as a background job.

**Request:** `multipart/form-data` with a `file` field containing the CSV file.

**Response `202 Accepted`:**
```json
{
  "success": true,
  "data": {
    "job_id": "import-job-uuid",
    "message": "Import job started. 150 rows detected."
  }
}
```

---

### GET `/api/v1/import/status/:jobId`

Polls the status of an import job.

**Response `200 OK` (when complete):**
```json
{
  "success": true,
  "data": {
    "job_id": "import-job-uuid",
    "status": "completed",
    "total_rows": 150,
    "success_count": 148,
    "error_count": 2,
    "errors": [
      {
        "row": 45,
        "field": "customer_type",
        "message": "Invalid value 'Corp'. Allowed: Company, Individual."
      },
      {
        "row": 102,
        "field": "email",
        "message": "Duplicate email 'test@example.com' already exists."
      }
    ]
  }
}
```

---

### GET `/api/v1/import/:doctype/template`

Downloads a blank CSV template for importing a specific DocType. The template contains only the headers for all importable fields.

**Response:** CSV binary stream.
