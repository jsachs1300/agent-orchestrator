# PR6 Review Notes

## Endpoint
- `PATCH /v1/slices/{slice_id}/status`
- Auth: v2 headers required; PM-only

## Request Body
```json
{ "status": "not_started" | "in_progress" | "blocked" | "done" }
```

- Unknown fields are rejected with `400 { "error": "invalid_body" }`.
- Invalid status values are rejected with `400 { "error": "invalid_body" }`.
- Missing slices return `404 { "error": "not_found" }`.

## Behavior
- Updates `slice.status` only and returns `200` with the updated Slice.

## Done Guardrail
- Setting status to `done` requires `deliverables.tester.test_results.status === "pass"`.
- Otherwise returns `409 { "error": "cannot_mark_done" }`.
