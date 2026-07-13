# Supply Disruption Response Agent — Master Specification (v2, LOCKED)

**The single source of truth for Project 2. If code and this doc disagree, one of them is wrong — fix it on purpose, don't drift.**

- **Owner:** Abhi · **Planning partner:** Claude · **Builder:** Codex CLI (Azure `gpt-5.3-codex`), one step per prompt · **Auditor/debugger:** Cursor
- **Status:** BUILD-READY. Two adversarial audits applied (one staff-FDE pass, one Fable deep audit). All blockers resolved; four open questions locked (§6, §23). Start at Step 0 (§18).
- **Audience:** a coding agent building literally off this doc, and future-me. Written so a reader with **zero prior context** understands the whole project.

### Changelog v1 → v2 (audit lock)
Applied the Fable deep-audit changelist: fixed the signal-status enum contradiction (B1); defined the alert/draft/actionable predicates (B2); added idempotency keys to every table (B3); connected shipment exposure to the math (B4); added a numeric contract so exact-eval assertions are safe (B5); gave signal lifecycle transitions an owner and disambiguated stale vs resolved (B6); reordered build steps so the harness precedes the dashboard (B7); made the degraded-signal policy strict and self-consistent (B8); made the eval harness non-tautological (canary + hand-computed fixtures); capped every LLM surface; locked tick auth + concurrency; and resolved the four open questions.

---

## Table of contents
1. Context & why this project exists
2. What the system does (plain English)
3. Breadth mandate — why this must not resemble Project 1
4. Guardrails (day-one, non-negotiable)
5. Locked stack
6. Scheduling (LOCKED)
7. System design & architecture
8. Process map (flow, state machines, predicates)
9. The deterministic reorder engine + numeric contract
10. Correlation logic & exposure types
11. Data model & schemas (incl. idempotency keys)
12. LLM boundaries & cost routing
13. External signal sources & adapter contracts
14. Human-in-the-loop approval workflow
15. Dashboard / UI spec
16. Eval design — simulation / replay harness
17. Cost ceilings & LLM discipline
18. Build order
19. Codex operating rules
20. Audit decisions already litigated
21. Explicit non-goals
22. README spec
23. Resolved locks (was: open questions)
24. Glossary

---

## 1. Context & why this project exists

**Project 2 of a three-project Applied AI / Forward Deployed Engineer (FDE) portfolio.** The portfolio proves range across the systems an FDE actually ships — not three variations on one trick.

- **Project 1 — PriorAuth Copilot (COMPLETE, live).** Healthcare prior-authorization decision-support pipeline. LangGraph, Next.js 15/TS, Supabase **pgvector** RAG over real payer PDFs, OpenAI extraction + Claude synthesis, **code-forced** outcome enum, 26-case golden eval suite (100% accuracy, 0% false-approve, 100% citation validity), ablation+canary provenance proofs, Langfuse, ~90% cost reduction (~$0.004/case), honest preset-replay demo, on Vercel. Repo: `github.com/asorari09/priorauth-copilot`. Demonstrated **RAG/vector search, citation grounding, request→response SSE, golden-set Q&A evals.**
- **Project 2 — Supply Disruption Response Agent (THIS DOC).** Must demonstrate a **different** muscle set (§3).
- **Project 3 — Incident Root Cause Copilot (future).** Post-hoc diagnosis. P2 stays distinct: **P2 is scheduled prevention/forecasting, not after-the-fact root cause.**

**Resume bullets already committed (the build must make each literally true):**
1. Signal correlation to auto-flag at-risk **shipments**.
2. A deterministic reorder engine decoupled from LLM reasoning.
3. A three-agent pipeline (signal monitor, impact assessment, supplier comms) with human-approval gating.

Bullet 1 requires shipment-level flags to exist and be proven (§10, §16). Nothing in the build may contradict these three claims.

---

## 2. What the system does (plain English)

Watches the outside world for disruption events, works out which of *your* shipments and SKUs are exposed, does the inventory math to decide what to reorder and when, and drafts supplier emails — **but never sends anything without a human approving it.**

It runs on a schedule in the background (no user waiting), keeps its state in Postgres between runs, and surfaces everything on a dashboard where a human reviews flags and approves/edits drafted comms.

Per scheduled **tick**: expire/resolve stale signals → poll weather + news/RSS → normalize to clean **signals** → correlate active signals against a synthetic inventory DB → apply disruption effects and run deterministic reorder math → flag exposed items → draft supplier comms (the only load-bearing LLM use) behind an **approval gate**. A human reviews the draft next to the deterministic numbers and approves/edits/rejects; only an approved draft can ever be "sent" (mocked/logged by default). A demo **"Inject Synthetic Disruption"** button triggers a labeled scenario on demand.

---

## 3. Breadth mandate — why this must not resemble Project 1

Hard constraint.

| Dimension | Project 1 | Project 2 (this) |
|---|---|---|
| Execution model | Request→response, user-initiated | Scheduled background ticks, event-driven |
| External data | Static payer PDFs (clean) | Live weather + news APIs (flaky) |
| State | Per-request, ephemeral | Time-series signal + flag state persisted |
| What fires work | A human asks | Cron tick + threshold crossings |
| Decision core | Code-forced enum over RAG | Deterministic inventory math |
| Eval paradigm | 26 golden Q&A pairs | Replayable disruption **scenarios** on a frozen clock |
| Human role | Reads the answer | Approval gate *in* the loop, persisted |
| Guardrail story | Citation validity | Fail-closed + no-unapproved-send + exact math |

