# Dawit profile sign-in

Production persistence activated on 2026-10-17 through the authenticated
Supabase SQL dashboard, after confirming the live sign-in function still issued
eight-hour sessions. The exact repair is recorded in
`backend/sql/persistent_sessions_activation.sql`. It updates sign-in and restore
responses and upgrades still-valid sessions; expired/revoked tokens stay invalid.
The optional profile editor upgrade remains separate.

Live public API verification passed: two independent non-expiring device logins,
session restoration, revocation of one device without affecting the other, and
rejection of an unknown token. Both test sessions were revoked afterward.
All eight `ProfileSession.test.js` tests passed. The deployed frontend already
supports the persistent response and device-local storage, so no frontend
deployment was needed for this repair. An already-expired login needs one fresh
sign-in. Earlier pending-activation notes below describe the historical state.

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

For version 1.3.5.0, also apply `backend/sql/profile_devices.sql`. It adds email
and avatar fields only to the private profile table, preserves the password and
ledger/people records, and makes valid Dawit sessions persist until sign-out.
Expired or revoked sessions are not revived. Apply the original setup first on
a new project; apply only this upgrade on an already-configured project.

The device stores an opaque token in local storage; it never stores the profile
password or permission flags. Existing session-storage tokens are migrated.
The database stores bcrypt password hashes and SHA-256 session-token hashes.
Sessions are verified on startup, focus and reconnect. A temporary network/server
failure keeps an already-verified account signed in. On a cold start, protected
views wait for successful verification while the saved token is kept for retry.
Only a successful server response rejecting the session clears invalid access.
Sign-out clears the local token, revokes the server session, resets guest unlocks,
and signs out other tabs on the same device. Failed server revocation is queued
for retry on reconnect or the next app start.

Settings opens `/settings/accounts`. New devices show No account. Add account
opens a native overlay with blank username/password fields and accepts only the
existing Dawit account. The Accounts page offers a circular photo, read-only
username, editable display name and optional contact email (not a login email).
Editing and save/sign-out confirmation use native modal dialogs. The default
photo is `public/profiles/dawit.jpg`; replacement photos are resized to a 320px
JPEG and saved in the private profile record. No public storage bucket is needed.
The Dawit person ID remains `dawit`; People uses the same photo/display name while
signed in, without renaming transaction IDs or changing the people table.

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

The version 1.3.4.3 live phone layout also passes Dawit sign-in, session restoration after a
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

Version 1.3.5.0: three focused local PostgreSQL checks cover the Dawit-only login,
private account access, persistent sessions, validated profile updates, repeated
upgrade, per-device revocation and disabled-account rejection. Production
activation of the device/profile upgrade remains pending its SQL application.
The built phone UI passes blank sign-in fields and account rejection, photo/email
editing with confirmation, matching display details in People, closing/reopening
without a password, cancelled sign-out, and confirmed sign-out across two tabs
against the local PostgreSQL RPCs. The production build passes.

## Persistent-session regression checks

The base setup now also creates non-expiring sessions, so reapplying it cannot
restore the old eight-hour limit. Existing installations still need
`backend/sql/profile_devices.sql` applied to upgrade valid saved devices and
activate the profile editor. Already-expired tokens require one fresh sign-in.
Clearing browser site data or using another browser/profile requires signing in
again; passwords are never saved on the device.

Run `npm test -- --watchAll=false --runInBand src/ProfileSession.test.js` for
device restart, long-term persistence, temporary connection failures, logout,
queued offline revocation and cross-tab logout races. Run
`node backend/sql/verify-profile-devices.cjs <path-to-pglite-package>` with
`@electric-sql/pglite` 0.5.10 for isolated PostgreSQL coverage of the base setup,
legacy-device upgrade, repeat setup, revoked/expired token rejection and logout.

Live API inspection on 2026-10-14 confirmed that production still issues
eight-hour sessions. Applying the upgrade is required before permanent login
works there; a frontend Git push alone does not change the database functions.
The Supabase connector returned no accessible projects and denied the project
query, so production activation could not be completed in that session.

Validation: all eight frontend session tests and the isolated PostgreSQL checks
pass. The full frontend suite has 70 passing and 12 failing tests; the same 12
failures occur on the unchanged baseline in ApolloTransactionPrompt,
BoaReceiptViewer and boaSmsImport tests.

On 2026-10-16, all eight session tests and the isolated PostgreSQL device
checks passed again. The Accounts sign-out action is now a full-width red
button below the account details. The Supabase connector still returned no
accessible projects, so applying `backend/sql/profile_devices.sql` to production
remains required to activate permanent device sessions there.
