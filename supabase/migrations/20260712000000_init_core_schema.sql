create extension if not exists pgcrypto with schema extensions;

do $$ begin
  create type public.signal_source as enum ('weather', 'news');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.signal_status as enum ('active', 'stale', 'degraded', 'resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.severity as enum ('low', 'med', 'high', 'unknown');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.shipment_status as enum ('in_transit', 'delivered', 'delayed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.risk_flag_status as enum ('open', 'ack', 'resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.exposure_type as enum ('supplier_region', 'shipment_route');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.comms_draft_status as enum ('pending_approval', 'approved', 'rejected', 'sent');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.alert_level as enum ('info', 'warning', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.alert_delivery_via as enum ('dashboard', 'webhook');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tick_trigger_source as enum ('cron', 'manual', 'inject', 'replay');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tick_mode as enum ('live', 'replay');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.approval_decision as enum ('approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  source public.signal_source not null,
  disruption_type text not null,
  affected_regions text[] not null,
  geo jsonb not null,
  severity public.severity not null,
  delay_days_estimate integer not null,
  confidence text not null,
  detected_at timestamptz not null,
  expires_at timestamptz,
  raw_ref text not null,
  dedupe_hash text not null,
  status public.signal_status not null,
  unique (dedupe_hash)
);

create index if not exists signals_detected_at_idx on public.signals (detected_at);
create index if not exists signals_status_idx on public.signals (status);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_code text not null,
  geo jsonb not null,
  lead_time_days_base integer not null,
  lead_time_std_days integer,
  reliability numeric not null
);

create table if not exists public.skus (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  supplier_id uuid not null references public.suppliers (id),
  on_hand integer not null,
  on_order integer not null,
  backorders integer not null,
  avg_daily_demand numeric not null,
  demand_std numeric not null,
  unit_cost numeric not null,
  holding_cost numeric not null,
  order_cost numeric not null,
  moq integer not null,
  service_level_z numeric not null
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus (id),
  supplier_id uuid not null references public.suppliers (id),
  origin_geo jsonb not null,
  dest_geo jsonb not null,
  route_regions text[] not null,
  eta timestamptz not null,
  qty integer not null,
  status public.shipment_status not null
);

create index if not exists shipments_route_regions_gin_idx on public.shipments using gin (route_regions);

create table if not exists public.risk_flags (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals (id),
  shipment_id uuid references public.shipments (id),
  sku_id uuid not null references public.skus (id),
  exposure_type public.exposure_type not null,
  computed_lead_time_delta integer not null,
  severity public.severity not null,
  status public.risk_flag_status not null,
  created_at timestamptz not null,
  tick_id uuid not null
);

create unique index if not exists risk_flags_active_idempotency_idx
  on public.risk_flags (
    signal_id,
    sku_id,
    coalesce(shipment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'resolved';

create table if not exists public.reorder_recommendations (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.skus (id),
  risk_flag_id uuid not null references public.risk_flags (id),
  ss integer not null,
  rop integer not null,
  inventory_position integer not null,
  recommended_qty integer not null,
  formula_branch text not null,
  rationale_template text not null,
  is_insufficient_data boolean not null,
  inputs_hash text not null,
  created_at timestamptz not null,
  unique (risk_flag_id, inputs_hash)
);

create table if not exists public.comms_drafts (
  id uuid primary key default gen_random_uuid(),
  risk_flag_id uuid not null references public.risk_flags (id),
  recommendation_id uuid not null references public.reorder_recommendations (id),
  generation integer not null,
  subject text not null,
  body text not null,
  tone text not null,
  model_used text not null,
  status public.comms_draft_status not null,
  sent_at timestamptz,
  tick_id uuid not null,
  created_at timestamptz not null,
  unique (risk_flag_id, recommendation_id, generation)
);

create table if not exists public.approval_records (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.comms_drafts (id),
  decision public.approval_decision not null,
  approver text not null,
  edited_body text,
  decided_at timestamptz not null
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  risk_flag_id uuid not null references public.risk_flags (id),
  level public.alert_level not null,
  message_template text not null,
  created_at timestamptz not null,
  delivered_via public.alert_delivery_via not null default 'dashboard',
  unique (risk_flag_id, level)
);

create table if not exists public.tick_logs (
  id uuid primary key default gen_random_uuid(),
  trigger_source public.tick_trigger_source not null,
  mode public.tick_mode not null,
  clock_now timestamptz not null,
  counts jsonb not null,
  duration_ms integer not null,
  est_cost_usd numeric not null,
  created_at timestamptz not null
);

alter table public.signals enable row level security;
alter table public.suppliers enable row level security;
alter table public.skus enable row level security;
alter table public.shipments enable row level security;
alter table public.risk_flags enable row level security;
alter table public.reorder_recommendations enable row level security;
alter table public.comms_drafts enable row level security;
alter table public.approval_records enable row level security;
alter table public.alerts enable row level security;
alter table public.tick_logs enable row level security;

revoke all on table public.signals, public.suppliers, public.skus, public.shipments,
  public.risk_flags, public.reorder_recommendations, public.comms_drafts,
  public.approval_records, public.alerts, public.tick_logs from anon, authenticated;
