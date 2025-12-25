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
	•	X-Agent-Id: string (trace/debug only; not security)

Requests missing X-Agent-Role or X-Agent-Id MUST return 401 Unauthorized.

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
“priority”: { “tier”: “p0”, “rank”: 1 },
“overall_status”: “not_started”,
“sections”: {
“pm”: {
“status”: “unaddressed”,
“direction”: “”,
“feedback”: “”,
“decision”: “pending”
},
“architect”: {
“status”: “unaddressed”,
“design_spec”: “”
},
“coder”: {
“status”: “unaddressed”,
“implementation_notes”: “”,
“pr”: null
},
“tester”: {
“status”: “unaddressed”,
“test_plan”: “”,
“test_cases”: [],
“test_results”: { “status”: “”, “notes”: “” }
}
}
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

4) API Endpoints

All endpoints are JSON. Unknown fields in requests MUST be rejected with 400.

4.1 Get full project state
	•	GET /v1/requirements
	•	Response: { “requirements”: { “REQ-1”: REQ, ... } }

4.2 Get top requirements (priority ordered)
	•	GET /v1/requirements/top
	•	GET /v1/requirements/top/{n}
	•	Response: { “requirements”: [REQ, ...] }

4.3 Get requirements by status
	•	GET /v1/requirements/status/{status}
	•	Response: { “requirements”: [REQ, ...] }

4.4 Get requirements by priority range
	•	GET /v1/requirements/priority-range?min={min}&max={max}
	•	Response: { “requirements”: [REQ, ...] }

4.5 Get audit log
	•	GET /v1/audit?limit={n}
	•	Response: { “entries”: [ { “id”: “...”, “fields”: { ... } } ] }

4.6 Get one REQ
	•	GET /v1/requirements/{req_id}
	•	Response: REQ

4.7 Create REQ (PM only)
	•	POST /v1/requirements/bulk
	•	Body: { “requirements”: [ { “req_id”: “REQ-001”, “title”: “...”, “priority”: { “tier”: “p0”, “rank”: 1 } } ] }
	•	Orchestrator will fill missing sections with defaults.

4.8 Update REQ sections (role-scoped)
	•	PUT /v1/requirements/{req_id}/pm
	•	PUT /v1/requirements/{req_id}/architecture
	•	PUT /v1/requirements/{req_id}/engineering
	•	PUT /v1/requirements/{req_id}/qa
	•	PUT /v1/requirements/{req_id}/status

Bodies:
	•	PM section update:
{
“section”: { “status”: “unaddressed”, “direction”: “”, “feedback”: “”, “decision”: “pending” },
“priority”: { “tier”: “p0”, “rank”: 1 }
}
	•	Architect section update:
{
“section”: { “status”: “unaddressed”, “design_spec”: “” }
}
	•	Coder section update:
{
“section”: { “status”: “unaddressed”, “implementation_notes”: “”, “pr”: null }
}
	•	Tester section update:
{
“section”: { “status”: “unaddressed”, “test_plan”: “”, “test_cases”: [], “test_results”: { “status”: “”, “notes”: “” } }
}
	•	Overall status update:
{
“overall_status”: “not_started”
}

Rules:
	•	PM may update:
	•	overall_status
	•	sections.pm.*
	•	priority
	•	Architect may update:
	•	sections.architect.*
	•	Coder may update:
	•	sections.coder.*
	•	Tester may update:
	•	sections.tester.*

Unauthorized paths MUST return 401.

4.9 Validation / Health
	•	GET /health
	•	Response: { “ok”: true }

5) Required Agent Behavior

All agents MUST:
	1.	Read ORCHESTRATION_SPEC.md
	2.	Read REQUIREMENTS.md
	3.	Read /v1/requirements
	4.	Apply only role-allowed updates
	5.	Never add/remove scope beyond REQUIREMENTS.md
	6.	Ensure orchestrator state remains complete and current

6) Versioning

This spec has a version string in /v1/requirements metadata. Any breaking change increments spec major version and requires updating all agent prompts.

⸻
