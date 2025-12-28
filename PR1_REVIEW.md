# PR1 Review Summary: Requirements v2 (Option B)

## Scope Implemented
- `POST /v1/requirements/bulk` (PM-only)
- `GET /v1/requirements/:req_id` (all valid roles)

## Auth Behavior
- All v2 endpoints require `X-Agent-Role` (pm|architect|coder|tester) and `X-Agent-Id` (non-empty).
- Missing or invalid headers return `401 { "error": "unauthorized" }`.
- Non-PM roles receive the same 401 response on the bulk endpoint.

## Validation & Status (Option B)
- Requests are strictly validated; unknown fields return `400 { "error": "invalid_body" }`.
- `req_id`, `title`, `priority`, and `source_ref` must be non-empty strings.
- `acceptance` and `constraints` are arrays of non-empty strings (empty arrays allowed).
- `priority` must be one of `P0|P1|P2|P3`.
- `status` is optional. If provided, it must be exactly `"derived"`.
- Responses always include `status: "derived"`.

## Duplicate Handling (Atomic Bulk)
- Bulk insert is atomic: if any `req_id` already exists or appears more than once in the payload, nothing is created.
- The response is `409` with:
  ```json
  {
    "error": "requirement_exists",
    "duplicates": ["REQ-1", "REQ-2"],
    "message": "One or more requirements already exist"
  }
  ```

## Storage
- Requirements are stored in-memory (Map keyed by `req_id`).
