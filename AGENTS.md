# AGENTS.md — Supply Disruption Response Agent (Project 2)
Single source of truth: `docs/supply-disruption-agent-MASTER-SPEC-v2-LOCKED.md`. Read it before any task.
If this file and the spec disagree, the spec wins — flag the conflict. Never edit anything under docs/.

## Canonical commands (don't guess)
Install `pnpm install` · Dev `pnpm dev` · Build `pnpm build` · Typecheck `pnpm typecheck` ·
Lint `pnpm lint` · Format check `pnpm format:check` · Test all `pnpm test` · Single test `pnpm test <path>`.
Run typecheck + lint + relevant tests before declaring a step done. Redirect long/LLM output to
`/tmp/<name>.log` and read it back.

## Build discipline
Strict one-step-per-prompt build; follow spec §18 order. Do only the requested step; no scope-creep.
One commit per step (Conventional Commits). NEVER commit `.env` or secrets. Local git only — no remote, no push.

## Architecture & boundaries
- `src/lib/inventory/` — deterministic reorder engine. PURE: no I/O, no network, no LLM, no clock.
  Integer/deterministic math per spec §9. Exhaustively unit-tested.
- `src/lib/domain/` — domain types + Zod. No provider/wire shapes.
- `src/lib/adapters/` — provider wire schemas (`*.wire.ts`) + mapping to domain. Validate with Zod;
  degrade-not-throw; never leak wire types upward. No live network in tests (fixtures only).
- `src/lib/agents/{signal-monitor,assessment-engine,comms-agent}/` — pipeline stages. The assessment
  engine makes NO decisions with an LLM.
- `src/lib/runtime/` — RunContext, clock, logger. `src/lib/config/` — env validation. `src/evals/` — replay harness.

## Non-negotiable rules (spec §4)
- Deterministic logic owns every decision. LLMs draft/narrate ONLY; their output schemas contain only
  fields the LLM authors — never quantities, risk, or reorder decisions.
- Wire vs domain split at every provider boundary.
- Fail closed: on missing/bad data or missing approval, refuse — never guess or fabricate.
- Time is injected: use `ctx.clock`, never `new Date()`/`Date.now()` in business logic (lint enforces this).
- Idempotency: no duplicate rows on a re-run (DB keys + advisory lock, later steps).
- Cost discipline: cheap models by default (env-routed); single-case debugging only; flag estimated cost
  before any multi-item LLM run; token-spending CI is manual-dispatch only.

## Code style
TypeScript strict, no `any`. Named exports (except Next.js pages/layouts). kebab-case files, PascalCase
components. No inline `eslint-disable` without a `// reason:` comment.

## Things NOT to do
No vector DB / pgvector / RAG / embeddings (that's Project 1 — banned). No PostGIS, Docker, Kafka/Redis/
queues, long-lived workers. Don't add production deps without listing them. Don't weaken tsconfig/eslint
strictness. Don't call live external APIs in tests. Don't put any LLM call in the decision path. Never touch docs/.