**Anti-overlap (enforced):** No vector DB. No pgvector. No RAG as a load-bearing component. No citation-validation harness. Keep distinct from Project 3 (scheduled prevention, not post-hoc diagnosis).

---

## 4. Guardrails (day-one, non-negotiable)

1. **Deterministic logic owns every decision. LLMs narrate and draft only.** Risk, reorder yes/no, quantity, timing → TypeScript from formulas. LLM output schemas contain **only fields the LLM authors** (draft subject/body/tone, free-text summary). Never `should_reorder`, `order_qty`, `is_at_risk`, `severity_score`, `lead_time_delta`.
2. **Wire-schema vs domain-schema split at every provider boundary.** Raw weather/news/LLM shapes are *wire*, validated (Zod) inside an adapter, mapped to *domain* types. Business code never touches a raw provider shape.
3. **Fail closed, always.** Missing/garbage signal data → persist `degraded`, exclude from correlation (§8.2), never fabricate. Missing inventory stats → `insufficient_data`, never a number. A draft with no `approved` record is **never** sendable; the send path re-checks approval *at send time*.
4. **Time is an injected input.** Every stage reads "now" from `RunContext.clock`. Grep-forbid `new Date(` outside adapters/infra. This is what makes replay evals possible.
5. **Idempotency.** A tick that runs twice (or overlaps) creates no duplicate signals, flags, recommendations, drafts, or alerts. Enforced by DB keys (§11) **and** an advisory lock (§7.3), not by upserts alone.
6. **Strict API cost discipline** (§17). Cheap models default, env-routed; every LLM surface capped per tick; flag estimated cost before any batch.
7. **Honest demos.** Replays labeled. Synthetic inventory labeled. Sends mocked/logged unless a transport is deliberately env-wired. `MODE: live | replay` badge mandatory. No canned data shown as live.

---

## 5. Locked stack

- **Language/framework:** TypeScript, Next.js 15 (App Router).
- **DB:** Supabase (Postgres). Plain relational tables. **No pgvector.** "Time-series" = indexed `detected_at`. Geo matching plain SQL/TS, **not PostGIS** (§20).
- **Scheduling:** scheduler-agnostic authed tick endpoint fired by **Supabase `pg_cron`, hourly** (§6). **No long-lived workers. No Docker.**
- **LLM providers:** OpenAI + Anthropic behind one `llm` adapter with **env-var model routing** (`LLM_MODEL_NEWS`, `LLM_MODEL_NARRATION`, `LLM_MODEL_COMMS`), each defaulting to a current cheap-model class (Haiku / gpt-4o-mini-tier). README names the env var, not a specific model.
- **External sources (free/keyless preferred, behind adapters):** Weather = **Open-Meteo** (keyless). News = **RSS/GDELT** (free). Same interface accepts a commercial logistics feed (project44/Everstream) for the enterprise story — don't build it.
- **Region taxonomy:** **ISO 3166-1/-2 codes**, a small curated subset seeded consistently across suppliers/shipments/signals (§23).
- **Validation:** Zod at every wire→domain boundary.
- **Observability:** Langfuse for LLM calls + structured JSON logging per tick.
- **Deploy:** Vercel. **Secrets:** `.env` local, Supabase Vault / env vars in prod. **Never commit `.env`.**

---

## 6. Scheduling (LOCKED)

Vercel Hobby cron has a once-per-day minimum cadence; per-minute needs Pro. Function **duration** (60s Hobby / 300s Pro) is not a constraint at this scale. **Live cadence is not load-bearing** — the demo rests on the Inject button + replay harness.

**Locked:** the tick is a **scheduler-agnostic authed POST endpoint** `/api/tick/run`, fired **hourly by Supabase `pg_cron`** (free, sub-daily-capable). The cron secret is stored in **Supabase Vault**, not inline in `cron.job` (which is plaintext). Auth + concurrency contract in §7.3. Swapping to Vercel Pro cron or an external scheduler is a config change, never a code change.

---

## 7. System design & architecture

### 7.1 Naming: three-agent narrative, precise internals
Keep the resume's "three-agent pipeline." Internally name the pieces precisely so a skeptic can't dismiss a deterministic script as a hyped "agent":
- **Signal Monitor** — scheduled ingest + normalization (deterministic; optional cheap-LLM news extractor).
- **Assessment Engine** — deterministic correlation + inventory math. **No LLM in the decision path** (optional narration only).
- **Comms Agent** — the LLM-driven stage: drafts supplier comms, gated behind human approval.

Lead with: *"A three-stage pipeline where two stages are deterministic by design and only the comms stage is LLM-driven — behind a human-approval gate."* Determinism is the selling point.

### 7.2 Execution model
Everything is driven by **ticks**, not requests. Each tick is short-lived and stateless in memory; **all continuity lives in Postgres** (the time-series/streaming-state story).

