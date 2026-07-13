create schema if not exists eval;

create table if not exists eval.signals (like public.signals including all);
create table if not exists eval.suppliers (like public.suppliers including all);
create table if not exists eval.skus (like public.skus including all);
create table if not exists eval.shipments (like public.shipments including all);
create table if not exists eval.risk_flags (like public.risk_flags including all);
create table if not exists eval.reorder_recommendations (like public.reorder_recommendations including all);
create table if not exists eval.comms_drafts (like public.comms_drafts including all);
create table if not exists eval.approval_records (like public.approval_records including all);
create table if not exists eval.alerts (like public.alerts including all);
create table if not exists eval.tick_logs (like public.tick_logs including all);

create or replace function eval.reset_all()
returns void
language plpgsql
security invoker
set search_path = eval, pg_temp
as $$
begin
  truncate table eval.approval_records, eval.comms_drafts, eval.alerts,
    eval.reorder_recommendations, eval.risk_flags, eval.shipments, eval.skus,
    eval.suppliers, eval.signals, eval.tick_logs restart identity cascade;
end;
$$;

alter table eval.signals enable row level security;
alter table eval.suppliers enable row level security;
alter table eval.skus enable row level security;
alter table eval.shipments enable row level security;
alter table eval.risk_flags enable row level security;
alter table eval.reorder_recommendations enable row level security;
alter table eval.comms_drafts enable row level security;
alter table eval.approval_records enable row level security;
alter table eval.alerts enable row level security;
alter table eval.tick_logs enable row level security;

revoke all on table eval.signals, eval.suppliers, eval.skus, eval.shipments,
  eval.risk_flags, eval.reorder_recommendations, eval.comms_drafts,
  eval.approval_records, eval.alerts, eval.tick_logs from anon, authenticated;
