Orchestration Spec (v1)

This document is the authoritative contract for how agents interact with the orchestrator API and the JSON shapes they must send/receive. Agents MUST read this document before taking any action.

1) Identity & Authorization

Every request MUST include an agent identity. No passwords. The orchestrator authorizes by role.

1.1 Required Header
	•	X-Agent-Role: one of
	•	pm
	•	architect
	•	coder
	•	tester

Requests missing X-Agent-Role MUST return 401 Unauthorized.

1.2 Role-based write permissions
	•	PM may write:
	•	overall REQ status (REQ-level)
	•	PM section fields only
	•	Architect may write:
	•	architecture/design section fields only
	•	Coder may write:
	•	implementation section fields only
	•	Tester may write:
	•	test section fields only
	•	Any other attempted write MUST return 401 Unauthorized.

2) Core Concepts

2.1 Project State

The orchestrator stores a canonical, always-current project state as a collection of REQs.

2.2 REQ

A REQ is the unit of work that maps to REQUIREMENTS.md coverage. Every requirement in REQUIREMENTS.md MUST exist as a REQ in the orchestrator state (including completed items).

3) Data Model (Canonical JSON Shapes)

All objects are strict: unknown/extra fields are rejected.

3.1 REQ Object

{
“req_id”: “REQ-001”,
“title”: “Short title derived from REQUIREMENTS.md”,
“source”: {
“file”: “REQUIREMENTS.md”,
“anchor”: “Optional stable anchor (heading path or line range)”,
“text”: “Exact requirement text copied verbatim”
},
“overall_status”: “not_started”,
“sections”: {
“pm”: {
“status”: “not_started”,
“notes”: “”,
“acceptance_criteria”: [],
“dependencies”: [],
“evidence”: []
},
“architect”: {
“status”: “unaddressed”,
“design_spec”: “”,
“interfaces”: [],
“evidence”: []
},
“coder”: {
“status”: “unaddressed”,
“implementation_plan”: “”,
“changed_files”: [],
“evidence”: []
},
“tester”: {
“status”: “unaddressed”,
“test_plan”: “”,
“test_cases”: [],
“results”: [],
“evidence”: []
}
},
“history”: []
}

3.2 Status enums

REQ-level (overall_status):
	•	not_started
	•	in_progress
	•	blocked
	•	in_review
	•	completed

Section-level (sections.*.status):
	•	unaddressed
	•	in_progress
	•	blocked
	•	complete

Notes:
	•	Section defaults: unaddressed
	•	PM may set REQ-level overall_status. Other roles may only suggest via their section notes.

3.3 Evidence item shape

{
“type”: “file|pr|commit|test|endpoint|log|note”,
“ref”: “path or URL or identifier”,
“details”: “short optional text”
}

3.4 History item shape

{
“ts”: “ISO-8601 timestamp”,
“actor_role”: “pm|architect|coder|tester”,
“action”: “create|update”,
“field_paths”: [“sections.pm.notes”, “overall_status”]
}

4) API Endpoints

All endpoints are JSON. Unknown fields in requests MUST be rejected with 400.

4.1 Get full project state
	•	GET /project
	•	Response: { “reqs”: [REQ…], “version”: “v1” }

4.2 Get one REQ
	•	GET /reqs/{req_id}
	•	Response: REQ

4.3 Create REQ (PM only)
	•	POST /reqs
	•	Body: full REQ object OR minimal create shape:
{
“req_id”: “REQ-001”,
“title”: “…”,
“source”: { “file”: “REQUIREMENTS.md”, “anchor”: “…”, “text”: “…” },
“overall_status”: “not_started”,
“sections”: { “pm”: { “status”: “not_started”, “notes”: “”, “acceptance_criteria”: [], “dependencies”: [], “evidence”: [] } }
}
	•	Orchestrator will fill missing sections with defaults if absent.

4.4 Patch REQ (role-scoped)
	•	PATCH /reqs/{req_id}
	•	Body:
{
“set”: {
“overall_status”: “in_progress”,
“sections.pm.notes”: “…”
}
}

Rules:
	•	PM may patch:
	•	overall_status
	•	sections.pm.*
	•	Architect may patch:
	•	sections.architect.*
	•	Coder may patch:
	•	sections.coder.*
	•	Tester may patch:
	•	sections.tester.*

Unauthorized paths MUST return 401.

4.5 Validation / Health
	•	GET /health
	•	Response: { “ok”: true }

5) Required Agent Behavior

All agents MUST:
	1.	Read ORCHESTRATION_SPEC.md
	2.	Read REQUIREMENTS.md
	3.	Read /project
	4.	Apply only role-allowed patches/creates
	5.	Never add/remove scope beyond REQUIREMENTS.md
	6.	Ensure orchestrator state remains complete and current

6) Versioning

This spec has a version string in /project.version. Any breaking change increments spec major version and requires updating all agent prompts.

⸻
