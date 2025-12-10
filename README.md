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

### API flow examples

See `docs/api-flow.md` for example calls that show the order of operations to start a session and interact with the LLM/tools.

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
