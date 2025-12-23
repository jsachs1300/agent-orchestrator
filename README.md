# Minimal Agent Orchestrator (Single-Project)

This orchestrator provides **centralized, shared memory** for multiple AI agents working on a single Git repository.
It is intentionally **minimal, disposable, and opinionated**.

- **Git is the source of truth** for code, diffs, and artifacts
- **Redis is the source of truth** for project context and coordination
- **Agents operate directly in the repo** (terminal-based: Codex, Claude Code, etc.)
- The orchestrator exists only to **maintain alignment and continuity across agents**

Source of truth:
- `REQUIREMENTS.md` = scope source of truth
- `ORCHESTRATION_SPEC.md` = orchestrator contract source of truth
- `prompts/` contains the system prompts for each agent role

---

## Core Purpose

The orchestrator stores **structured project memory** so agents can work:
- more consistently
- with shared context
- toward a clearly defined end goal

`REQUIREMENTS.md` is freeform and interpreted by PMs. The orchestrator does not read from disk; all inputs arrive via API requests.

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
   - Section status

2. **Architecture**
   - Design spec (summary, key decisions, constraints)
   - Pointers to repo docs if applicable
   - Section status

3. **Engineering**
   - What was built
   - Known limitations
   - Pull request / commit references
   - Section status

4. **QA**
   - Test plan
   - Test cases
   - Test results
   - Section status

Everything else (code, diffs, history) lives in Git.

---

## High-Level Architecture

- **Single Redis JSON document** (`state`)
- **Single project**
- **Unlimited requirements**
- **JSON-only storage**
- **REST API access**

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
          "status": "open",

          "pm": {
            "status": "unaddressed",
            "direction": "What to build and acceptance criteria",
            "feedback": "",
            "decision": "pending"
          },

          "architecture": {
            "status": "unaddressed",
            "design_spec": "Key design decisions and constraints"
          },

          "engineering": {
            "status": "unaddressed",
            "implementation_notes": "What was built, what wasn't, known issues",
            "pr": {
              "number": 123,
              "title": "Implement REQ-1",
              "url": "https://github.com/...",
              "commit": "abcd1234"
            }
          },

          "qa": {
            "status": "unaddressed",
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

Role identity is passed by headers:
- `X-Agent-Role`: `pm`, `architect`, `coder`, `tester`, `system`
- `X-Agent-Id`: string (trace/debug only)

Missing or invalid headers return HTTP 401. Role mismatch returns HTTP 401.

Each agent can **only update its own section**.

| Role | Writable Section |
|----|------------------|
| Product Manager | `pm`, `priority`, overall `status`, final decisions |
| Architect | `architecture` |
| Coder | `engineering` |
| Tester | `qa` |
| System | none (reserved) |

Because access is enforced at the API layer:
- no `updated_by` fields are stored
- authorship is implicit

---

## API Surface (Minimal)

### Read
- `GET /health`
- `GET /v1/requirements`
- `GET /v1/requirements/{id}`

### Write (replace-only, role-scoped)
- `PUT /v1/requirements/{id}/pm`
- `PUT /v1/requirements/{id}/architecture`
- `PUT /v1/requirements/{id}/engineering`
- `PUT /v1/requirements/{id}/qa`
- `PUT /v1/requirements/{id}/status`

### Bulk (PM only)
- `POST /v1/requirements/bulk`

No patch semantics.
No diff ingestion.
No repo mutation.

---

## Status Lifecycle (Authoritative)

Section statuses:
- `unaddressed`
- `in_progress`
- `complete`
- `blocked`

Overall requirement status (PM-only):
- `open`
- `ready_for_pm_review`
- `done`
- `blocked`

---

## Intended Usage Pattern

1. PM interprets REQUIREMENTS.md and creates requirements via API
2. Agents work directly in the repo
3. Agents periodically update their section in orchestrator memory
4. PM reviews, approves, or provides feedback
5. Memory keeps all agents aligned without re-reading the repo

---

## Non-Goals (Explicit)

This orchestrator is **not**:
- a CI system
- a GitHub replacement
- a workflow engine
- a long-lived source of truth
- a multi-project platform
- a filesystem parser

It is deliberately small and replaceable.
