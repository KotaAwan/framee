# 01-12 Naming Engine

## Purpose

The Naming Engine is responsible for **generating unique `code` values** for every new document record in Framee. It translates the DocType's `auto_code` metadata rule into a concrete, unique string that identifies the record.

The `code` field serves as the human-readable unique identifier for a record (e.g., `USER-26.07.0001`), separate from the internal auto-increment `id`.

---

## Goals

1. Generate a unique `code` for every new record based on the DocType's `auto_code` rule.
2. Support multiple naming strategies: UUID, field-based, and naming series (sequential numbering).
3. Prevent race conditions during sequence generation using database-level locking.
4. Be extensible: adding new strategies does not require changing CRUDEngine.

---

## Scope

### In Scope
- UUID generation (default)
- Field-based naming (derive `code` from a specific DocField value)
- Naming series with date tokens and sequential numbers (`.#` and `.X` style)
- Race-condition-safe sequence generation via `SELECT ... FOR UPDATE`

### Out of Scope
- GUID-based naming (use UUID strategy instead)
- Multi-tenant sequence isolation (tenant_id is applied by the table scope, not the naming series)
- Custom code-based generators (future plugin hook)

---

## Functional Requirements

### FR-001 Strategy Selection
- On every `insert`, the CRUD Engine calls `NamingEngine.generateCode(meta, record, tableName)`.
- The engine reads `meta.auto_code` to determine which strategy to use.
- If `auto_code` is `null`, empty, or `'UUID'` (case-insensitive), defaults to UUID.

### FR-002 UUID Strategy
- Returns a standard `uuidv4()` string.
- Example: `f47ac10b-58cc-4372-a567-0e02b2c3d479`

### FR-003 Field-Based Strategy
- Pattern: `field:{fieldname}` (e.g., `field:username`)
- Reads the value of the specified field from the incoming record data.
- If the field is empty, throws a `ValidationError`.
- Example: `auto_code = 'field:email'` → code = `john@example.com`

### FR-004 Naming Series Strategy
- Triggered when `auto_code`:
  - Starts with `naming_series:` prefix, OR
  - Contains `.#` (hash-based sequence), OR
  - Contains `.X` (alphanumeric sequence)
- The pattern is split on `.` and each part is evaluated:

| Token | Output |
|-------|--------|
| `YYYY` | 4-digit year (e.g., `2026`) |
| `YY` | 2-digit year (e.g., `26`) |
| `MM` | 2-digit month (e.g., `07`) |
| `DD` | 2-digit day (e.g., `21`) |
| `####` | 4-digit zero-padded sequence (length = number of `#` chars) |
| `XXXX` | 4-digit zero-padded sequence (length = number of `X` chars) |
| Any other part | Literal string prefix |

### FR-004 Example Patterns

| `auto_code` | Example Output |
|-------------|---------------|
| `USER-.YY..MM.-.XXXX` | `USER-26.07-0001` |
| `INV-.YYYY.-.####` | `INV-2026-0001` |
| `naming_series:ORD-.MM.-.####` | `ORD-07-0001` |
| `UUID` | `f47ac10b-58cc-...` |
| `field:username` | `sutikno` |

### FR-005 Sequence Safety (Race Condition Prevention)
- The engine uses a Knex transaction with `SELECT ... FOR UPDATE` to lock the table during sequence calculation.
- Query: `SELECT MAX(code) FROM {tableName} WHERE code LIKE '{prefix}%' ORDER BY code DESC LIMIT 1 FOR UPDATE`
- The extracted sequence number is incremented by 1 and zero-padded to the correct width.
- If no existing record matches the prefix, the sequence starts at `1` (output: `0001`).

---

## Architecture

```
CRUDEngine.insert(doctype, data, ...)
      │
      ▼
NamingEngine.generateCode(meta, record, tableName)
      │
      ├── auto_code = 'UUID'      → uuidv4()
      │
      ├── auto_code = 'field:x'  → record[x]
      │
      └── auto_code = 'naming_series:...' or contains '.#'/'.X'
                │
                └── _generateFromSeries(pattern, tableName)
                          │
                          ├── Parse tokens (YYYY, YY, MM, DD, #, X, literals)
                          ├── Build prefix string
                          ├── SELECT MAX(code) ... FOR UPDATE (in transaction)
                          ├── Parse last sequence number
                          └── Return prefix + zero-padded(sequence + 1)
```

---

## Configuration

| DocType Field | Description |
|---------------|-------------|
| `auto_code` | The naming rule. Examples: `UUID`, `field:email`, `USER-.YY..MM.-.XXXX` |

---

## Notes

- The `code` field is distinct from the `id` field. `id` is an auto-increment integer (MySQL) or UUID used as the primary key. `code` is the human-readable business identifier.
- Both `.#` and `.X` sequences are supported and produce zero-padded numeric codes. They are interchangeable in behavior.
- The `naming_series:` prefix is optional — the engine detects series patterns by checking for `.#` or `.X` anywhere in the string.
- If the `code` field has a unique constraint in MySQL, a duplicate code will trigger `ER_DUP_ENTRY`, which the CRUD Engine's `_parseDatabaseError` will translate into a user-friendly `ValidationError`.
