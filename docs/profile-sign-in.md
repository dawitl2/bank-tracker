# Dawit profile sign-in

Apply `backend/sql/app_profiles.sql` in the SQL Editor for project
`ywplzexakisliebyjtyf` before using profile sign-in. The script adds a private
`bank_profiles` schema with accounts and sessions, plus three public RPC wrappers.
It does not modify existing ledger, people, construction tables, data or policies.
Re-running the script preserves an existing profile and its password.

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
the actual project. A local synthetic API validates the UI contract only.
