# API flow examples

This service exposes a single endpoint for user interaction. A session is created implicitly on the first request and reused by sending more messages with the same `:id`.

Base URL assumes local dev (`http://localhost:3000`).

## 1) Start a session (first user message)

Choose a session ID (any string) and POST the first user message:

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

## 2) Ask for tool-backed work (LLM may call tools internally)

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

## 3) Follow-up questions keep using the same session

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

## Notes

- Reuse the same `:id` to preserve context; a new `:id` starts a fresh session.
- Tools require the GitHub App credentials to be configured (`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, etc.) so the orchestrator can fetch repo data.
- LLM provider selection is controlled via env vars (`LLM_PROVIDER=openai|gemini`, see README for setup). The API surface is identical regardless of provider.
