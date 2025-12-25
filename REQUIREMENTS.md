# REQUIREMENTS.md

This document defines the **authoritative requirements** for the Minimal Agent Orchestrator project.

It is the single source of truth for:
- what is being built
- how work is sliced
- what is in scope vs out of scope
- how completion is judged

All agents (PM, Architect, Coder, Tester) must operate strictly within the boundaries defined here.
The orchestrator exists in part to persist these decisions so future agent runs do not reinterpret or recompute them.

---

## Orchestration Spec (Authoritative for API + JSON)

- `ORCHESTRATION_SPEC.md` is the authoritative API + JSON contract for agent/orchestrator interactions.
- Agents must read it before acting.
- No agent may guess or invent JSON shapes or endpoints.

---

## Requirement Model (Authoritative)

Each requirement represents a **capability slice**.

A capability slice is:
- small enough to be built, tested, and reviewed independently
- large enough to deliver a meaningful unit of functionality
- explicitly defined by the Product Manager
- stable once created (agents must not reinterpret or subdivide it)

REQUIREMENTS.md is **freeform** and does not require a specific format. The PM interprets it and creates
capability slices (`REQ-n`) in orchestrator memory via API requests.

Each requirement MUST define:
- Priority (tier + rank, unique across all requirements)
- Clear acceptance criteria
- Explicit out-of-scope boundaries

---

## Priority Rules

- Priority is defined as: tier + rank
- Allowed tiers: p0, p1, p2
- Rank is an integer
- The combination of tier + rank MUST be unique across all requirements
- Lower rank = higher priority within a tier

---

## Status Rules (Authoritative)

Section-level statuses (per requirement):
- `unaddressed` (default)
- `in_progress`
- `complete`
- `blocked`

Overall requirement status (PM-only):
- `not_started` (default)
- `in_progress`
- `blocked`
- `in_review`
- `completed`

---

## REQ-1: Core Orchestrator Service Skeleton

Priority: p0 / 1

### Description
Provide a minimal, production-clean REST service that exposes the orchestrator API and persists shared project memory in Redis.

This requirement establishes the runnable service and foundational structure upon which all other capabilities depend.

### Acceptance Criteria
- Service runs locally with a single command
- Express server starts successfully
- Redis connection is configurable via environment variables
- Service exposes a health endpoint
- Codebase follows a clean, minimal structure
- No unused abstractions or premature features

### Out of Scope
- Authentication beyond role headers
- Multi-project or multi-tenant support
- Background jobs or workers
- GitHub or CI integration

---

## REQ-2: Canonical Redis State Management

Priority: p0 / 2

### Description
Implement canonical Redis storage for orchestrator memory using per-requirement keys and supporting indexes.

This storage must be treated as the authoritative shared memory across all agents.

### Acceptance Criteria
- Each requirement is stored under its own Redis key (`REQ-n`)
- Requirement values are JSON-serializable and human-readable
- A set named `requirements` contains all requirement key names
- A sorted set named `priority` stores requirement key names with score = tier number + rank
- A set exists for each overall status value and contains matching requirement keys
- All requirement changes are logged to a Redis stream (audit log)
- Writes update requirement data and indexes atomically per request

### Out of Scope
- Storing diffs, code, or large artifacts
- Per-requirement Redis keys
- Historical snapshots beyond what is stored in-memory

---

## REQ-3: Requirement Seeding via API

Priority: p0 / 3

### Description
Allow Product Management to seed or create requirements via API input (not filesystem ingestion).

### Acceptance Criteria
- PM can create multiple requirements in a single request
- New requirements initialize all sections with default statuses and empty content
- Existing requirements are not deleted automatically
- Requirement IDs and titles are stored exactly as provided

### Out of Scope
- Parsing or reading REQUIREMENTS.md from disk
- Automatic deletion of removed requirements
- Semantic interpretation beyond explicit input

---

## REQ-4: Role-Scoped Write Access and Header Identity

Priority: p0 / 4

### Description
Enforce strict role-based access so each agent can only update its own section of a requirement.

Identity is provided via request headers and is not a security mechanism.

### Acceptance Criteria
- Requests require `X-Agent-Role` and `X-Agent-Id` headers
- Allowed roles: `pm`, `architect`, `coder`, `tester`, `system`
- PM can update only PM-related fields, priority, and overall status
- Architect can update only architecture section
- Coder can update only engineering section
- Tester can update only QA section
- Invalid or missing roles are rejected with HTTP 401
- Disallowed role writes are rejected with HTTP 401

