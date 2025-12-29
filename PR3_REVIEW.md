# PR3 Review Notes

## Summary of externally observable behavior
- Adds role-scoped deliverables patch endpoints:
  - `PATCH /v1/slices/{slice_id}/design` (architect-only)
  - `PATCH /v1/slices/{slice_id}/implementation` (coder-only)
  - `PATCH /v1/slices/{slice_id}/tests` (tester-only)
- Requires `X-Agent-Role` and `X-Agent-Id` headers (401 on missing/invalid).
- Returns 401 for wrong role per endpoint.
- Returns 404 when a slice is missing.
- Enforces strict validation (unknown fields rejected with 400).
- Enforces non-empty strings where applicable.
- Rejects `status` in role PATCH payloads with `400` (status is PM-only).
- Enforces evidence schema (`type` in `file|command|test|pr`, `ref` non-empty, `result` optional `pass|fail|null`).
- Appends evidence to role-scoped deliverables evidence arrays with author metadata.
- Updates only the relevant deliverables subtree (other role deliverables preserved).

## Role PATCH payload allowlists
- `PATCH /v1/slices/{slice_id}/design`: `{ design_spec, evidence }`
- `PATCH /v1/slices/{slice_id}/implementation`: `{ implementation_notes, pr, evidence }`
- `PATCH /v1/slices/{slice_id}/tests`: `{ test_plan, test_results, evidence }`

Note: `test_results.status` is a separate field from `evidence.result`. Both may use `pass|fail`, but `test_results.status` is required within `test_results` when provided, while `evidence.result` is optional and may also be `null`.

## Request/response examples

### PATCH /v1/slices/{slice_id}/design
Request:
```json
{
  "design_spec": "Updated architecture notes",
  "evidence": [{ "type": "file", "ref": "docs/design.md" }]
}
```

Response (200):
```json
{
  "slice_id": "SLICE-1",
  "req_id": "REQ-1",
  "title": "Initial slice",
  "owner_role": "architect",
  "status": "not_started",
  "deliverables": {
    "architect": {
      "design_spec": "Updated architecture notes",
      "evidence": [
        {
          "type": "file",
          "ref": "docs/design.md",
          "author": { "role": "architect", "id": "agent-3" }
        }
      ]
    },
    "coder": { "implementation_notes": null, "pr": null, "evidence": [] },
    "tester": { "test_plan": null, "test_results": null, "evidence": [] }
  }
}
```

### PATCH /v1/slices/{slice_id}/implementation
Request:
```json
{
  "implementation_notes": "Implemented parser changes",
  "pr": "https://github.com/org/repo/pull/123"
}
```

Response (200):
```json
{
  "slice_id": "SLICE-1",
  "req_id": "REQ-1",
  "title": "Initial slice",
  "owner_role": "architect",
  "status": "not_started",
  "deliverables": {
    "architect": {
      "design_spec": "Updated architecture notes",
      "evidence": [
        {
          "type": "file",
          "ref": "docs/design.md",
          "author": { "role": "architect", "id": "agent-3" }
        }
      ]
    },
    "coder": {
      "implementation_notes": "Implemented parser changes",
      "pr": "https://github.com/org/repo/pull/123",
      "evidence": []
    },
    "tester": { "test_plan": null, "test_results": null, "evidence": [] }
  }
}
```

### PATCH /v1/slices/{slice_id}/tests
Request:
```json
{
  "test_plan": "Cover new endpoints",
  "test_results": { "status": "pass", "notes": "All checks green." }
}
```

Response (200):
```json
{
  "slice_id": "SLICE-1",
  "req_id": "REQ-1",
  "title": "Initial slice",
  "owner_role": "architect",
  "status": "not_started",
  "deliverables": {
    "architect": {
      "design_spec": "Updated architecture notes",
      "evidence": [
        {
          "type": "file",
          "ref": "docs/design.md",
          "author": { "role": "architect", "id": "agent-3" }
        }
      ]
    },
    "coder": {
      "implementation_notes": "Implemented parser changes",
      "pr": "https://github.com/org/repo/pull/123",
      "evidence": []
    },
    "tester": {
      "test_plan": "Cover new endpoints",
      "test_results": { "status": "pass", "notes": "All checks green." },
      "evidence": []
    }
  }
}
```
