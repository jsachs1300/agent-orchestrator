# Agent Orchestrator

Multi-threaded LLM orchestrator that routes between:

- User thread (UI)
- Tool threads (git, repo, CI, etc.)

## Dev

```bash
npm install
cp .env.example .env
# set OPENAI_API_KEY in .env

npm run dev
```

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

## Testing

Run the automated test suite (builds TypeScript before executing Node's test runner):

```bash
npm test
```
