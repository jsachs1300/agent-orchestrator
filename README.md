# Multi-Agent Product Orchestrator  
**Authoritative Specification v1.0**

---

## 1. Purpose

This project defines a **deterministic orchestration system** that coordinates multiple LLM agents (Product Manager, Architect, Coder, Tester) around a single source of truth derived from `REQUIREMENTS.md`.

The orchestrator enforces:
- strict requirements compliance
- role-based permissions
- state transitions
- schema validation
- auditability

**LLMs propose changes.  
The orchestrator decides what is allowed.**

---

## 2. Core Principles

1. **REQUIREMENTS.md is authoritative**
   - No undocumented features
   - No inferred scope
   - No silent deviations

2. **Single canonical project state**
   - All requirements and their lifecycle live in one structured file
   - All agents read from it
   - No agent edits it directly

3. **Role separation**
   - PM enforces requirements
   - Architect designs
   - Coder implements
   - Tester validates
   - No role overlaps authority

4. **Evidence over intent**
   - Every status change must be justified
   - File paths, line numbers, tests, commits

5. **Deterministic workflow**
   - Explicit states
   - Explicit transitions
   - No “almost done”

---

## 3. System Architecture

### Components

1. **Orchestrator API**
   - Enforces rules
   - Applies validated patches
   - Maintains project state

2. **Canonical State File**
   - `project_status.json`
   - Stored in repo or backing store
   - Versioned and validated

3. **Agents (LLMs)**
   - Product Manager Agent
   - Architect Agent
   - Coder Agent
   - Tester Agent

> Agents never write files directly.  
> They submit structured change requests to the orchestrator.

---

## 4. Roles & Responsibilities

### Product Manager Agent

**Authority**
- Status changes
- Deviations
- Final approval
- Blocking / deferring

**Modes**
1. Full Project Review
2. Individual Requirement Review

**Can modify**
- `status`
- `pm_notes`
- `deviations`
- `approvals`

---

### Architect Agent

**Authority**
- Design specification only

**Can modify**
- `design_spec`

**Cannot**
- Change requirements
- Change status
- Approve completion

---

### Coder Agent

**Authority**
- Implementation notes only

**Can modify**
- `implementation`

**Cannot**
- Change design intent
- Change requirements
- Mark work complete

---

### Tester Agent

**Authority**
- Test plans and results

**Can modify**
- `test`

**Cannot**
- Approve requirements
- Change implementation scope

---

## 5. Canonical Lifecycle States

Each requirement moves through **exactly one state at a time**.

### Allowed States

- `not_started`
- `blocked`
- `planned`
- `design_in_progress`
- `design_ready`
- `implementation_in_progress`
- `implemented`
- `test_in_progress`
- `tested_pass`
- `tested_fail`
- `needs_changes`
- `done`
- `deferred`

---

## 6. State Transition Rules (Enforced)

| From | To | Allowed By |
|---|---|---|
| not_started | planned | PM |
| planned | design_in_progress | PM |
| design_in_progress | design_ready | PM |
| design_ready | implementation_in_progress | PM |
| implementation_in_progress | implemented | PM |
| implemented | test_in_progress | PM |
| test_in_progress | tested_pass | Tester |
| test_in_progress | tested_fail | Tester |
| tested_pass | done | PM |
| any | blocked | PM |
| any | deferred | PM |
| any | needs_changes | PM |

Illegal transitions must be rejected.

---

## 7. Canonical State File

### File Name
`project_status.json`

### Purpose
- Tracks **every requirement from REQUIREMENTS.md**
- Records design, implementation, test, and approval data
- Acts as the single operational truth

---

## 8. Orchestrator API (Minimal)

### Read
- `GET /project`
- `GET /requirements/{id}`

### Propose Update
- `PATCH /requirements/{id}`

---

## 9. Success Criteria

The system is correct if:
- Every requirement is accounted for
- Every change is auditable
- Every “done” item has passed tests
- PM sign-off is explicit
- No agent can exceed its authority
