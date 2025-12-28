# ORCHESTRATION_SPEC v2

## 0. Purpose

This specification defines a **state-driven, multi-agent orchestration system** where:

- LLMs are **stateless workers**
- The orchestrator is the **single source of truth**
- All durable knowledge lives in **explicit, validated state**
- Work progresses via **role-scoped work slices**, not conversational history

The system is designed to:
- Minimize prompt size
- Maximize determinism and auditability
- Prevent agent drift and scope creep
- Support Codex-style repo-aware execution alongside API-based reasoning agents

---

## 1. Core Mental Model

- **Context is not memory.** Context is a *view* over orchestrator-managed state.
- **Agents do not own truth.** They propose updates; the orchestrator validates and persists.
- **Conversation is ephemeral.** Only structured artifacts graduate into state.

---

## 2. Agent Roles

| Role | Responsibility |
|----|----|
| PM | Parse requirements, define scope, create work slices, manage priorities |
| Architect | Produce design artifacts for assigned slices |
| Coder | Implement designs in the repo |
| Tester | Define and execute test plans; validate acceptance |
| Orchestrator | Enforce rules, persist state, gate transitions |

Agents MUST identify themselves on every request:

```http
X-Agent-Role: pm | architect | coder | tester
X-Agent-Id: <opaque-string>
```

---

## 3. Authoritative State Model

### 3.1 Requirement (REQ)

A REQ represents **coverage** of a requirement from `REQUIREMENTS.md`.

```json
{
  "req_id": "REQ-001",
  "title": "LLM-driven routing only",
  "priority": "P0",
  "acceptance": [
    "No heuristic intent classification",
    "Routing decisions come exclusively from Router LLM"
  ],
  "constraints": [
    "No additional properties in routing schema",
    "Policy engine must pre-filter models"
  ],
  "source_ref": "REQUIREMENTS.md#routing",
  "status": "derived"
}
```

Notes:
- REQs are **immutable in meaning** once created
- Only PM may create or modify REQs
- `status` is **derived** from slice completion

---

### 3.2 Work Slice (SLICE)

A Slice is the **unit of execution**.

```json
{
  "slice_id": "SL-012",
  "req_id": "REQ-001",
  "title": "Integrate policy engine into routing flow",
  "owner_role": "architect",
  "status": "not_started",
  "depends_on": ["SL-010"],
  "deliverables": {
    "architect": { "design_spec": null },
    "coder": { "implementation_notes": null, "pr": null },
    "tester": { "test_plan": null, "test_results": null }
  },
  "evidence": []
}
```

Rules:
- Every slice has **exactly one active owner role at a time**
- Slices may move between roles sequentially
- Slices should be small enough to complete in a single focused agent run

---

### 3.3 Decision (DEC)

Explicit decisions replace conversational reasoning.

```json
{
  "dec_id": "DEC-003",
  "statement": "Routing must be LLM-driven only",
  "rationale": "Heuristic routing violates REQUIREMENTS.md",
  "owner": "pm",
  "date": "2025-01-10"
}
```

---

### 3.4 Evidence

Evidence anchors state to repo reality.

```json
{
  "type": "file" | "command" | "test" | "pr",
  "ref": "src/routing/engine.ts",
  "result": "pass" | "fail" | null
}
```

---

## 4. State Mutability Rules

| Entity | Who May Write |
|----|----|
| REQ | PM only |
| Slice creation | PM only |
| Slice design | Architect |
| Slice implementation | Coder |
| Slice tests | Tester |
| Decisions | PM only |

Violations MUST return HTTP **401**.

---

## 5. Views (Context Minimization)

Agents NEVER receive global state.

### 5.1 View Principles
- Views are **role-scoped**
- Views are **slice-scoped**
- Views include only required fields

### 5.2 Example Views

**Architect View**
```json
{
  "req": { "title": "...", "acceptance": ["..."], "constraints": ["..."] },
  "slice": { "slice_id": "SL-012", "title": "...", "status": "not_started" },
  "related_decisions": ["..."]
}
```

**Coder View**
```json
{
  "req": { "acceptance": ["..."], "constraints": ["..."] },
  "slice": { "design_spec": "..." }
}
```

---

## 6. REST API Surface

### 6.1 Requirements
- `POST /v1/requirements/bulk` (PM only)
- `GET /v1/requirements/{req_id}`

### 6.2 Slices
- `POST /v1/slices/bulk` (PM only)
- `GET /v1/slices/{slice_id}`
- `GET /v1/slices/next?role=architect|coder|tester`
- `POST /v1/slices/{slice_id}/claim`
- `POST /v1/slices/{slice_id}/release`

### 6.3 Slice Updates (Append / Patch)

- `PATCH /v1/slices/{slice_id}/design`
- `PATCH /v1/slices/{slice_id}/implementation`
- `PATCH /v1/slices/{slice_id}/tests`

Each PATCH:
- May append evidence
- May update slice status
- Must not overwrite other roles' sections

### 6.4 Views
- `GET /v1/views/slice/{slice_id}`

---

## 7. Execution Flow

```pseudo
state = PM_API.parse(REQUIREMENTS.md)
orchestrator.store(state)

loop:
  slice = orchestrator.next_ready_slice()
  agent = spawn(slice.owner_role)
  view = orchestrator.get_view(agent.role, slice.id)
  update = agent.run(view)
  orchestrator.validate_and_apply(update)
```

---

## 8. Guardrails

- No agent may introduce new scope
- No agent may modify another role's artifacts
- All updates must reference evidence when applicable
- Ambiguity must result in a new slice or decision, not invention

---

## 9. Non-Goals

- Conversational memory
- Implicit reasoning chains
- Autonomous scope expansion
- Hidden state mutations

---

## 10. Design Philosophy (Non-Normative)

LLMs are **reasoning accelerators**, not authorities.

The orchestrator is the system.  
The agents are tools.  
The state is truth.
