# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all application code.
- `src/server.ts` boots the HTTP server and initializes Redis.
- `src/app.ts` wires middleware and routes.
- `src/routes/` holds REST endpoint handlers (currently `requirements.ts`).
- `src/validators/` contains Zod request validators.
- `src/types/` defines shared TypeScript types.
- No tests or static assets are currently included.

## Build, Test, and Development Commands
- `npm run dev` runs the server in watch mode via `tsx`.
- `npm run build` компилирует TypeScript в `dist/`.
- `npm start` запускает собранный сервер из `dist/server.js`.
- `npm test` runs the unit test suite with Vitest.
- Redis должен быть доступен по `REDIS_URL` (по умолчанию `redis://localhost:6379`).

## Coding Style & Naming Conventions
- TypeScript, ES modules, 2-space indentation.
- Filenames use lowercase with hyphens only when needed (e.g., `pm-decision` route).
- Route paths are versioned under `/v1/...`.
- Use Zod for request validation; prefer explicit schemas per route.
- No lint or formatter is configured; keep changes minimal and consistent.

## Testing Guidelines
- Vitest is used for unit tests (`*.test.ts`).
- Keep tests close to implementation under `src/` (e.g., `src/plan/lint.test.ts`).

## Commit & Pull Request Guidelines
- Use short, imperative commit messages (e.g., "Add Redis state helpers").
- PRs should include a brief summary and testing status (even if tests are not run).
- Link to relevant issues if applicable.

## Configuration & Runtime Notes
- Required role header: `X-Agent-Role` with one of `pm`, `architect`, `coder`, `tester`, or `system`.
- Redis stores a single JSON document key named `state` with `schema_version` fixed at `1.0`.
- Sync endpoint parses `REQUIREMENTS.md` from repo root; ensure the file exists before syncing.
