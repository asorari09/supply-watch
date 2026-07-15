-- Additive nullable evidence payload for news/weather provenance.
-- Historical rows remain null; adapters populate going forward only.
alter table public.signals
  add column if not exists evidence jsonb;

alter table eval.signals
  add column if not exists evidence jsonb;
