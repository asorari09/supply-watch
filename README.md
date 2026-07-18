# Supply Watch

[![CI](https://github.com/asorari09/supply-watch/workflows/CI/badge.svg)](https://github.com/asorari09/supply-watch/actions/workflows/ci.yml)

Supply-chain disruption monitoring that turns live weather/news signals into **deterministic reorder decisions**, then drafts supplier emails behind a human approval gate.

**Live demo:** [supply-watch-console.vercel.app](https://supply-watch-console.vercel.app)

**Run demo scenario:** open the dashboard and click **Inject synthetic disruption** (or run `pnpm seed:demo` locally). That clears prior synthetic demo state, inserts a labeled scenario, and runs the real assessment pipeline.

![Supply Watch system design](./docs/architecture.svg)

## What it does

- Ingests real Open-Meteo weather and RSS/news feeds on an hourly tick
- Correlates signals to synthetic suppliers, SKUs, and in-transit shipments
- Computes safety stock, reorder point, and order quantities with closed-form math
- Drafts supplier communications for human edit / approve / reject (fail-closed send)

## Why it's interesting

- **Deterministic reorder engine** is fully decoupled from the LLM; quantities, risk, and reorder decisions never come from a model
- **Sabotage-verified eval harness**: a formula-canary deliberately breaks ROP and must be caught
- **Fail-closed human approval**: send re-checks approval status at send time
- **Live hourly monitoring** of real weather/news feeds with a **signal-to-source evidence trail** on the dashboard

## Design decisions and tradeoffs

| Decision | Why | Failure it prevents |
|----------|-----|---------------------|
| Reorder math is pure functions with **zero LLM** in the decision path (`src/lib/inventory/`) | Planners need reproducible quantities under audit | An LLM inventing ROP/Q that looks plausible but is wrong |
| Wire-schema vs domain-schema at provider boundaries (Zod) | External feeds lie; adapters must degrade, not throw garbage inland | Corrupted weather/news payloads poisoning inventory state |
| Comms LLM is schema-locked to subject/body/tone only | Narrative is useful; authority is not | Model "helpfully" changing order quantities in the email |
| Human approval gate, re-checked at send time | Drafts are cheap; mistaken sends are not | Approving once, then sending a later edited draft without review |
| Formula-canary in the eval suite | Unit tests can miss a one-line formula bug | Silent ROP regression shipping to the hourly tick |

## Known limitations

- Inventory in this demo is **synthetic**; weather and news signals are **real**
- RSS is a replaceable adapter; production would swap in a commercial logistics API and real inventory data
- No RAG / embeddings / vector DB, no PostGIS, no queues or long-lived workers
- Sends are mock/logged unless `ENABLE_REAL_SEND` is explicitly enabled
- The system runs end-to-end with every LLM feature off
- Scenario pass rate is not a headline metric: self-authored scenarios can trivially pass

## Honest metrics

| Evidence                    | Proof in this repo                                |
| --------------------------- | ------------------------------------------------- |
| Offline unit + replay tests | **137** passing                                   |
| Live-DB integration         | **2** tests against an isolated `eval` schema     |
| Formula-canary              | Sabotage-verified (perturbed ROP fails the suite) |
| Build / CI LLM cost         | **$0** (LLM mocked / disabled in automated runs)  |

## Architecture

Three stages: **Signal Monitor** (adapters, validate, degrade-not-throw) → **Assessment Engine** (deterministic correlation + reorder math, zero LLM) → **Comms Agent** (only LLM; schema-locked to subject/body/tone) behind a human gate.

Hourly Supabase `pg_cron` hits an authed `/api/tick/run` endpoint protected by a Postgres advisory lock. The Next.js dashboard reads persisted state. Frozen-clock replay validates the engine.

Deep design: [`docs/specification.md`](./docs/specification.md)

## Tech stack

Next.js 15 · React 19 · TypeScript (strict) · Supabase Postgres · Zod · Vitest · Open-Meteo · RSS · optional OpenAI (comms drafting only)

## Local setup

Prerequisites: Node 22+, pnpm, linked Supabase project.

```bash
pnpm install
cp .env.example .env
# Fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TICK_SECRET

pnpm db:push
pnpm db:seed        # synthetic suppliers / SKUs / shipments
pnpm seed:demo      # labeled dashboard cascade
pnpm dev            # http://localhost:3000 → /dashboard
```

### Env vars

Required (see [`.env.example`](.env.example)):

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TICK_SECRET
```

Optional: `ENABLE_LLM_COMMS`, `ENABLE_LLM_NEWS`, `ENABLE_LLM_NARRATION`, provider keys, `APPROVER_NAME`, Langfuse. Keep `.env` local; never commit it.

### Scripts

```bash
pnpm dev                 # Next.js dev server
pnpm build               # Production build
pnpm typecheck           # tsc --noEmit
pnpm lint                # ESLint
pnpm format:check        # Prettier
pnpm test:run            # Offline suite (no live DB)
pnpm test:integration    # Live-DB eval schema suite
pnpm evals:report        # Replay / eval summary
pnpm db:seed             # Seed synthetic inventory
pnpm seed:demo           # Fresh demo cascade
pnpm db:verify           # Confirm seed row counts
```

## License

MIT
