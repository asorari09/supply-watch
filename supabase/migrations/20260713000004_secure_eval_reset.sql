create or replace function eval.reset_all()
returns void
language plpgsql
security definer
set search_path = eval, pg_temp
as $$
begin
  truncate table eval.approval_records, eval.comms_drafts, eval.alerts,
    eval.reorder_recommendations, eval.risk_flags, eval.shipments, eval.skus,
    eval.suppliers, eval.signals, eval.tick_logs restart identity cascade;
end;
$$;

revoke all on function eval.reset_all() from public;
grant execute on function eval.reset_all() to service_role;

notify pgrst, 'reload schema';
