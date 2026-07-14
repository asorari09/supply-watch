create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.configure_hourly_supply_watch_tick(
  p_tick_secret text
)
returns void
language plpgsql
security definer
set search_path = public, vault, cron, net, pg_temp
as $function$
declare
  existing_job_id bigint;
begin
  if length(trim(p_tick_secret)) < 32 then
    raise exception 'TICK_SECRET must be at least 32 characters.';
  end if;

  delete from vault.secrets where name = 'supply_watch_tick_secret';
  perform vault.create_secret(
    p_tick_secret,
    'supply_watch_tick_secret',
    'Authorization secret for the Supply Watch hourly Vercel tick.'
  );

  for existing_job_id in
    select jobid from cron.job where jobname = 'supply_watch_hourly_tick'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'supply_watch_hourly_tick',
    '0 * * * *',
    $cron$
      select net.http_post(
        url := 'https://supply-watch-43cd0b7g7-abhi-soraris-projects.vercel.app/api/tick/run',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'supply_watch_tick_secret'
          )
        ),
        body := '{"triggerSource":"cron"}'::jsonb
      );
    $cron$
  );
end;
$function$;

revoke all on function public.configure_hourly_supply_watch_tick(text) from public;
