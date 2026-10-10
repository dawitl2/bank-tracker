-- Run after app_profiles.sql as the project owner. All verification writes
-- affect only the new profile tables and are rolled back, including sessions.
begin;
update bank_profiles.accounts set failed_attempts = 0, locked_until = null where username = 'dawit';

-- 1. Credentials and the five-attempt lockout.
do $$
declare result jsonb; attempt integer;
begin
  result := public.app_profile_sign_in('not-a-profile', 'pass');
  if result->>'error' is distinct from 'incorrect' then raise exception 'Unknown username accepted'; end if;
  for attempt in 1..5 loop
    result := public.app_profile_sign_in('Dawit', 'incorrect-test-password');
    if result->>'error' is distinct from (case when attempt = 5 then 'locked' else 'incorrect' end) then
      raise exception 'Incorrect lockout behavior at attempt %', attempt;
    end if;
  end loop;
  if public.app_profile_sign_in('Dawit', 'pass')->>'error' is distinct from 'locked' then
    raise exception 'Locked profile accepted';
  end if;
end $$;
select 'PASS: credentials and lockout' as result;

-- 2. Real password hashing, case-insensitive sign-in, restore, expiry and revoke.
update bank_profiles.accounts set failed_attempts = 0, locked_until = null where username = 'dawit';
do $$
declare login jsonb; other_login jsonb; restored jsonb; session_token text;
begin
  login := public.app_profile_sign_in(' Dawit ', 'pass');
  session_token := login->>'token';
  if session_token is null or session_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid session token'; end if;
  restored := public.app_profile_session(session_token);
  if restored->'profile'->>'username' is distinct from 'dawit'
    or restored->'profile'->>'apollo_access' is distinct from 'true'
    or restored->'profile'->>'interest_access' is distinct from 'true' then
    raise exception 'Dawit permissions did not restore';
  end if;
  if exists(select 1 from bank_profiles.sessions where token_hash = session_token)
    or exists(select 1 from bank_profiles.accounts where password_hash = 'pass') then
    raise exception 'Plain-text credentials stored';
  end if;
  other_login := public.app_profile_sign_in('Dawit', 'pass');
  perform public.app_profile_sign_out(session_token);
  if public.app_profile_session(session_token) is not null then raise exception 'Revoked token accepted'; end if;
  session_token := other_login->>'token';
  if public.app_profile_session(session_token) is null then raise exception 'Other session revoked'; end if;
  update bank_profiles.sessions set expires_at = now() - interval '1 second'
    where token_hash = encode(extensions.digest(session_token, 'sha256'), 'hex');
  if public.app_profile_session(session_token) is not null then raise exception 'Expired token accepted'; end if;
  if public.app_profile_session('invalid-token') is not null then raise exception 'Invalid token accepted'; end if;
end $$;
select 'PASS: hashing, permissions, session restore, expiry and revocation' as result;

-- 3. API roles may call only the intended RPCs, and cannot read profile tables.
do $$
declare api_role text;
begin
  foreach api_role in array array['anon','authenticated'] loop
    if has_table_privilege(api_role, 'bank_profiles.accounts', 'select')
      or has_table_privilege(api_role, 'bank_profiles.sessions', 'select') then
      raise exception 'Profile tables exposed to %', api_role;
    end if;
    if not has_function_privilege(api_role, 'public.app_profile_sign_in(text,text)', 'execute')
      or not has_function_privilege(api_role, 'public.app_profile_session(text)', 'execute')
      or not has_function_privilege(api_role, 'public.app_profile_sign_out(text)', 'execute') then
      raise exception 'Missing RPC permissions for %', api_role;
    end if;
  end loop;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'bank_profiles' and c.relkind = 'r' and not c.relrowsecurity) then
    raise exception 'Profile RLS disabled';
  end if;
end $$;
set local role anon;
do $$
begin
  if public.app_profile_sign_in('Dawit', 'pass')->'profile'->>'username' is distinct from 'dawit' then
    raise exception 'Anonymous RPC caller cannot sign in';
  end if;
  begin
    perform 1 from bank_profiles.accounts;
    raise exception 'Anonymous caller can read profiles';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS: API roles, private tables and RLS' as result;
rollback;
