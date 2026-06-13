create table if not exists public.boa_sms_events (
  id bigserial primary key,
  sms_received_at timestamp with time zone not null,
  sender text null,
  message_hash text not null,
  transaction_type text not null,
  amount numeric(14, 2) not null,
  balance_after numeric(14, 2) null,
  raw_reference text null,
  created_at timestamp with time zone not null default now(),
  constraint boa_sms_events_message_hash_key unique (message_hash),
  constraint boa_sms_events_transaction_type_check
    check (transaction_type in ('deposit', 'withdrawal'))
);

create index if not exists boa_sms_events_sms_received_at_idx
  on public.boa_sms_events (sms_received_at desc);

create index if not exists boa_sms_events_transaction_type_idx
  on public.boa_sms_events (transaction_type);

alter table public.boa_sms_events enable row level security;

drop policy if exists "Allow public read for BOA SMS events" on public.boa_sms_events;
create policy "Allow public read for BOA SMS events"
  on public.boa_sms_events
  for select
  using (true);

drop policy if exists "Allow public writes for BOA SMS events" on public.boa_sms_events;
create policy "Allow public writes for BOA SMS events"
  on public.boa_sms_events
  for all
  using (true)
  with check (true);
