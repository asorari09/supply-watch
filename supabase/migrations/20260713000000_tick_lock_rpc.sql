-- Fixed advisory-lock key for the singleton supply-disruption tick: 918273645.
-- It is intentionally stable across deploys so overlapping scheduler fires contend
-- for the same PostgreSQL session-level lock.

create or replace function public.try_tick_lock()
returns boolean
language sql
security definer
set search_path = pg_catalog
as $$
  select pg_try_advisory_lock(918273645::bigint);
$$;

create or replace function public.release_tick_lock()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  perform pg_advisory_unlock(918273645::bigint);
end;
$$;

revoke execute on function public.try_tick_lock() from anon, authenticated;
revoke execute on function public.release_tick_lock() from anon, authenticated;

grant execute on function public.try_tick_lock() to service_role;
grant execute on function public.release_tick_lock() to service_role;
