create unique index if not exists eval_risk_flags_active_idempotency_idx
  on eval.risk_flags (
    signal_id,
    sku_id,
    coalesce(shipment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status <> 'resolved';

create unique index if not exists eval_reorder_recommendations_idempotency_idx
  on eval.reorder_recommendations (risk_flag_id, inputs_hash);

create unique index if not exists eval_alerts_idempotency_idx
  on eval.alerts (risk_flag_id, level);
