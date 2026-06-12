create table if not exists public.boa_sms_account_state (
  id integer primary key default 1 check (id = 1),
  current_balance numeric(14, 2),
  latest_withdrawal_amount numeric(14, 2),
  latest_deposit_amount numeric(14, 2),
  balance_updated_at timestamptz,
  withdrawal_updated_at timestamptz,
  deposit_updated_at timestamptz,
  last_sms_at timestamptz,
  last_sender text,
  last_message_hash text,
  updated_at timestamptz not null default now()
);

alter table public.boa_sms_account_state enable row level security;

create policy "Allow public read for BOA SMS account state"
  on public.boa_sms_account_state
  for select
  using (true);

insert into public.boa_sms_account_state (id)
values (1)
on conflict (id) do nothing;
