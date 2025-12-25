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

- **Per-REQ Redis keys** (each requirement stored at `REQ-n`)
- **Index sets and sorted sets** for listing and priority ordering
- **Audit stream** for change history
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
          "req_id": "REQ-1",
          "title": "Short description",
          "priority": { "tier": "p0", "rank": 1 },
          "overall_status": "not_started",
          "sections": {
            "pm": {
              "status": "unaddressed",
              "direction": "What to build and acceptance criteria",
              "feedback": "",
              "decision": "pending"
            },
            "architect": {
              "status": "unaddressed",
              "design_spec": "Key design decisions and constraints"
            },
            "coder": {
              "status": "unaddressed",
              "implementation_notes": "What was built, what wasn't, known issues",
              "pr": {
                "number": 123,
                "title": "Implement REQ-1",
                "url": "https://github.com/...",
                "commit": "abcd1234"
              }
            },
            "tester": {
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
| Product Manager | `sections.pm`, `priority`, `overall_status`, final decisions |
| Architect | `sections.architect` |
| Coder | `sections.coder` |
| Tester | `sections.tester` |
| System | none (reserved) |

Because access is enforced at the API layer:
- no `updated_by` fields are stored
- authorship is implicit

---

## API Surface (Minimal)

### Read
- `GET /health`
- `GET /prompt/{name}` (public prompt files, e.g. `prompt/pm_system_prompt`)
- `GET /v1/requirements`
- `GET /v1/requirements/top`
- `GET /v1/requirements/top/{n}`
- `GET /v1/requirements/status/{status}`
- `GET /v1/requirements/priority-range?min={min}&max={max}`
- `GET /v1/audit?limit={n}`
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

## Quickstart

Base URL assumes `http://localhost:3000`.

Public endpoints (no headers required):
```bash
curl http://localhost:3000/health
curl http://localhost:3000/prompt/pm_system_prompt
```

Get all requirements (headers required):
```bash
curl http://localhost:3000/v1/requirements \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Get top requirements by priority:
```bash
curl http://localhost:3000/v1/requirements/top/3 \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Get requirements by status:
```bash
curl http://localhost:3000/v1/requirements/status/completed \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Get requirements by priority range:
```bash
curl "http://localhost:3000/v1/requirements/priority-range?min=0&max=2" \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Get audit log entries:
```bash
curl http://localhost:3000/v1/audit?limit=20 \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Get one requirement:
```bash
curl http://localhost:3000/v1/requirements/REQ-1 \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1"
```

Bulk create requirements (PM only):
```bash
curl -X POST http://localhost:3000/v1/requirements/bulk \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1" \\
  -d '{\"requirements\":[{\"req_id\":\"REQ-1\",\"title\":\"Core service\",\"priority\":{\"tier\":\"p0\",\"rank\":1}}]}'
```

Update overall status (PM only):
```bash
curl -X PUT http://localhost:3000/v1/requirements/REQ-1/status \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1" \\
  -d '{\"overall_status\":\"in_progress\"}'
```

Update PM section (PM only):
```bash
curl -X PUT http://localhost:3000/v1/requirements/REQ-1/pm \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: pm" \\
  -H "X-Agent-Id: pm-1" \\
  -d '{\"section\":{\"status\":\"in_progress\",\"direction\":\"...\",\"feedback\":\"\",\"decision\":\"pending\"},\"priority\":{\"tier\":\"p0\",\"rank\":1}}'
```

Update architecture section (Architect only):
```bash
curl -X PUT http://localhost:3000/v1/requirements/REQ-1/architecture \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: architect" \\
  -H "X-Agent-Id: architect-1" \\
  -d '{\"section\":{\"status\":\"in_progress\",\"design_spec\":\"...\"}}'
```

Update engineering section (Coder only):
```bash
curl -X PUT http://localhost:3000/v1/requirements/REQ-1/engineering \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: coder" \\
  -H "X-Agent-Id: coder-1" \\
  -d '{\"section\":{\"status\":\"in_progress\",\"implementation_notes\":\"...\",\"pr\":null}}'
```

Update QA section (Tester only):
```bash
curl -X PUT http://localhost:3000/v1/requirements/REQ-1/qa \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Role: tester" \\
  -H "X-Agent-Id: tester-1" \\
  -d '{\"section\":{\"status\":\"in_progress\",\"test_plan\":\"...\",\"test_cases\":[],\"test_results\":{\"status\":\"\",\"notes\":\"\"}}}'
```

---

## Status Lifecycle (Authoritative)

Section statuses:
- `unaddressed`
- `in_progress`
- `complete`
- `blocked`

Overall requirement status (PM-only):
- `not_started`
- `in_progress`
- `blocked`
- `in_review`
- `completed`

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
