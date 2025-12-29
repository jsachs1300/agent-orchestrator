# PR4 Review Notes

## Slice deliverables PATCH status rejection
- `PATCH /v1/slices/{slice_id}/design`, `/implementation`, and `/tests` reject any request payload that includes `status` with `400 { "error": "invalid_body" }`.
- Successful PATCH updates do not modify `slice.status`.

## Slice claim/release
- Missing/invalid agent headers return `401 { "error": "unauthorized" }`.
- `POST /v1/slices/{slice_id}/claim` accepts no body or `{}`; any non-empty object yields `400 { "error": "invalid_body" }`.
- If the slice does not exist: `404 { "error": "not_found" }`.
- If already claimed: `409 { "error": "already_claimed" }`.
- On success, sets `claimed_by` to `{ role, id }` and `claimed_at` to the current ISO timestamp, returning the updated slice.

- `POST /v1/slices/{slice_id}/release` accepts no body or `{}`; any non-empty object yields `400 { "error": "invalid_body" }`.
- If the slice does not exist: `404 { "error": "not_found" }`.
- If not claimed: `409 { "error": "not_claimed" }`.
- If claimed by a different agent: `409 { "error": "not_claimer" }`.
- On success, clears `claimed_by` and `claimed_at`, returning the updated slice.

## Next slice selection
- `GET /v1/slices/next?role=architect|coder|tester` returns `400 { "error": "invalid_role" }` for invalid roles (including `pm`).
- Returns `404 { "error": "not_found" }` when no eligible slice exists.
- Eligibility rules:
  - `slice.owner_role` matches the requested role.
  - `slice.claimed_by` is `null`.
  - `slice.status` is not `done`.
  - If `depends_on` is present, all referenced slices exist and have `status: "done"`.
- Ordering is deterministic: the first eligible slice in insertion order is returned.
