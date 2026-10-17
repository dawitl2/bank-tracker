-- Production repair applied 2026-10-17. Keeps existing function permissions.
-- The optional profile editor upgrade remains separate (profile_devices.sql).
begin;
do $upgrade$
declare definition text;
begin
  select pg_get_functiondef('bank_profiles.sign_in(text,text)'::regprocedure) into definition;
  definition := replace(definition, $$now() + interval '8 hours'$$, $$'infinity'::timestamptz$$);
  definition := replace(definition, $$'token', session_token, 'expires_at', expiry$$,
    $$'token', session_token, 'persistent', true, 'expires_at', null$$);
  execute definition;
  select pg_get_functiondef('bank_profiles.session(text)'::regprocedure) into definition;
  definition := replace(definition, $$'expires_at', s.expires_at$$,
    $$'persistent', s.expires_at = 'infinity'::timestamptz, 'expires_at', case when s.expires_at = 'infinity'::timestamptz then null else s.expires_at end$$);
  execute definition;
end $upgrade$;
update bank_profiles.sessions set expires_at = 'infinity'
  where username = 'dawit' and expires_at > now();
notify pgrst, 'reload schema';
commit;
