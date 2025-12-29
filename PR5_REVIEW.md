# PR5 Review Notes

## Role-scoped slice views

`GET /v1/views/slice/{slice_id}` returns a view that is scoped to the caller role.
Base fields are always present:

```json
{
  "slice": {
    "slice_id": "SLICE-1",
    "req_id": "REQ-1",
    "title": "Example",
    "owner_role": "architect",
    "status": "not_started",
    "depends_on": ["SLICE-0"],
    "claimed_by": null,
    "claimed_at": null
  }
}
```

### Architect view

```json
{
  "slice": {
    "slice_id": "SLICE-1",
    "req_id": "REQ-1",
    "title": "Example",
    "owner_role": "architect",
    "status": "not_started",
    "depends_on": ["SLICE-0"],
    "claimed_by": null,
    "claimed_at": null,
    "deliverables": {
      "architect": {
        "design_spec": "Spec"
      }
    }
  }
}
```

### Coder view

```json
{
  "slice": {
    "slice_id": "SLICE-1",
    "req_id": "REQ-1",
    "title": "Example",
    "owner_role": "architect",
    "status": "not_started",
    "depends_on": ["SLICE-0"],
    "claimed_by": null,
    "claimed_at": null,
    "deliverables": {
      "architect": {
        "design_spec": "Spec"
      },
      "coder": {
        "implementation_notes": "Notes",
        "pr": "PR-1"
      }
    }
  }
}
```

### Tester view

```json
{
  "slice": {
    "slice_id": "SLICE-1",
    "req_id": "REQ-1",
    "title": "Example",
    "owner_role": "architect",
    "status": "not_started",
    "depends_on": ["SLICE-0"],
    "claimed_by": null,
    "claimed_at": null,
    "deliverables": {
      "architect": {
        "design_spec": "Spec"
      },
      "coder": {
        "implementation_notes": "Notes",
        "pr": "PR-1"
      },
      "tester": {
        "test_plan": "Plan",
        "test_results": {
          "status": "pass",
          "notes": "ok"
        }
      }
    }
  }
}
```

### PM view (includes evidence)

```json
{
  "slice": {
    "slice_id": "SLICE-1",
    "req_id": "REQ-1",
    "title": "Example",
    "owner_role": "architect",
    "status": "not_started",
    "depends_on": ["SLICE-0"],
    "claimed_by": null,
    "claimed_at": null,
    "deliverables": {
      "architect": {
        "design_spec": "Spec"
      },
      "coder": {
        "implementation_notes": "Notes",
        "pr": "PR-1"
      },
      "tester": {
        "test_plan": "Plan",
        "test_results": {
          "status": "pass",
          "notes": "ok"
        }
      }
    },
    "evidence": [
      {
        "type": "file",
        "ref": "spec.md"
      },
      {
        "type": "pr",
        "ref": "PR-1"
      },
      {
        "type": "test",
        "ref": "Suite"
      }
    ]
  }
}
```
