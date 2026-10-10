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

Production activation was verified on 2026-10-10 against project
`ywplzexakisliebyjtyf` and the deployed app at
`https://bank-tracker-three.vercel.app` (version 1.3.4.3, frontend commit
`c4d594fbccea8461de8bc84a974a19ae5227ca40`). The live app API rejects incorrect
credentials, returns Dawit's permissions, validates the session, and revokes it
on sign-out. A revoked token cannot restore access.

The live phone layout also passes Dawit sign-in, session restoration after a
reload, and access to Apollo and Interest without another password. Sign-out
restores the Apollo password prompt and hides protected Interest values.
Verification created and revoked only its own profile sessions; it did not edit
ledger, people or construction records.

The setup and three database checks also pass in isolated PostgreSQL (PGlite
with pgcrypto), including repeat setup and preservation of synthetic legacy
data/schema. The built frontend passes HTTP 204 sign-out against those local
PostgreSQL functions running as the `anon` role. Private-table and API-role
checks were verified locally; production management-tool access was unavailable
for independently repeating those checks.