```
  Scheduler (Supabase pg_cron, hourly) ── POST /api/tick/run (Bearer auth) ──┐
                                                                             ▼
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ TICK  (single request; advisory lock held; one trace)                      │
  │ 0. expireAndResolveSignals(now) → reevaluateFlagsForResolvedSignals()      │
  │ 1. Signal Monitor: fetch weather + news adapters (timeout/retry) ·         │
  │    wire→domain (Zod) · dedupe · upsert · [opt cheap LLM: news→fields]      │
  │ 2. Assessment Engine (NO LLM decisions):                                   │
  │    correlate active signals ↔ suppliers/shipments · apply exposure ·       │
  │    reorder engine → recommendations · emit risk_flags ·                    │
  │    threshold crossings → alerts · actionable flags → pending drafts ·      │
  │    [opt cheap LLM: narration only]                                         │
  │ 3. Comms Agent: draft {subject,body,tone} for pending flags (capped)       │
  │    → status pending_approval                                               │
  │ write TickLog(tick_id, trigger_source, mode, counts, duration, est_cost)   │
  └──────────────────────────────────────────────────────────────────────────┘
                                     │ (async, human-paced)
                                     ▼
  DASHBOARD: signal feed · before/after delta cards · pending approvals
             (Approve/Edit/Reject) · timeline/log · Inject button · MODE badge
                                     │ (only if approved)
                                     ▼
  POST /api/comms/send ── re-checks approval (fail-closed) ── sends edited_body
                          if present ── mock/logged by default
```

