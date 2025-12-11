# Agent Orchestrator

Multi-threaded LLM orchestrator that routes between:

- User thread (UI)
- Tool threads (git, repo, CI, etc.)

## Dev

```bash
npm install
cp .env.example .env
# set OPENAI_API_KEY in .env (or use Vertex AI, see below)

npm run dev
```

### Redis

Set the following environment variables to enable Redis connections (for caching or persistence layers that will be added later):

- `REDIS_HOST` (required)
- `REDIS_PORT` (optional, defaults to `6379`)
- `REDIS_USERNAME` (optional)
- `REDIS_PASSWORD` (optional)
- `REDIS_TLS` (optional, set to `true` to enable TLS)

### GitHub App configuration

The server expects GitHub App credentials to generate installation tokens for repo tools:

- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET` (also signs/verifies the `state` JWT sent to `/auth/github/callback`)
- `GITHUB_PRIVATE_KEY` (PEM with newlines escaped as `\n`)
- `APP_PUBLIC_URL` (optional, recommended) — set this to the externally reachable base URL that GitHub redirects back to
  (e.g., `https://your-app.example.com`). When present, state tokens are bound to this URL to reject callbacks from other
  origins.

Use `signStateToken(sessionId)` from `src/core/github-app.ts` to produce the `state` value when redirecting users to install the app. After GitHub redirects back to `/auth/github/callback`, the server links the installation ID to the session and refreshes an installation token for tool access.

### LLM providers

- Default: OpenAI (`OPENAI_API_KEY`, optional `OPENAI_MODEL`, default `gpt-4.1`).
- Gemini via Vertex AI: set `LLM_PROVIDER=gemini` and configure Vertex AI credentials.

### LLM JSON contract

Each orchestration turn calls the LLM with two messages:

1. A **system prompt** that explains the JSON-only contract.
2. A **user message** containing the serialized session context (goal, metadata, compact session context object, configured tools, and the most recent messages per thread).

The LLM **must respond with a single JSON object** shaped as follows:

```json
{
  "actions": [
    {
      "type": "send_message",
      "target": { "type": "user", "thread": "user" },
      "content": "string"
    },
    {
      "type": "tool_call",
      "target": {
        "type": "tool",
        "thread": "tool:repo",
        "tool": "repo.read_file",
        "call_id": "unique-id"
      },
      "params": { "path": "README.md" }
    }
  ],
  "context": { "summary": "short notes to remember", "plan": "next steps" },
  "control": { "done": true }
}
```

- `actions` (required): ordered list of user-facing messages and tool invocations.
- `context` (required): a compact, machine-readable object that captures everything the LLM needs to remember next turn. The server stores this per session in Redis and sends it back to the LLM on subsequent calls. Prefer terse summaries over verbose transcripts.
- `control.done` (optional): set `true` when the turn is complete; otherwise omit or set to `false` when waiting on tools or further actions.

### API flow examples

See `docs/api-flow.md` for example calls that show the order of operations to start a session and interact with the LLM/tools.

### Sessions

Each user request belongs to a session so that context, tool state, and credentials remain isolated per user. Sessions are
persisted to Redis when `REDIS_HOST` is configured (fallback is in-memory only).

Create a session with optional goal, context, and per-tool configuration (credentials, repo targets, etc.):

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "id": "demo-session",
    "goal": "Triage issues in my repo",
    "context": {"user": "sophie"},
    "tools": [
      {"name": "repo.read_file", "config": {"owner": "octo", "repo": "demo"}},
      {"name": "repo.write_file", "config": {"owner": "octo", "repo": "demo"}}
    ]
  }'
```

#### Optional runtime configuration

Sessions can include an optional runtime block that enables HTTP-aware tools to
talk to an app associated with the session. Runtime settings are stored per
session and are not shared globally.

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "id": "demo-session",
    "runtime": {
      "enabled": true,
      "baseUrl": "https://my-app-dev.example.com",
      "timeoutMs": 5000,
      "auth": { "type": "bearer", "bearerToken": "token-here" }
    }
  }'
```

Runtime auth supports `bearer`, `apiKey` (header/value), `basic`, or `none`. If
runtime is omitted or disabled, HTTP and health tools will return a
`runtime_not_configured` error.

Fetch or update a session (e.g., to rotate credentials for a tool) with `GET /sessions/:id` and `PUT /sessions/:id`. Send
messages to `/sessions/:id/message` to drive the orchestrator for that session.

### Direct tool endpoints

