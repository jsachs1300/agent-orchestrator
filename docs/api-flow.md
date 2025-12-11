# API flow examples

This service exposes endpoints to create, inspect, and message sessions. A session keeps each user's context, tool configuration (credentials, target repos, etc.), and history isolated from other sessions.

Base URL assumes local dev (`http://localhost:3000`).

## 1) Create a session (recommended)

Create a session with any metadata, context, and per-tool configuration the user should access. Sessions are persisted to Redis when configured.

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "id": "demo-session",
    "goal": "Explore a repo",
    "context": {"user": "sophie"},
    "tools": [{"name": "repo.list_branches", "config": {"owner": "octo", "repo": "demo"}}]
  }'
```

You can also skip this step and let the first message implicitly create the session.

## 2) Start talking to the session

Choose a session ID (any string) and POST a user message:

```bash
curl -X POST http://localhost:3000/sessions/demo-session/message \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, who are you?"}'
```

Example response:

```json
{
  "sessionId": "demo-session",
  "messages": ["Hi! I'm the agent orchestrator. How can I help?"]
}
```

## 3) Ask for tool-backed work (LLM may call tools internally)

Send another message to the same session. The orchestrator may call tools (e.g., GitHub repo tools) behind the scenes; the API response only returns the user-visible messages produced in that turn.

```bash
curl -X POST http://localhost:3000/sessions/demo-session/message \
  -H "Content-Type: application/json" \
  -d '{"text":"List the branches in jsachs1300/agent-orchestrator"}'
```

Example response (after the LLM triggers `repo.list_branches`):

```json
{
  "sessionId": "demo-session",
  "messages": [
    "Here are the branches for jsachs1300/agent-orchestrator:\n- main (protected)\n- dev"
  ]
}
```

## 4) Follow-up questions keep using the same session

The orchestrator maintains conversation state (system/user/tool history). Keep POSTing to `/sessions/:id/message`:

```bash
curl -X POST http://localhost:3000/sessions/demo-session/message \
  -H "Content-Type: application/json" \
  -d '{"text":"Show the first few files in the repo"}'
```

Example response (after the LLM triggers `repo.read_tree` and summarizes):

```json
{
  "sessionId": "demo-session",
  "messages": [
    "Top-level files:\n- README.md\n- package.json\n- src/\n- tests/"
  ]
}
```

## 5) Inspect a session's LLM exchanges (admin/debug)

For debugging, the admin UI can read the raw JSON payloads exchanged with the
LLM and the actions the orchestrator took in response. Call:

```bash
curl http://localhost:3000/sessions/demo-session/debug
```

Example response:

```json
{
  "sessionId": "demo-session",
  "debugLog": [
    {
      "id": "ce89...",
      "cycle": 1,
      "timestamp": "2024-08-22T18:19:00.000Z",
      "llmRequest": [
        {"role": "system", "content": "...system prompt..."},
        {"role": "user", "content": "{\n  \"context\": ... }"}
      ],
      "llmResponseRaw": "{\"actions\": [...], \"control\": {...}}",
      "parsedResponse": {"actions": [...], "control": {}},
      "actions": [
        {"type": "send_message", "content": "Hello!"},
        {
          "type": "tool_call",
          "tool": "repo.list_branches",
          "params": {"owner": "octo", "repo": "demo"},
          "result": {"success": true, "result": ["main", "dev"]}
        }
      ]
    }
  ]
}
```

Each entry corresponds to a single orchestration cycle and captures the prompt
sent to the LLM, the raw JSON response, the parsed structure, and the
orchestrator steps taken (including tool call results).

## Notes

- Reuse the same `:id` to preserve context; a new `:id` starts a fresh session.
- Tools require the GitHub App credentials to be configured (`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, etc.) so the orchestrator can fetch repo data.
- LLM provider selection is controlled via env vars (`LLM_PROVIDER=openai|gemini`, see README for setup). The API surface is identical regardless of provider.
