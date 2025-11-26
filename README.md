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
