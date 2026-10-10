# Dawit profile sign-in

Apply `backend/sql/app_profiles.sql` in the SQL Editor for project
`ywplzexakisliebyjtyf` before using profile sign-in. The script adds a private
`bank_profiles` schema with accounts and sessions, plus three public RPC wrappers.
It does not modify existing ledger, people, construction tables, data or policies.
Re-running the script preserves an existing profile and its password.
The script expects the usual Supabase `extensions` schema for `pgcrypto` and
stops without applying changes if the extension is already elsewhere.

After setup, run `backend/sql/verify_app_profiles.sql` as the project owner.
It checks credentials/lockout, sessions/expiry/revocation, and API-role privacy.
All verification writes to the new profile tables are rolled back. No existing
financial or people records are involved. PostgREST returns HTTP 204 on sign-out;
the frontend accepts that successful empty response.

The initial username is `Dawit` (case insensitive). Use the current Apollo
password. Only Dawit receives Apollo and Interest access. Guest unlock prompts
continue to use the existing passwords. This addition does not replace the
existing application's data-access policies.

Sessions last eight hours and survive a reload in the same tab/app session.
The device stores an opaque token in session storage; it never stores the profile
password or permission flags. The database stores bcrypt password hashes and
SHA-256 session-token hashes. Sessions are verified on startup and focus; an
unavailable verification removes profile access until it succeeds. Sign-out
clears the local token, revokes the server session and resets guest unlocks.

Focused verification:

1. Incorrect passwords and usernames other than Dawit cannot sign in.
2. Dawit sign-in opens Apollo and Interest without further password prompts;
   reloading verifies and restores the same session.
3. Sign-out restores guest password prompts and the old token no longer works.
4. On narrow screens the filter sits at the right and the plus is nearly level
   with the bottom tabs; the profile labels follow the device's language.

The production database setup must be applied and these flows checked against
the actual project. The setup and three database checks pass in isolated
PostgreSQL (PGlite with pgcrypto), including repeat setup and preservation of
synthetic legacy data/schema. This verifies the SQL and role behavior locally;
production activation and live-project verification remain pending.
The built frontend also passes sign-in, Apollo/Interest access and HTTP 204
sign-out against those local PostgreSQL functions running as the `anon` role.
