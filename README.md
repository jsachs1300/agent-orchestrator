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
- `GITHUB_APP_PRIVATE_KEY` (PEM with newlines escaped as `\n`)
- `GITHUB_STATE_SECRET` (used to verify the `state` JWT sent to `/auth/github/callback`)

Use `signStateToken(sessionId)` from `src/core/github-app.ts` to produce the `state` value when redirecting users to install the app. After GitHub redirects back to `/auth/github/callback`, the server links the installation ID to the session and refreshes an installation token for tool access.

## Testing

Run the automated test suite (builds TypeScript before executing Node's test runner):

```bash
npm test
```
