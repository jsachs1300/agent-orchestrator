# PR2 Review Notes

## Summary of externally observable behavior
- Adds v2 slices bulk creation endpoint: `POST /v1/slices/bulk` (PM-only).
- Adds v2 slice fetch endpoint: `GET /v1/slices/{slice_id}` (all valid roles).
- Enforces strict request validation (unknown fields rejected with 400).
- Returns 401 for missing/invalid auth headers and non-PM bulk creation attempts.
- Returns 409 on duplicate `slice_id` (payload-local or existing store) with duplicate IDs.
- Returns 404 when requesting a missing slice.
- Initializes server-owned fields (`deliverables`, `evidence`, `status`).
- Rejects client-provided server-owned fields (`deliverables`, `evidence`, `status`) with 400.
- Validates `depends_on` entries as non-empty strings when provided.