### Out of Scope
- Field-level permissions within a role
- Dynamic role assignment
- Auth systems beyond trusted role headers

---

## REQ-5: Product Management Direction, Priority, and Decision Capture

Priority: p0 / 5

### Description
Persist product management direction, priorities, and decisions for each capability slice.

This prevents future agent runs from reinterpreting intent or scope.

### Acceptance Criteria
- PM direction text is stored per requirement
- Priority tier and rank are stored and enforced as unique
- PM feedback can be recorded after implementation/testing
- PM approval or rejection is explicitly captured
- PM can set overall requirement status (`not_started`, `in_progress`, `blocked`, `in_review`, `completed`)
- PM section status can be updated (`unaddressed`, `in_progress`, `complete`, `blocked`)

### Out of Scope
- Automated prioritization
- AI-generated PM decisions
- Workflow enforcement beyond data capture

---

## REQ-6: Architecture Design Spec Capture

Priority: p1 / 1

### Description
Allow the architect to store a concise design specification for each requirement.

This serves as durable context for engineering and future agent runs.

### Acceptance Criteria
- Architect can store design decisions and constraints
- Design spec is human-readable
- References to repo documentation are allowed
- Architecture section status can be updated (`unaddressed`, `in_progress`, `complete`, `blocked`)
- Design spec persists across service restarts

### Out of Scope
- Diagram rendering
- Validation of architectural correctness
- Automatic design generation

---

## REQ-7: Engineering Output and PR Linking

Priority: p1 / 2

### Description
Allow engineers to record what was built and link it to concrete Git artifacts.

### Acceptance Criteria
- Engineering notes can be stored per requirement
- Pull request number, URL, and commit hash can be recorded
- Notes can describe limitations or follow-ups
- Engineering section status can be updated (`unaddressed`, `in_progress`, `complete`, `blocked`)
- No code or diffs are stored in orchestrator memory

### Out of Scope
- Git diff ingestion
- PR status polling
- Commit validation

---

## REQ-8: QA Test Plans and Results

Priority: p1 / 3

### Description
Persist QA test plans, test cases, and test results for each capability slice.

### Acceptance Criteria
- Test plan text can be stored
- Test cases can be listed with status
- Overall test result status can be captured
- QA section status can be updated (`unaddressed`, `in_progress`, `complete`, `blocked`)
- Results persist for PM review

### Out of Scope
- Test execution
- CI integration
- Automatic test result ingestion

---

## REQ-9: PM Review and Final Approval

Priority: p1 / 4

### Description
Allow Product Management to review completed work and either approve it or provide actionable feedback.

### Acceptance Criteria
- PM can mark a requirement as `done`
- PM can provide explicit feedback requiring changes
- Decision is persisted and visible to all agents

### Out of Scope
- Automated approvals
- Workflow enforcement
- Notifications or alerts

---

## REQ-10: Priority-Ordered Listing

Priority: p2 / 1

### Description
Expose a read endpoint that returns requirements ordered by priority using the Redis priority index.

### Acceptance Criteria
- `GET /v1/requirements/top` returns the top priority requirement
- `GET /v1/requirements/top/{n}` returns the top N requirements ordered by priority
- Invalid limits return a deterministic 400 response

### Out of Scope
- Cursor-based pagination
- Filtering by status

---

## REQ-11: Status and Priority Index Reads

Priority: p2 / 2

### Description
Expose read endpoints that leverage Redis status sets and priority range queries.

### Acceptance Criteria
- `GET /v1/requirements/status/{status}` returns requirements with that overall status
- `GET /v1/requirements/priority-range?min={min}&max={max}` returns requirements within score range
- Invalid status or ranges return a deterministic 400 response

### Out of Scope
- Full-text search
- Complex sorting beyond index order

---

## REQ-12: Audit Log Read Access

Priority: p2 / 3

### Description
Expose a read endpoint for the Redis audit stream to support operational debugging.

### Acceptance Criteria
- `GET /v1/audit` returns the most recent audit entries
- Optional `limit` query parameter bounds returned entries
- Invalid limits return a deterministic 400 response

### Out of Scope
- Stream trimming or retention policies
- Filtering by actor or action

---

## Non-Goals (Global)

The system is explicitly NOT intended to:
- Replace Git or GitHub
- Act as a workflow engine
- Execute code or tests
- Store large artifacts
- Support multiple projects
- Persist long-term historical analytics
- Read or write files from disk as part of runtime behavior

This document is authoritative.
Agents must not assume behavior not explicitly defined here.