The service also exposes HTTP endpoints for invoking individual tools without
going through the orchestrator. All endpoints expect a `sessionToken` that
identifies the session (matching the `id` used when creating the session).

#### POST /tools/repo/search

Search for a string across repository files.

```bash
curl -X POST http://localhost:3000/tools/repo/search \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "demo-session",
    "owner": "octo",
    "repo": "demo",
    "query": "getUser",
    "paths": ["src/"],
    "maxResults": 5
  }'
```

Response (truncated example):

```json
{
  "success": true,
  "result": {
    "results": [
      {
        "path": "src/api/user.ts",
        "line": 12,
        "column": 7,
        "snippet": "export async function getUser(id: string) {\n  ...\n}"
      }
    ],
    "truncated": false
  }
}
```

#### POST /tools/symbol/find-definition

Locate a likely definition for a JavaScript/TypeScript symbol using lightweight
heuristics. Accepts an optional `pathHint` to prioritize scanning.

```bash
curl -X POST http://localhost:3000/tools/symbol/find-definition \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "demo-session",
    "owner": "octo",
    "repo": "demo",
    "symbolName": "getUser",
    "pathHint": "src/api/user.ts"
  }'
```

Example response:

```json
{
  "success": true,
  "result": {
    "definition": {
      "path": "src/api/user.ts",
      "line": 12,
      "column": 7,
      "snippet": "export async function getUser(id: string) {\n  ...\n}\n"
    },
    "approximate": true
  }
}
```

#### POST /tools/symbol/find-references

Find references to a symbol using text search with an `approximate` flag. Use
`definitionPath` to scope the search to a specific file first.

```bash
curl -X POST http://localhost:3000/tools/symbol/find-references \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "demo-session",
    "owner": "octo",
    "repo": "demo",
    "symbolName": "getUser",
    "definitionPath": "src/api/user.ts"
  }'
```

Example response:

```json
{
  "success": true,
  "result": {
    "references": [
      {
        "path": "src/routes/userRoutes.ts",
        "line": 33,
        "column": 16,
        "snippet": "  const user = await getUser(req.params.id);\n"
      }
    ],
    "approximate": true,
    "truncated": false
  }
}
```

#### POST /tools/http/request

Make an HTTP request to the runtime configured for the session. Fails with
`runtime_not_configured` if the session does not include a runtime block.

```bash
curl -X POST http://localhost:3000/tools/http/request \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "demo-session",
    "method": "GET",
    "path": "/health",
    "headers": {"x-demo": "1"}
  }'
```

Example response:

```json
{
  "success": true,
  "result": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "body": "{\"ok\":true}",
    "isJson": true,
    "json": { "ok": true },
    "error": null,
    "elapsedMs": 42
  }
}
```

#### POST /tools/health/check

Runs a simple GET request (default `/health`) against the runtime base URL and
checks the status code.

```bash
curl -X POST http://localhost:3000/tools/health/check \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "demo-session",
    "path": "/ready",
    "expectedStatus": 200
  }'
```

Example response:

```json
{
  "success": true,
  "result": {
    "ok": true,
    "status": 200,
    "path": "/ready",
    "elapsedMs": 35,
    "details": {
      "status": 200,
      "body": "{\"ok\":true}",
      "isJson": true,
      "json": {"ok": true}
    }
  }
}
```

### Tool schemas

Structured metadata for tools (inputs, required fields, and example payloads)
is available in `src/tools/tool-schemas.ts` so the LLM or UI layer can surface
accurate argument shapes for:

- `repo.search`
- `symbol.find_definition`
- `symbol.find_references`
- `http.request`
- `health.check`

#### Vertex AI (Gemini) setup

1. Enable the Vertex AI API in your GCP project.
2. Create a service account with the **Vertex AI User** role (and **Service Account Token Creator** if using short-lived credentials).
3. Download the JSON key for that service account and point `GOOGLE_APPLICATION_CREDENTIALS` to it.
4. Set the required environment variables:
   - `VERTEX_PROJECT` (or `GOOGLE_CLOUD_PROJECT`): your GCP project ID.
   - `VERTEX_LOCATION` (optional, default `us-central1`).
   - `VERTEX_MODEL` (optional, default `gemini-1.5-pro-002`).
   - `LLM_PROVIDER=gemini`.
5. Run the app as usual (`npm run dev` or `npm start`); the orchestrator will route LLM calls to Gemini with JSON responses enforced via `responseMimeType`.

## Testing

Run the automated test suite (builds TypeScript before executing Node's test runner):

```bash
npm test
```
