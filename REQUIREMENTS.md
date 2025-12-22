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

## Requirement Model (Authoritative)

Each requirement represents a **capability slice**.

A capability slice is:
- small enough to be built, tested, and reviewed independently
- large enough to deliver a meaningful unit of functionality
- explicitly defined by the Product Manager
- stable once created (agents must not reinterpret or subdivide it)

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

## Status Lifecycle (Reference)

Statuses are managed in orchestrator memory, not here, but requirements are written assuming the following flow:

future  
ready_for_design  
design_in_progress  
ready_for_implementation  
implementation_in_progress  
ready_for_test  
test_in_progress  
ready_for_pm_review  
done  
blocked  

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
Implement a single canonical JSON document in Redis to store all orchestrator memory for the project.

This document must be treated as the authoritative shared memory across all agents.

### Acceptance Criteria
- Entire project state is stored under a single Redis key
- State is JSON-serializable and human-readable
- State includes schema_version, updated_at, and requirements map
- State is loaded and written atomically per request
- No partial or fragmented state storage

### Out of Scope
- Storing diffs, code, or large artifacts
- Per-requirement Redis keys
- Historical snapshots beyond what is stored in-memory

---

## REQ-3: Requirements Sync from REQUIREMENTS.md

Priority: p0 / 3

### Description
Provide a system endpoint that parses REQUIREMENTS.md and synchronizes requirement definitions into orchestrator memory.

This ensures the orchestrator always reflects the authoritative requirements defined here.

### Acceptance Criteria
- System can parse REQUIREMENTS.md successfully
- Missing requirements are created in memory
- Existing requirements are not deleted automatically
- Requirement IDs and titles are synchronized
- Existing PM, architecture, engineering, and QA sections are preserved

### Out of Scope
- Automatic deletion of removed requirements
- Semantic interpretation beyond explicit text
- Rewriting REQUIREMENTS.md

---

## REQ-4: Role-Scoped Write Access

Priority: p0 / 4

### Description
Enforce strict role-based access so each agent can only update its own section of a requirement.

This guarantees ownership, prevents cross-role contamination, and simplifies auditability.

### Acceptance Criteria
- PM can update only PM-related fields, priority, and status
- Architect can update only architecture section
- Coder can update only engineering section
- Tester can update only QA section
- Invalid write attempts are rejected deterministically

### Out of Scope
- Field-level permissions within a role
- Dynamic role assignment
- Auth systems beyond trusted role headers

---

## REQ-5: Product Management Direction & Decision Capture

Priority: p0 / 5

### Description
Persist product management direction, priorities, and decisions for each capability slice.

This prevents future agent runs from reinterpreting intent or scope.

### Acceptance Criteria
- PM direction text is stored per requirement
- Priority tier and rank are stored and enforced as unique
- PM feedback can be recorded after implementation/testing
- PM approval or rejection is explicitly captured

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
- Design spec persists across service restarts

### Out of Scope
- Diagram rendering
- Validation of architectural correctness
- Automatic design generation

---

## REQ-7: Engineering Output & PR Linking

Priority: p1 / 2

### Description
Allow engineers to record what was built and link it to concrete Git artifacts.

### Acceptance Criteria
- Engineering notes can be stored per requirement
- Pull request number, URL, and commit hash can be recorded
- Notes can describe limitations or follow-ups
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
- PM can mark a requirement as approved (done)
- PM can provide explicit feedback requiring changes
- Decision is persisted and visible to all agents

### Out of Scope
- Automated approvals
- Workflow enforcement
- Notifications or alerts

---

## Non-Goals (Global)

The system is explicitly NOT intended to:
- Replace Git or GitHub
- Act as a workflow engine
- Execute code or tests
- Store large artifacts
- Support multiple projects
- Persist long-term historical analytics

This document is authoritative.  
Agents must not assume behavior not explicitly defined here.
