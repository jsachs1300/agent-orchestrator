# PR8 Review Notes

## Endpoint
- `GET /v1/run/next?role=architect|coder|tester`
- Auth: v2 headers required

## Query Parameters
- `role` is required.
- Invalid roles (including `pm`) return `400 { "error": "invalid_role" }`.

## Response
```json
{
  "slice_id": "SLICE-1",
  "view": {
    "slice": {
      "slice_id": "SLICE-1",
      "req_id": "REQ-1",
      "title": "Title",
      "owner_role": "architect",
      "status": "not_started",
      "depends_on": [],
      "claimed_by": null,
      "claimed_at": null,
      "deliverables": {
        "architect": { "design_spec": "Spec" }
      }
    }
  }
}
```

## Behavior
- Uses the same next-slice selection logic as `GET /v1/slices/next`.
- Returns `404 { "error": "not_found" }` when no eligible slice exists.
- Does not claim or update slices.
- Returns the view payload based on the caller role (same as `GET /v1/views/slice/{slice_id}`).
