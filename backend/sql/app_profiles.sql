-- Additive setup: existing ledger, people, construction tables and policies
-- are never changed. Run as the project owner in Supabase SQL Editor.
begin;
create schema if not exists bank_profiles;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Do not relocate an existing extension or affect functions that use it.
do $$ begin
  if not exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'extensions') then
    raise exception 'pgcrypto is installed outside extensions. No changes applied; review its existing schema before setup.';
  end if;
end $$;

create table if not exists bank_profiles.accounts (
  username text primary key check (username = lower(username)),
  display_name text not null,
  password_hash text not null,
  apollo_access boolean not null default false,
  interest_access boolean not null default false,
  enabled boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  check (username = 'dawit' or (not apollo_access and not interest_access))
);
create table if not exists bank_profiles.sessions (
  token_hash text primary key,
  username text not null references bank_profiles.accounts(username),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists profile_sessions_expiry on bank_profiles.sessions(expires_at);
alter table bank_profiles.accounts enable row level security;
alter table bank_profiles.sessions enable row level security;
revoke all on bank_profiles.accounts, bank_profiles.sessions from public, anon, authenticated;

-- This is the existing Apollo password, not a new credential. Only a salted
-- bcrypt hash is stored. Re-running setup preserves an existing profile.
insert into bank_profiles.accounts(username, display_name, password_hash, apollo_access, interest_access)
values ('dawit', 'Dawit', extensions.crypt('pass', extensions.gen_salt('bf', 12)), true, true)
on conflict (username) do nothing;

-- Privileged helpers stay outside exposed schemas. The only public entry
-- points are invoker wrappers; each helper verifies credentials or a token.
create or replace function bank_profiles.sign_in(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  account bank_profiles.accounts%rowtype;
  session_token text;
  expiry timestamptz := now() + interval '8 hours';
begin
  if p_username is null or length(p_username) > 60 or p_password is null or octet_length(p_password) > 72 then
    return jsonb_build_object('error', 'incorrect');
  end if;
  select * into account from bank_profiles.accounts where username = lower(trim(p_username)) and enabled for update;
  if not found then return jsonb_build_object('error', 'incorrect'); end if;
  if account.locked_until > now() then return jsonb_build_object('error', 'locked'); end if;
  if extensions.crypt(p_password, account.password_hash) <> account.password_hash then
    update bank_profiles.accounts set
      failed_attempts = case when account.failed_attempts >= 4 then 0 else account.failed_attempts + 1 end,
      locked_until = case when account.failed_attempts >= 4 then now() + interval '1 minute' else null end
    where username = account.username;
    return jsonb_build_object('error', case when account.failed_attempts >= 4 then 'locked' else 'incorrect' end);
  end if;
  update bank_profiles.accounts set failed_attempts = 0, locked_until = null where username = account.username;
  delete from bank_profiles.sessions where expires_at <= now();
  session_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into bank_profiles.sessions(token_hash, username, expires_at)
  values (encode(extensions.digest(session_token, 'sha256'), 'hex'), account.username, expiry);
  return jsonb_build_object('token', session_token, 'expires_at', expiry, 'profile',
    jsonb_build_object('username', account.username, 'name', account.display_name,
      'apollo_access', account.apollo_access, 'interest_access', account.interest_access));
end;
$$;

create or replace function bank_profiles.session(p_token text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('expires_at', s.expires_at, 'profile',
    jsonb_build_object('username', a.username, 'name', a.display_name,
      'apollo_access', a.apollo_access, 'interest_access', a.interest_access))
  from bank_profiles.sessions s join bank_profiles.accounts a on a.username = s.username
  where p_token ~ '^[a-f0-9]{64}$' and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.expires_at > now() and a.enabled;
$$;

create or replace function bank_profiles.sign_out(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from bank_profiles.sessions
  where p_token ~ '^[a-f0-9]{64}$' and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.app_profile_sign_in(p_username text, p_password text)
returns jsonb language sql security invoker set search_path = '' as $$
  select bank_profiles.sign_in(p_username, p_password);
$$;
create or replace function public.app_profile_session(p_token text)
returns jsonb language sql security invoker set search_path = '' as $$
  select bank_profiles.session(p_token);
$$;
create or replace function public.app_profile_sign_out(p_token text)
returns void language sql security invoker set search_path = '' as $$
  select bank_profiles.sign_out(p_token);
$$;

revoke all on function bank_profiles.sign_in(text,text), bank_profiles.session(text), bank_profiles.sign_out(text) from public;
revoke all on function public.app_profile_sign_in(text,text), public.app_profile_session(text), public.app_profile_sign_out(text) from public;
grant usage on schema bank_profiles to anon, authenticated;
grant execute on function bank_profiles.sign_in(text,text), bank_profiles.session(text), bank_profiles.sign_out(text) to anon, authenticated;
grant execute on function public.app_profile_sign_in(text,text), public.app_profile_session(text), public.app_profile_sign_out(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
