# Minimal Agent Orchestrator (Single-Project)

This orchestrator provides **centralized, shared memory** for multiple AI agents working on a single Git repository.  
It is intentionally **minimal, disposable, and opinionated**.

- **Git is the source of truth** for code, diffs, and artifacts
- **Redis is the source of truth** for project context and coordination
- **Agents operate directly in the repo** (terminal-based: Codex, Claude Code, etc.)
- The orchestrator exists only to **maintain alignment and continuity across agents**

---

## Core Purpose

The orchestrator stores **structured project memory** so agents can work:
- more consistently
- with shared context
- toward a clearly defined end goal

That end goal is defined in **`REQUIREMENTS.md`**, which lives in the project repository.

The orchestrator:
- does **not** manage code
- does **not** store diffs
- does **not** replace Git workflows
- does **not** support multiple projects (by design)

---

## What the Orchestrator Stores

For **each requirement / feature**, the orchestrator stores only coordination artifacts:

1. **Product Management**
   - Direction for what to build
   - Priority
   - Approval or feedback

2. **Architecture**
   - Design spec (summary, key decisions, constraints)
   - Pointers to repo docs if applicable

3. **Engineering**
   - What was built
   - Known limitations
   - Pull request / commit references

4. **QA**
   - Test plan
   - Test cases
   - Test results

Everything else (code, diffs, history) lives in Git.

---

## High-Level Architecture

- **Single Redis JSON document** (`state`)
- **Single project**
- **Unlimited requirements**
- **JSON-only storage**
- **REST API access**

State can be wiped at any time and rebuilt from `REQUIREMENTS.md`.

---

## Canonical Redis State Shape
```json
    {
      "schema_version": "1.0",
      "updated_at": "ISO-8601",
      "requirements": {
        "REQ-1": {
          "id": "REQ-1",
          "title": "Short description",
          "priority": { "tier": "p0", "rank": 1 },
          "status": "implementation_in_progress",

          "pm": {
            "direction": "What to build and acceptance criteria",
            "feedback": "",
            "decision": "pending"
          },

          "architecture": {
            "design_spec": "Key design decisions and constraints"
          },

          "engineering": {
            "implementation_notes": "What was built, what wasn't, known issues",
            "pr": {
              "number": 123,
              "title": "Implement REQ-1",
              "url": "https://github.com/...",
              "commit": "abcd1234"
            }
          },

          "qa": {
            "test_plan": "Testing approach",
            "test_cases": [
              {
                "id": "TC-1",
                "title": "Happy path",
                "steps": "...",
                "expected": "...",
                "status": "pass",
                "notes": ""
              }
            ],
            "test_results": {
              "status": "pass",
              "notes": "All tests green"
            }
          }
        }
      }
    }
```
---

## Role Model (Enforced by API)

Each agent can **only update its own section**.

| Role | Writable Section |
|----|------------------|
| Product Manager | `pm`, `priority`, `status`, final decisions |
| Architect | `architecture` |
| Coder | `engineering` |
| Tester | `qa` |
| System | requirement creation & sync |

Because access is enforced at the API layer:
- no `updated_by` fields are stored
- authorship is implicit

---

## API Surface (Minimal)

### Read
- `GET /v1/requirements`
- `GET /v1/requirements/{id}`

### Write (replace-only, role-scoped)
- `PUT /v1/requirements/{id}/pm`
- `PUT /v1/requirements/{id}/architecture`
- `PUT /v1/requirements/{id}/engineering`
- `PUT /v1/requirements/{id}/qa`
- `PUT /v1/requirements/{id}/pm-decision`

### System
- `POST /v1/requirements/sync`
  - Parses `REQUIREMENTS.md`
  - Creates / updates requirement entries
  - Preserves existing sub-sections

No patch semantics.  
No diff ingestion.  
No repo mutation.

---

## Status Lifecycle (Optional Enforcement)

Recommended statuses:
- `future`
- `ready_for_design`
- `design_in_progress`
- `ready_for_implementation`
- `implementation_in_progress`
- `ready_for_test`
- `test_in_progress`
- `ready_for_pm_review`
- `done`
- `blocked`

You may:
- enforce transitions
- or make status PM-only
- or ignore enforcement entirely

---

## Intended Usage Pattern

1. PM defines requirements in `REQUIREMENTS.md`
2. System syncs requirements into Redis
3. Agents work directly in the repo
4. Agents periodically update their section in orchestrator memory
5. PM reviews, approves, or provides feedback
6. Memory keeps all agents aligned without re-reading the repo

---

## Non-Goals (Explicit)

This orchestrator is **not**:
- a CI system
- a GitHub replacement
- a workflow engine
- a long-lived source of truth
- a multi-project platform

It is deliberately small and replaceable.
