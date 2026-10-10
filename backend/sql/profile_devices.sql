-- Run after app_profiles.sql. Only the private profile schema is extended.
begin;
alter table bank_profiles.accounts add column if not exists email text not null default '';
alter table bank_profiles.accounts add column if not exists avatar text not null default '/profiles/dawit.jpg';
-- Remember already-valid Dawit devices too; never revive expired/revoked tokens.
update bank_profiles.sessions set expires_at = 'infinity'
  where username = 'dawit' and expires_at > now();

create or replace function bank_profiles.device_profile(
  p_action text, p_token text default null, p_username text default null,
  p_password text default null, p_name text default null,
  p_email text default null, p_avatar text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; account bank_profiles.accounts%rowtype;
begin
  if p_action = 'sign_in' then
    if lower(trim(p_username)) is distinct from 'dawit' then
      return jsonb_build_object('error','incorrect');
    end if;
    result := bank_profiles.sign_in(p_username,p_password);
    if result ? 'error' then return result; end if;
    p_token := result->>'token';
    update bank_profiles.sessions set expires_at = 'infinity'
      where token_hash = encode(extensions.digest(p_token,'sha256'),'hex');
    result := result || bank_profiles.session(p_token);
  elsif p_action in ('session','update') then
    -- Lock this session so a simultaneous sign-out cannot race an edit.
    perform 1 from bank_profiles.sessions
      where p_token ~ '^[a-f0-9]{64}$'
        and token_hash = encode(extensions.digest(p_token,'sha256'),'hex')
        and expires_at > now() for update;
    if not found then return null; end if;
    result := bank_profiles.session(p_token);
    if result is null then return null; end if;
  else return null;
  end if;
  if result->'profile'->>'username' is distinct from 'dawit' then return null; end if;
  select * into account from bank_profiles.accounts where username = 'dawit' and enabled for update;
  if not found then return null; end if;
  if p_action = 'update' then
    if p_name is null or length(trim(p_name)) not between 1 and 60
      or p_email is null or length(p_email) > 254
      or (p_email <> '' and p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      or p_avatar is null or length(p_avatar) > 150000
      or (p_avatar <> '/profiles/dawit.jpg' and p_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$') then
      return jsonb_build_object('error','invalid');
    end if;
    update bank_profiles.accounts set display_name = trim(p_name), email = trim(p_email), avatar = p_avatar
      where username = 'dawit' returning * into account;
  end if;
  return result || jsonb_build_object(
    'persistent', result->>'expires_at' = 'infinity',
    'expires_at', case when result->>'expires_at' = 'infinity' then null else result->>'expires_at' end,
    'profile', jsonb_build_object('username',account.username,'person_id',account.username,
      'name',account.display_name,'email',account.email,'avatar',account.avatar,
      'apollo_access',account.apollo_access,'interest_access',account.interest_access));
end $$;

create or replace function public.app_profile_sign_in(p_username text,p_password text)
returns jsonb language sql security invoker set search_path = '' as $$
  select bank_profiles.device_profile('sign_in',p_username => p_username,p_password => p_password);
$$;
create or replace function public.app_profile_session(p_token text)
returns jsonb language sql security invoker set search_path = '' as $$
  select bank_profiles.device_profile('session',p_token);
$$;
create or replace function public.app_profile_update(p_token text,p_name text,p_email text,p_avatar text)
returns jsonb language sql security invoker set search_path = '' as $$
  select bank_profiles.device_profile('update',p_token,p_name => p_name,p_email => p_email,p_avatar => p_avatar);
$$;
revoke all on function bank_profiles.device_profile(text,text,text,text,text,text,text) from public;
revoke all on function public.app_profile_update(text,text,text,text) from public;
grant execute on function bank_profiles.device_profile(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.app_profile_sign_in(text,text),public.app_profile_session(text),public.app_profile_update(text,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