**Chaining (LOCKED):** steps 0–3 run **in-process on one tick request** — one scheduler entry, one trace. Split only as a forced fallback on timeout risk (won't happen at this scale); record here if it does. Event-driven behavior lives *inside* the Assessment Engine (threshold logic → alerts + drafts). No Kafka/Redis/queues.

### 7.3 Tick auth & concurrency (LOCKED)
- **Auth:** `Authorization: Bearer $TICK_SECRET`; constant-time compare; `401` on mismatch/missing. The **Inject endpoint** (`/api/tick/inject`) shares the same auth. Secret in Supabase Vault.
- **Concurrency:** the tick acquires a Postgres **advisory lock** (`pg_try_advisory_lock`) or a `tick_lock` row at entry; if not acquired, return `200` no-op ("tick already running"). Upserts alone do not make the read-compute-write of threshold crossings safe against overlapping fires — the lock does.

---

## 8. Process map (flow, state machines, predicates)

### 8.1 End-to-end lifecycle
```
SIGNAL:         active → (stale | resolved | degraded)      (persisted directly as active or degraded)
RISK_FLAG:      open → ack → resolved
RECOMMENDATION: computed (immutable snapshot; a materially changed input creates a new snapshot; never mutated)
COMMS_DRAFT:    pending_approval → approved → sent
                pending_approval → rejected  (terminal; a still-actionable flag may spawn a new draft, generation+1)
```

### 8.2 Signal state machine
A signal is **persisted directly** as `active` (valid wire→domain) or `degraded` (partial/garbage data). There is no persisted `detected` state — "first seen this tick" is transient, not stored. (B1)
- `active`: current, within `expires_at`; eligible for correlation.
- `degraded`: partial/garbage data; persisted with `confidence: low` and **excluded from correlation entirely** — raises **no** flags and **no** recommendations. Visible in the signal feed only. (B8 — strict, matches fail-closed and eval scenario 3.)
- `stale`: a **news** signal not refreshed within `SIGNAL_STALENESS_HOURS` (default 24). Visible, no longer drives new flags.
- `resolved`: a **weather** signal whose `expires_at` (= event end time) has passed. Triggers flag re-evaluation (§8.3). (B6 — `stale` is news-only, `resolved` is weather-only, so the triggers never collide.)

### 8.3 Risk flag state machine
- `open`: created when a correlated **active** signal pushes inventory position below the disruption-adjusted reorder point.
- `ack`: a human opened the linked draft.
- `resolved`: linked signal `resolved` **and**, on re-evaluation with base lead time, inventory position recovers above ROP; or a human manually resolves. `reevaluateFlagsForResolvedSignals()` (tick step 0) owns this transition. (B6)

### 8.4 Comms draft state machine (fail-closed core)
- `pending_approval`: drafted by the Comms Agent. **Not sendable.**
- `approved`: human approved (optionally with `edited_body`). Sendable.
- `rejected`: terminal. If the flag is still actionable next tick, a **new** draft is created with `generation + 1` (rejection doesn't loop the same draft).
- `sent`: reachable only via `/api/comms/send`, which re-reads the approval record and refuses unless `status = 'approved'`. **The sent message body is `edited_body` if present, else `body`.** (Imp 7) Every eval scenario asserts **no `sent` without a matching `approved`.**

### 8.5 Tick pseudocode
```
runTick(ctx):
  if not acquireAdvisoryLock(): return noop("tick already running")
  now = ctx.clock.now()

  # step 0 — lifecycle ownership (B6)
  expireAndResolveSignals(now)              # weather past expires_at → resolved; news past staleness → stale
  reevaluateFlagsForResolvedSignals(now)    # recompute with base LT; auto-resolve recovered flags

  # step 1 — Signal Monitor
  signals = []
  for adapter in [weather, news]:
     r = adapter.fetch(ctx)                 # timeout+retry inside; never throws upward
     signals += r.ok ? r.signals : []       # r.degraded handled; tick continues
  upsertSignals(dedupe(signals))            # unique(dedupe_hash) → idempotent

  # step 2 — Assessment Engine (deterministic)
  for signal in loadActiveSignals(now):     # excludes stale/degraded/resolved
     for item in correlate(signal, suppliers, shipments):   # §10, deterministic
        rec = reorderEngine(item)           # §9; may be insufficient_data
        if actionable(rec):                 # §8.6
           flag = upsertRiskFlag(signal, item)               # idempotent key §11
           lvl = alertLevel(flag, rec)                       # §8.6
           if lvl: upsertAlert(flag, lvl)                    # idempotent key §11
           if needsDraft(flag, rec):                         # §8.6
              enqueuePendingDraft(flag, rec)

  # step 3 — Comms Agent (LLM), capped
  for pending in pendingDraftsThisTick[:MAX_DRAFTS_PER_TICK]:
     draft = commsAgent.draft(pending)      # {subject,body,tone} ONLY
     persist(draft, status='pending_approval')

  writeTickLog(now, trigger_source, mode, counts, estCost)
  releaseAdvisoryLock()
```

### 8.6 Predicate definitions (B2)
- `actionable(rec)` ⇔ `!rec.is_insufficient_data && rec.inventory_position < rec.rop` (shortfall > 0).
- `needsDraft(flag, rec)` ⇔ `flag.status == 'open'` **and** no `comms_draft` exists for `(flag.id, rec.id)` with status in `{pending_approval, approved, sent}`. A materially changed input yields a new `rec.id` (§9/§11), so a changed recommendation re-drafts.
- `alertLevel(flag, rec)` → `Alert.level ∈ {info, warning, critical}`, deterministic:
  - `critical` if `signal.severity == 'high'` **or** `(rec.rop − rec.inventory_position) ≥ 0.50 × rec.rop`
  - else `warning` if `(rec.rop − rec.inventory_position) ≥ 0.25 × rec.rop`
  - else `info`
  (Thresholds are config constants; the point is they're written down, not that these exact values are sacred.)

---

## 9. The deterministic reorder engine + numeric contract (`/lib/inventory`)

Pure functions, exhaustively unit-tested, **zero external calls, zero LLM.** Ships and is fully tested **before** any API integration (Step 3).

Definitions: `d` = avg daily demand, `σ_d` = demand std/day, `LT'` = disruption-adjusted lead time (days), `σ_LT` = lead-time std (days), `Z` = service-level z-score (1.645 ≈ 95%), `S` = order cost, `H` = holding cost/unit/yr, `MOQ` = min order qty. `on_order` counts in-transit shipment quantities **except** those excluded by §10's delay rule.

**Formulas**
- `μ_LT = d × LT'`
- `SS_raw = Z × sqrt( LT' × σ_d² + d² × σ_LT² )`  (if `σ_LT` unknown → `SS_raw = Z × σ_d × sqrt(LT')`; record branch)
- `ROP = μ_LT + SS_raw`
- `D = d × 365`  (annual demand; not stored — derived)
- `EOQ_raw = sqrt( 2 × D × S / H )`
- `IP = on_hand + on_order − backorders`
- **Reorder trigger:** flag when `IP < ROP`.
- **Recommended qty:** `recommended_qty = ceilToMoq( max( EOQ, ROP − IP ) )`

**Numeric contract (makes §16 exact-match assertions safe — B5).** Square roots are irrational, so exact decimals don't exist; the contract rounds to integers deterministically:
- `SS = ceil(SS_raw)` (displayed safety stock, integer)
- `ROP = ceil(μ_LT + SS_raw)` (integer)
- `EOQ = ceil(EOQ_raw)` (integer)
- `ceilToMoq(x) = x ≤ 0 ? 0 : max( MOQ, MOQ × ceil(x / MOQ) )`
- `IP`, `recommended_qty`, and all persisted quantities are **integers**.
- All intermediate math in floating point; **round only at these named points.** Eval fixtures are hand-computed against exactly this contract.

Worked example (MOQ 100): `d=10, σ_d=3, LT'=21, σ_LT=2, Z=1.645, S=100, H=5, on_hand=120, on_order=0, backorders=0`. `μ_LT = d × LT' = 210`. `SS_raw = 1.645 × sqrt(21×9 + 100×4) = 1.645 × sqrt(589) ≈ 39.93 → SS = ceil(39.93) = 40`. `ROP = ceil(210 + 39.93) = ceil(249.93) = 250`. `D = d × 365 = 3650`. `EOQ_raw = sqrt(2 × 3650 × 100 / 5) = sqrt(146000) ≈ 382.10 → EOQ = ceil(382.10) = 383`. `IP = 120 + 0 − 0 = 120`. `IP < ROP` → flag. `shortfall = ROP − IP = 130`. `recommended_qty = ceilToMoq(max(383, 130)) = ceilToMoq(383) = 100 × ceil(3.83) = 400`.

**Rules:** every function returns the inputs it used and the formula branch taken (audit + templated rationale). Missing inputs → `is_insufficient_data = true`, never a guess. Templated rationale, no LLM: `"IP 120 < ROP 250 (LT 14→21d, port closure). SS 40. Order 400 (EOQ 383, shortfall 130 → max 383 → MOQ 400)."` (The "demand shock" idea is **out of scope** — the exposure mapping emits only a lead-time delta. B5/Imp5.)

---

## 10. Correlation logic & exposure types (deterministic)

For each `active` signal, determine exposure deterministically and explainably. `exposure_type ∈ {supplier_region, shipment_route}`. (B4)

- **Region-code match:** signal `affected_regions[]` (ISO 3166) intersected against supplier `region_code` and shipment `route_regions[]` — plain SQL join / set intersection.
- **Bounding-box match (optional, still plain math):** if a signal carries a lat/lon bbox, test supplier `geo` / shipment route points for containment in TS or plain SQL. **No PostGIS** — small synthetic dataset, microseconds (§20).
- Lead-time delta comes from a deterministic config table: `disruption_type × severity → delay_days` (editable config, never LLM-derived).

**The two exposure types and their numeric effect (B4 — this is what makes bullet 1 true):**
1. **`supplier_region`** — signal region hits a supplier's location. Effect: `LT' = LT_base + delay_days` for **all SKUs of that supplier**. Re-run the reorder engine with `LT'`.
2. **`shipment_route`** — signal hits a shipment's route. Effect: the shipment's `eta += delay_days` and `status → 'delayed'`. Then **exclude that shipment's `qty` from `on_order`** for its SKU **iff `new_eta > now + LT'`** (i.e. it won't arrive within the protected lead-time window). Excluding it lowers `IP`, which is the deterministic mechanism by which a delayed shipment can trip `IP < ROP'` and raise a **shipment-level** flag.

A shipment is exposed if any `route_regions[]` (or route points) intersect the signal area; a supplier is exposed if its location does. Every flag is explainable as "signal X's region overlapped supplier/shipment Y."

---

## 11. Data model & schemas (incl. idempotency keys)

Wire types in `*/adapters/*.wire.ts`; domain types in `/lib/domain/*`. Never leak wire into domain. Zod validates every boundary. Postgres mirrors domain types.

**Signal** — `id · source ('weather'|'news') · disruption_type · affected_regions[] (ISO 3166) · geo (bbox|region_codes) · severity ('low'|'med'|'high'|'unknown') · delay_days_estimate · confidence · detected_at · expires_at? · raw_ref · dedupe_hash · status ('active'|'stale'|'degraded'|'resolved')`
- **Unique:** `dedupe_hash`. **Index:** `detected_at`, `status`.

**Supplier** (synthetic) — `id · name · region_code (ISO 3166) · geo · lead_time_days_base · lead_time_std_days? · reliability`

**Sku / InventoryItem** — `id · sku · supplier_id · on_hand · on_order · backorders · avg_daily_demand (d) · demand_std (σ_d) · unit_cost · holding_cost · order_cost · moq · service_level_z`
- `on_order` = sum of in-transit shipment qty **not** excluded by §10's delay rule.

**Shipment** — `id · sku_id · supplier_id · origin_geo · dest_geo · route_regions[] · eta · qty · status ('in_transit'|'delivered'|'delayed')`
- **Index:** `route_regions` (gin). `status` set to `delayed` by §10's `shipment_route` rule.

**RiskFlag** — `id · signal_id · shipment_id? · sku_id · exposure_type ('supplier_region'|'shipment_route') · computed_lead_time_delta · severity · status ('open'|'ack'|'resolved') · created_at · tick_id`
- **Idempotency (B3):** expression partial-unique index `UNIQUE (signal_id, sku_id, COALESCE(shipment_id, '00000000-0000-0000-0000-000000000000')) WHERE status <> 'resolved'`. (Sentinel UUID for null shipment_id — Postgres treats NULLs as distinct, so a bare constraint won't dedupe; the expression index does.)

**ReorderRecommendation** — `id · sku_id · risk_flag_id · ss · rop · inventory_position · recommended_qty · formula_branch · rationale_template · is_insufficient_data · inputs_hash · created_at`  *(all numbers deterministic; no LLM field; snapshots immutable)*
- **Idempotency (B3):** `UNIQUE (risk_flag_id, inputs_hash)`. `inputs_hash = hash({sku_id, on_hand, on_order_effective, backorders, d, σ_d, LT', σ_LT, Z, MOQ, S, H})`. Identical inputs on re-run → upsert no-op; changed inputs → new snapshot row (new `id`) that supersedes for `needsDraft`.

**CommsDraft** — `id · risk_flag_id · recommendation_id · generation · subject · body · tone · model_used · status ('pending_approval'|'approved'|'rejected'|'sent') · sent_at? · tick_id · created_at`  *(subject/body/tone are the ONLY LLM-authored fields in the system)*
- **Idempotency (B3):** `UNIQUE (risk_flag_id, recommendation_id, generation)`. `generation` starts at 1; increments only when the prior draft for that flag was `rejected` and the flag is still actionable.

**ApprovalRecord** — `id · draft_id · decision ('approved'|'rejected') · approver · edited_body? · decided_at`
- `approver` = env-configured operator display name (single-operator assumption, §14).

**Alert** — `id · risk_flag_id · level ('info'|'warning'|'critical') · message_template · created_at · delivered_via ('dashboard'|'webhook')`
- **Idempotency (B3):** `UNIQUE (risk_flag_id, level)`. `delivered_via` defaults `'dashboard'` (§23).

**TickLog** — `id (tick_id) · trigger_source ('cron'|'manual'|'inject'|'replay') · mode ('live'|'replay') · clock_now · counts (jsonb) · duration_ms · est_cost_usd · created_at`

---

## 12. LLM boundaries & cost routing

The LLM appears in **exactly three optional, cheap-model, env-routed, disable-able** places. **The system must run end-to-end with every LLM step off** (deterministic classifier + templated rationale + no drafting) — proven by a test.
1. **News extraction (Signal Monitor).** Only on news items passing a **keyword pre-filter**. Output: `{ disruption_type, affected_regions[], severity_hint }` — extracted fields only. Deterministic keyword classifier is the fallback/default when disabled.
2. **Assessment narration (Assessment Engine).** Dashboard summary. **Narration only — cannot change any number or flag.**
3. **Comms drafting (Comms Agent).** The one load-bearing LLM use. Numbers injected as *facts to echo*, never chosen. Output: `{ subject, body, tone }` only.

Routing via `LLM_MODEL_NEWS`/`LLM_MODEL_NARRATION`/`LLM_MODEL_COMMS`. Weather never touches an LLM. Per-tick caps in §17.

---

## 13. External signal sources & adapter contracts

```ts
interface SignalAdapter {
  name: string;
  fetch(ctx: RunContext): Promise<
    | { ok: true; degraded?: boolean; signals: Signal[] }
    | { ok: false; degraded: true; reason: string }   // never throws upward
  >;
}
```
Every adapter: hard timeout, bounded retries with backoff, wire validation (Zod) before mapping, **degrade-not-throw**, dedupe-hash generation. **Live network calls forbidden in tests** — fixtures only.
- **Weather:** Open-Meteo (keyless). Map alerts/forecast to signals via a deterministic threshold table (severity → `delay_days`).
- **News:** RSS/GDELT. Keyword pre-filter → optional LLM extraction → domain signal. Noise expected; the eval story rests on fixtures, so live false positives are never a claimed metric.
- **Enterprise swap:** same interface accepts project44/Everstream — an interview talking point, not a build item.

---

## 14. Human-in-the-loop approval workflow

- Each actionable flag yields a `pending_approval` draft.
- Dashboard shows the **draft next to the deterministic recommendation it's based on**.
- Actions: **Approve** (optional `edited_body`), **Reject**, or leave pending.
- **Send path `/api/comms/send` re-reads the approval record; refuses unless `status = 'approved'`** (fail closed). Sends `edited_body` if present, else `body`. Default send is **mock/logged**; real transport only if deliberately env-wired and labeled.
- **Identity:** single-operator portfolio assumption — no auth/user system; `approver` = env-configured display name. (Imp 6)
- Decisions persist (`ApprovalRecord`) and survive restarts.
- **Deferred, off by default (§20):** a bounded "few-shot from the last approved draft for this supplier/severity." Not in committed scope; risks drifting toward retrieval patterns.

---

## 15. Dashboard / UI spec

Make an invisible scheduled backend legible and demoable in seconds.
- **`MODE: live | replay` badge** — mandatory.
- **Signal feed** — source, region, severity, status, timestamp (incl. `degraded`, feed-only).
- **At-risk shipments/SKUs as before/after delta cards** — the key legibility device: *"Lead time 14d → 21d (port closure). Reorder point 180 → 250. On-hand below threshold. Recommended order: 300 units."* Two numbers and an arrow, not the formula.
- **Pending approvals** — draft next to its recommendation; Approve / Edit / Reject.
- **Timeline / log viewer** — each tick's decisions in order (which signal fired which recalculation).
- **"Inject Synthetic Disruption" button** — posts to `/api/tick/inject` (same Bearer auth), triggers a labeled scenario via the replay harness; reviewer watches flags raise → safety stock recompute → draft appear. Fully honest (labeled synthetic).
- **TickLog view** — history with counts, duration, est cost.
- **Alerts:** dashboard-only (`delivered_via='dashboard'`); schema keeps `webhook` for a later 30-minute add (§23).

---

## 16. Eval design — simulation / replay harness (NOT golden Q&A)

Scenarios replayed on a frozen clock against a known inventory state, asserting on deterministic outcomes.

**Fixture** = `{ initial_inventory_state, timeline: [{ at: t, inject_signal(s) }, ...], expected: {...} }`. **Expected values are hand-computed against the §9 numeric contract and never machine-generated** — each fixture carries a comment showing the arithmetic. (Imp 1 — this is what stops the eval being tautological.)

**Runner:** loads a fixed inventory snapshot into the eval schema (§23), sets the injected clock per timeline step, feeds scripted signals (no live API calls), runs the tick with **LLM stubbed** by default. Asserts:
1. **Flag correctness** — right shipments/SKUs flagged (precision/recall vs `expected.flags`).
2. **Numeric correctness** — `SS`, `ROP`, `recommended_qty`, `LT'` delta **exactly** match hand-computed integer expecteds (safe because of the numeric contract).
3. **Fail-closed** — missing-demand-stat scenario → `is_insufficient_data`, not a number.
4. **No unapproved send** — no scenario yields a `sent` draft without an `approved` record. Runs in *every* scenario.
5. **Idempotency** — replaying a tick twice changes nothing (verifies the §11 keys + advisory lock).
6. **Degrade-not-crash** — garbage/partial adapter data → tick completes, signal `degraded`, **no** flag.
7. **Formula-canary** — a deliberately perturbed engine build **must fail** the suite. (Imp 1 — the P2 analog of P1's canary-provenance proof; proves the evals actually bind.)

**Scenario set (~7–10):** hurricane → port closure extending a sea route (flag + recompute); supplier-region weather event with no exposed SKU → **must not** flag (false-positive guard); flaky API garbage → degrade; signal resolves → linked flag auto-clears; multi-signal compounding delay; missing-demand-std → insufficient_data; **≥1 explicit `shipment_route` scenario asserting a shipment-level flag** so bullet 1 is proven, not incidental (Imp 8).

**Resume metrics (measured, honest):** numeric-exactness on inventory math, 0 unapproved sends across all scenarios, degrade-not-crash rate, canary-catches. **"Scenario pass rate" is NOT a resume metric** — pass rate on self-authored tests is trivially 100%. (Imp 1)

---

## 17. Cost ceilings & LLM discipline

- **Cheap models by default**, env-routed; a bigger model is a logged env change.
- **LLM optional everywhere** — full deterministic run passes a test with all LLM off.
- **Per-tick caps on every LLM surface (Imp 2):** `MAX_NEWS_LLM_PER_TICK`, `MAX_NARRATION_PER_TICK`, `MAX_DRAFTS_PER_TICK`, plus a per-call `max_tokens` ceiling. News extraction also gated by the keyword pre-filter; weather never hits an LLM.
- **Single-case debugging only** for anything token-spending during dev.
- **Estimate and flag cost before ANY multi-item LLM run** (count × tokens × price); wait for go-ahead.
- **Evals default to stubbed/cached LLM outputs**; a real-LLM pass is a deliberate, cost-flagged checkpoint.
- **CI:** token-spending jobs are manual-dispatch or path-filtered only. No-token adapter/engine tests may run on push.
- Log `est_cost_usd` per tick; per-tick and per-eval-run budget constants; refuse to exceed without an explicit override flag.

---

## 18. Build order (one step = one prompt = one commit)

Each step: build → run tests/checks with **output redirected to `/tmp/<step>.log` and read back** → commit. Never commit `.env`. N+1 waits for N green.

0. **Skeleton.** Next.js 15 TS, Supabase client, env plumbing, Zod, lint/test, `RunContext`/clock, structured logger, `.gitignore` verified.
1. **DB schema + migrations.** All tables (§11) **including idempotency keys/indexes**. Seed synthetic inventory/suppliers/shipments with ISO 3166 regions (labeled synthetic). Create the **eval schema** (§23).
2. **Domain types + Zod validators.** Pure, no I/O. Validation unit tests.
3. **Reorder engine (`/lib/inventory`).** Formulas + **numeric contract** (§9); exhaustive unit tests incl. `insufficient_data`, disruption-delta, and the worked example. **Ships before any API integration.**
4. **Weather adapter.** Open-Meteo wire→domain, timeout/retry/backoff, degrade-not-throw, fixture tests.
5. **News/RSS adapter.** Same discipline. Keyword pre-filter + deterministic classifier.
6. **Signal Monitor.** Compose adapters, dedupe/upsert, persist signals, TickLog. **`expireAndResolveSignals` + idempotency (double-tick = no dupes) test.**
7. **Correlation + Assessment Engine (deterministic).** Exposure types (§10), reorder engine wiring, flags + recommendations (`inputs_hash`), predicates (§8.6), alerts, pending drafts, `reevaluateFlagsForResolvedSignals`. Fixture tests.
8. **Tick endpoint + scheduling.** Authed `/api/tick/run` (Bearer, constant-time), **advisory-lock concurrency guard**, in-process chain, pg_cron wiring + Vault secret (§6/§7.3).
9. **Optional LLM: news extraction.** Cheap model, env-routed, deterministic fallback, capped, single-item debug. Extracted-fields-only schema.
10. **Optional LLM: assessment narration.** Narration-only, capped, cannot alter numbers.
11. **Comms Agent + draft persistence.** LLM draft, `{subject,body,tone}` only, `generation`, `pending_approval`. Single-draft debug.
12. **Approval gate + send path.** UI review (draft next to recommendation), approve/edit/reject, send re-checks approval + sends `edited_body` if present, mock send default. Fail-closed tests.
13. **Simulation/replay eval harness (§16).** Fixtures (hand-computed), runner, all 7 assertion classes incl. formula-canary + `/api/tick/inject`. *(Moved before the dashboard — B7.)*
14. **Dashboard.** Signal feed, before/after delta cards, pending approvals, timeline/log, `MODE` badge, TickLog view, **Inject button wired to the Step 13 harness**.
15. **README + honest demo (§22).**
16. **Deploy to Vercel**, prod env vars + Vault, pg_cron live, smoke test.

---

## 19. Codex operating rules

- **One step per prompt.** N+1 waits for N green.
- **Redirect long/LLM command output to `/tmp/<name>.log` and read it back** — streams disconnect.
- **Commit per step**, descriptive message. **Never commit `.env`** (verify `.gitignore` at Step 0).
- **Single-case debugging only** for token-spending work; no batch LLM runs without an explicit cost-flagged go-ahead.
- **Deterministic-first:** never wire an LLM where a template or classifier suffices.
- **No scope creep:** vector DB, queues, Docker, PostGIS, learning loop → stop, check §20/§21. Decided.
- Grep-forbid `new Date(` outside adapters/infra; business logic uses `ctx.clock`.

---

## 20. Audit decisions already litigated (do not re-open without new material reasoning)

Two adversarial audits done (staff-FDE pass + Fable deep audit); all blockers folded into v2.
- **"Agent" semantics** — three-agent narrative kept (resume-committed), internals named precisely, lead with the two-deterministic-stages framing. Rename-everything rejected (desyncs from resume). (§7.1)
- **PostGIS — REJECTED.** Small synthetic dataset; plain SQL/TS set-intersection and bbox math are microseconds. PostGIS solves a problem this project doesn't have. (§10)
- **Vercel timeout as the binding constraint — CORRECTED.** The real constraint was cron cadence, handled by a scheduler-agnostic endpoint on pg_cron. (§6)
- **HITL "learning loop" — DEFERRED, off by default.** Fights cost discipline and eval determinism; drifts toward retrieval/RAG. Bounded version allowed only post-core. (§14)
- **RSS brittleness — ACCEPTED limitation.** Eval rests on fixtures, not live accuracy; enterprise-API swap is a talking point. Live false-positive rate never claimed. (§13, §16)
- **Inject Synthetic Disruption button — ADOPTED.** Solves the invisible-backend demo problem by reusing the harness. (§15)

---

## 21. Explicit non-goals

Not a RAG system (no vector DB, no retrieval centerpiece). Not a citation-validation project. Not real supplier outreach by default (mocked/logged). Not real proprietary data (synthetic, labeled). Not LLM-decides-anything (LLM never sets quantities/risk/timing). Not a long-lived-worker/streaming-infra project (no Kafka/Redis/Docker). Not a forecasting-ML project (closed-form formulas, no trained model, no demand-shock path). Not a spatial-GIS project (no PostGIS). Not post-hoc incident diagnosis (that's Project 3).

---

## 22. README spec

Mirror P1's honesty: one-paragraph what-and-why + the P1-vs-P2 breadth table; the tick-flow diagram + the "two deterministic stages, one LLM stage behind an approval gate" thesis stated verbatim; locked stack + why no vector DB/RAG/PostGIS; how to run (env vars, seed, run a tick, run the replay suite, use the Inject button); honest-demo section (`MODE`, synthetic inventory, mocked sends, labeled replays); metrics table (real, dated); cost-discipline note; non-goals.
**LLM-visibility beats (Imp 4):** ship the live demo with **news extraction ON**, include a **Langfuse trace screenshot**, and script one demo beat that **toggles the LLM off and shows the system still runs** — this is the AI-engineering story: knowing where *not* to put the model.

---

## 23. Resolved locks (was: open questions)

1. **Scheduling → Supabase `pg_cron`, hourly, secret in Vault.** Free, sub-daily-capable; cadence is non-load-bearing, so Vercel Pro buys nothing. (§6)
2. **Eval DB → a dedicated eval schema in the same Supabase project, truncated per run, selected via a `RunContext` schema/connection param.** No Docker/local installs; a schema costs nothing and keeps prod tables clean. (§18 Step 1)
3. **Region taxonomy → ISO 3166-1/-2, a small curated subset seeded consistently across suppliers/shipments/signals.** A real standard, interview-credible, no toy taxonomy to defend. (§5, §10)
4. **Alert delivery → dashboard-only day one; keep `delivered_via` in the schema.** A webhook adds no portfolio signal and one more thing to demo-proof; the column keeps it a later 30-minute add. (§15)

---

## 24. Glossary

**Tick** — one scheduled pipeline run; short-lived, stateless in memory, state in Postgres. **Signal** — normalized disruption event from a weather/news source. **Risk flag** — a correlated exposure pushing a SKU/shipment below its adjusted reorder point. **Reorder engine** — the deterministic inventory-math core; no LLM. **Inventory position (IP)** — `on_hand + on_order − backorders`. **ROP / SS / EOQ** — reorder point / safety stock / economic order quantity (§9). **Numeric contract** — the named rounding rules that make exact eval assertions safe. **Exposure type** — `supplier_region` (LT delta on a supplier) or `shipment_route` (ETA slip + conditional `on_order` exclusion). **inputs_hash** — hash of engine inputs; identical → no new recommendation snapshot. **generation** — draft counter incremented only on rejection. **Wire vs domain schema** — raw provider shape vs internal validated type; translated only in adapters. **Fail closed** — on missing/bad data or missing approval, refuse rather than guess or send. **Replay / MODE** — deterministic re-run of scripted scenarios on a frozen clock; always labeled.

---

*End of master specification v2 (LOCKED). Build step-by-step from §18. Any deviation gets recorded in this file first.*
