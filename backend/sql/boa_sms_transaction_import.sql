-- Additive upgrade: run before deploying the backend and companion v1.1.
alter table public.boa_sms_events
  add column if not exists transaction_date text,
  add column if not exists narrative text,
  add column if not exists receipt_url text;

alter table public.transactions add column if not exists source_sms_hash text;
create unique index if not exists transactions_source_sms_hash_key
  on public.transactions (source_sms_hash) where source_sms_hash is not null;

-- Atomic, timestamp-aware merge: delayed retries cannot replace newer balances.
create or replace function public.merge_boa_sms_state(incoming jsonb)
returns setof public.boa_sms_account_state
language sql security invoker set search_path = '' as $$
  insert into public.boa_sms_account_state as current (
    id, current_balance, latest_withdrawal_amount, latest_deposit_amount,
    balance_updated_at, withdrawal_updated_at, deposit_updated_at,
    last_sms_at, last_sender, last_message_hash, updated_at
  ) select id, current_balance, latest_withdrawal_amount, latest_deposit_amount,
    balance_updated_at, withdrawal_updated_at, deposit_updated_at,
    last_sms_at, last_sender, last_message_hash, updated_at
  from jsonb_populate_record(null::public.boa_sms_account_state, incoming)
  on conflict (id) do update set
    current_balance = case when excluded.balance_updated_at >= coalesce(current.balance_updated_at, '-infinity'::timestamptz) then excluded.current_balance else current.current_balance end,
    balance_updated_at = greatest(current.balance_updated_at, excluded.balance_updated_at),
    latest_withdrawal_amount = case when excluded.withdrawal_updated_at >= coalesce(current.withdrawal_updated_at, '-infinity'::timestamptz) then excluded.latest_withdrawal_amount else current.latest_withdrawal_amount end,
    withdrawal_updated_at = greatest(current.withdrawal_updated_at, excluded.withdrawal_updated_at),
    latest_deposit_amount = case when excluded.deposit_updated_at >= coalesce(current.deposit_updated_at, '-infinity'::timestamptz) then excluded.latest_deposit_amount else current.latest_deposit_amount end,
    deposit_updated_at = greatest(current.deposit_updated_at, excluded.deposit_updated_at),
    last_sms_at = greatest(current.last_sms_at, excluded.last_sms_at),
    last_sender = case when excluded.last_sms_at >= coalesce(current.last_sms_at, '-infinity'::timestamptz) then excluded.last_sender else current.last_sender end,
    last_message_hash = case when excluded.last_sms_at >= coalesce(current.last_sms_at, '-infinity'::timestamptz) then excluded.last_message_hash else current.last_message_hash end,
    updated_at = excluded.updated_at
  returning *;
$$;
revoke all on function public.merge_boa_sms_state(jsonb) from public;
grant execute on function public.merge_boa_sms_state(jsonb) to service_role;
