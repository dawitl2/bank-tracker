# AI Project Context And Handoff

This file is intentionally detailed. It is meant for a future AI or developer who needs to understand the full project quickly, including current architecture, file locations, online services, database tables, defaults, and known sensitive values.

## High-Level Purpose

This project is a Bank of Abyssinia tracking system.

There are two connected parts:

1. The main React web app tracks receipt-based transactions and analytics.
2. A separate Android companion app reads BOA SMS messages and sends only the latest account state to the backend.

The BOA SMS latest-state integration is intentionally simple:

- It stores the latest known current balance.
- It stores the latest known withdrawal amount.
- It stores the latest known deposit amount.
- It does not store SMS transaction history.
- It does not create transaction tables.
- It does not calculate balances from receipts.

There is also a small BOA SMS event table for summary totals only. It stores deduped deposit/withdrawal SMS events for the last three months and feeds the Month Summary money-in/money-out view.

The Apollo side of the balance card must use the BOA SMS account state, not receipt-processing calculations.

## Online Services

### Backend

Render backend:

```text
https://bank-backend-anhp.onrender.com
```

Known backend health route:

```text
GET https://bank-backend-anhp.onrender.com/
```

Known BOA SMS state route:

```text
GET https://bank-backend-anhp.onrender.com/boa-sms/account-state
POST https://bank-backend-anhp.onrender.com/boa-sms/account-state
GET https://bank-backend-anhp.onrender.com/boa-sms/monthly-summary
```

Render log from current deployment showed:

```text
Running 'node server.js'
Backend running on port 10000
Available at your primary URL https://bank-backend-anhp.onrender.com
```

### Frontend

The frontend is deployed on Vercel, but the exact Vercel URL is not stored in this repository context.

The React app uses:

```text
REACT_APP_API_URL
```

If that variable is missing, the app falls back to:

```text
https://bank-backend-anhp.onrender.com
```

### Database

Supabase URL:

```text
https://ywplzexakisliebyjtyf.supabase.co
```

Supabase publishable key currently present in source:

```text
sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX
```

Service role key:

```text
Not known from local files. It should be configured in Render as SUPABASE_SERVICE_ROLE_KEY if writes require privileged access.
```

The user reported that `boa_sms_account_state` exists in Supabase and is currently unrestricted.

## Sensitive Or Important Defaults

These values exist in code or were used during setup. Treat them as sensitive even if the current project is personal/dev.

```text
Frontend login password: dawit123
Interest unlock password: pass
BOA SMS API token fallback: boa123
Android default backend URL: https://bank-backend-anhp.onrender.com
Android package id: com.banktracker.boasms
```

The backend and Android app both currently know the BOA SMS token fallback:

```text
boa123
```

The Android app asks for this token in its settings screen. For the current setup, typing `boa123` is enough unless the Render environment overrides `BOA_SMS_API_TOKEN`.

## Root Folder Map

```text
README.md
  Short public-facing project overview.

AI_PROJECT_CONTEXT.md
  This detailed handoff file.

package.json
package-lock.json
  React frontend dependency and script definitions.

src/
  Main React frontend source.

public/
  CRA public assets.

backend/
  Express backend, Puppeteer receipt scraping, Supabase API writes, BOA SMS endpoints.

android-boa-sms-companion/
  Native Android companion app that reads/parses SMS and posts latest values.

docs/
  Human setup docs, especially BOA SMS companion setup.

build/
  Generated React production build output.

node_modules/
  Installed frontend dependencies.

.gradle-local/
  Local Gradle runtime used to build the Android app.

.gitignore
  Ignore rules. Do not use git operations unless the user explicitly asks.
```

## Frontend Code Map

### `src/App.js`

Main React app shell.

Important constants:

```text
BASE_BALANCE = 1209518
VERSION = "1.3.3.25"
PASSWORD = "dawit123"
API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com"
BANK_RECEIPT_URL = "https://cs.bankofabyssinia.com/slip/"
```

Responsibilities:

- Password login and local session.
- Transaction fetching and mutation.
- Receipt link, QR, and OCR intake.
- Transaction modal.
- Supabase REST fallback for update/delete.
- BOA SMS state fetching.
- Passes BOA SMS state into the balance view.

BOA SMS frontend flow:

- State variables include `boaSmsState` and `boaSmsLoading`.
- `fetchBoaSmsState()` calls:

```text
GET ${API_URL}/boa-sms/account-state
```

- When the active view is `balance`, the app polls BOA SMS state every 15 seconds.
- `Balance` receives:

```text
boaSmsState
boaSmsLoading
onRefreshBoaSmsState
```

### `src/Balance.js`

Balance and analytics UI.

Receipt-based analytics still use `transactions`.

Apollo flipped card uses BOA SMS state:

```text
boaSmsState.current_balance
boaSmsState.latest_withdrawal_amount
boaSmsState.latest_deposit_amount
```

Important behavior:

- On flip to Apollo side, it calls `onRefreshBoaSmsState`.
- If the backend returns null values, the UI displays `0.0`.
- While loading or waiting for the BOA SMS state, money values use the `money-updating` animation class.
- The unflipped side still uses receipt-derived calculations.

### `src/App.css`

Main frontend styling.

BOA SMS animation exists around:

```text
.balance-value-wrap h1.money-updating
@keyframes moneyUpdate
```

The animation is applied to the money numbers themselves, not to the center of the card.

## Backend Code Map

### `backend/server.js`

Express server.

Important constants:

```text
PORT = process.env.PORT || 5000
BASE_URL = "https://bank-backend-anhp.onrender.com"
BOA_SMS_STATE_ID = 1
BOA_SMS_TOKEN = process.env.BOA_SMS_API_TOKEN || "boa123"
```

Responsibilities:

- Health route.
- Receipt scraping with Puppeteer/Chromium.
- Transaction CRUD through Supabase.
- BOA SMS account-state read/write.
- Keep-alive ping.

Keep-alive behavior:

- Pings the Render backend every 5 minutes.
- Runs all day.
- It no longer stops at midnight.

Important routes:

```text
GET /
POST /scrape-receipt
GET /transactions
POST /transactions
PATCH /transactions/:id
DELETE /transactions/:id
GET /boa-sms/account-state
POST /boa-sms/account-state
```

`POST /boa-sms/account-state`:

- Requires:

```text
Authorization: Bearer boa123
```

- Accepts only latest state values.
- Updates only values that are present in the payload.
- Stores timestamps for whichever values changed.
- Does not create a transaction row.

Expected request body:

```json
{
  "current_balance": 214017.87,
  "latest_withdrawal_amount": null,
  "latest_deposit_amount": 5,
  "sms_received_at": "2026-06-13T10:55:00.000Z",
  "sender": "BOA",
  "message_hash": "some-hash"
}
```

### `backend/supabaseClient.js`

Creates the Supabase client.

Known fallback behavior:

```text
SUPABASE_URL = process.env.SUPABASE_URL || known project URL
SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || known publishable key
```

For production writes, Render should preferably use `SUPABASE_SERVICE_ROLE_KEY`.

### `backend/sql/boa_sms_account_state.sql`

SQL setup file for the BOA SMS state table.

It creates one row only, with `id = 1`.

## Android Code Map

Android project folder:

```text
android-boa-sms-companion/
```

APK path after debug build:

```text
android-boa-sms-companion/app/build/outputs/apk/debug/app-debug.apk
```

Installed device seen during verification:

```text
R5CR317WWGK
model: SM_G986B
```

### Android Build Files

`android-boa-sms-companion/app/build.gradle`:

```text
namespace: com.banktracker.boasms
compileSdk: 35
buildToolsVersion: 37.0.0
minSdk: 26
targetSdk: 35
versionName: 1.0.0
Java: 17
```

`android-boa-sms-companion/local.properties`:

```text
sdk.dir=C:\Users\enkud\AppData\Local\Android\Sdk
```

This file is machine-local and should not be considered portable.

### Android Manifest

Permissions:

```text
INTERNET
RECEIVE_SMS
READ_SMS
```

Receiver:

```text
SmsReceiver
android.provider.Telephony.SMS_RECEIVED
android.permission.BROADCAST_SMS
```

### `MainActivity.java`

Main phone UI.

Responsibilities:

- Requests SMS permissions.
- Lets the user edit backend URL and token.
- Saves settings.
- Tests backend connection.
- Shows connection/send status.
- Shows latest parsed BOA SMS from the phone.
- Refreshes latest useful BOA SMS from the inbox.
- Sends latest parsed BOA SMS to backend.
- Syncs useful BOA deposit/withdrawal SMS from the last three months for summary backfill.
- Provides parser test UI.

It searches recent inbox messages, parses only useful BOA messages, and ignores OTP/promotional/unrelated SMS.

### `SmsReceiver.java`

Runs when a new SMS arrives.

Flow:

1. Receive incoming SMS.
2. Parse it with `BoaSmsParser`.
3. Ignore if it is not a meaningful BOA account SMS.
4. POST latest values to backend.
5. Store last extracted status locally.

### `BoaSmsParser.java`

Core SMS parsing logic.

Recognized exact BOA patterns include:

```text
debited with ETB X
credited with ETB X
Available Balance: ETB Y
```

It also accepts sender/body clues:

```text
BOA
Bank of Abyssinia
bankofabyssinia.com
cs.bankofabyssinia.com
```

It ignores:

```text
OTP
one-time password
verification codes
ads
promotions
unrelated messages
```

### `ApiClient.java`

Backend HTTP client.

Routes used:

```text
GET /boa-sms/account-state
POST /boa-sms/account-state
GET /boa-sms/monthly-summary
```

POST uses bearer auth with the stored token.

### `SettingsStore.java`

Stores Android local settings.

Defaults:

```text
API URL: https://bank-backend-anhp.onrender.com
API token: boa123
```

Also stores last status and last extracted values for reassurance in the phone UI.

### `SmsTools.java`

Display helpers for parsed SMS values.

## Database Tables

### `public.boa_sms_account_state`

This table exists in Supabase.

Actual schema shared by user:

```sql
create table public.boa_sms_account_state (
  id integer not null default 1,
  current_balance numeric(14, 2) null,
  latest_withdrawal_amount numeric(14, 2) null,
  latest_deposit_amount numeric(14, 2) null,
  balance_updated_at timestamp with time zone null,
  withdrawal_updated_at timestamp with time zone null,
  deposit_updated_at timestamp with time zone null,
  last_sms_at timestamp with time zone null,
  last_sender text null,
  last_message_hash text null,
  updated_at timestamp with time zone not null default now(),
  constraint boa_sms_account_state_pkey primary key (id),
  constraint boa_sms_account_state_id_check check ((id = 1))
);
```

Meaning:

- There should only be one row.
- The row id must be `1`.
- It stores latest account state only.
- It is not a transaction history table.

Current known values after correction from real BOA SMS samples:

```text
current_balance: 214017.87
latest_withdrawal_amount: 112
latest_deposit_amount: 5
last_message_hash: corrected-from-user-samples
```

### `public.boa_sms_events`

This table stores deduped BOA SMS deposit/withdrawal events for the three-month summary.

SQL setup file:

```text
backend/sql/boa_sms_events.sql
```

Schema:

```sql
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
```

Purpose:

- Monthly money in/out summary from BOA SMS.
- No raw SMS body is stored.
- The backend prunes rows older than three months when new SMS updates arrive.

### `public.transactions`

This is the original receipt transaction table. Exact DDL is not in the repository context, but code expects transaction objects with fields like:

```text
id
created_at
amount
date
reference
narrative
receipt_url
is_withdraw
person
```

Purpose:

- Receipt-based transaction tracking.
- Analytics.
- Original balance/spending tables.

The BOA SMS integration should not write to this table.

## BOA SMS Data Contract

Backend response from `GET /boa-sms/account-state`:

```json
{
  "id": 1,
  "current_balance": 214017.87,
  "latest_withdrawal_amount": 112,
  "latest_deposit_amount": 5,
  "balance_updated_at": "2026-06-13T...",
  "withdrawal_updated_at": "2026-06-13T...",
  "deposit_updated_at": "2026-06-13T...",
  "last_sms_at": "2026-06-13T...",
  "last_sender": "BOA",
  "last_message_hash": "..."
}
```

Android POST body:

```json
{
  "current_balance": 214017.87,
  "latest_withdrawal_amount": null,
  "latest_deposit_amount": 5,
  "sms_received_at": "2026-06-13T10:55:00.000Z",
  "sender": "BOA",
  "message_hash": "..."
}
```

Important update rules:

- Credit SMS should update `latest_deposit_amount`.
- Debit SMS should update `latest_withdrawal_amount`.
- Any useful BOA account SMS with an available balance should update `current_balance`.
- Null fields should not erase previous latest values unless the backend is intentionally changed to do that.

## Known BOA SMS Samples

Debit sample:

```text
Dear Dawit, your account 1*49 was debited with ETB 112.00. Available Balance: ETB 213,907.87.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26164P6S2X41349
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.
```

Expected parse:

```text
current_balance: 213907.87
latest_withdrawal_amount: 112.00
latest_deposit_amount: null
```

Credit sample:

```text
Dear Dawit, your account 1*49 was credited with ETB 100.00 from Telebirr by Reference DFD5UBO81L. Available Balance: ETB 214,007.87.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26164NVFW110104
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.
```

Expected parse:

```text
current_balance: 214007.87
latest_withdrawal_amount: null
latest_deposit_amount: 100.00
```

Latest credit sample:

```text
Dear Dawit, your account 1*49 was credited with ETB 5.00 from Telebirr by Reference DFD7UBZVUP. Available Balance: ETB 214,017.87.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26164Y68KB10104
Link your Fayda: https://cs.bankofabyssinia.com/fayda_connect
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.
```

Expected parse:

```text
current_balance: 214017.87
latest_withdrawal_amount: null
latest_deposit_amount: 5.00
```

## Local Build And Verification Commands

Frontend build:

```powershell
npm run build
```

Backend run:

```powershell
cd backend
node server.js
```

Android build:

```powershell
cd android-boa-sms-companion
..\.gradle-local\gradle-8.10.2\bin\gradle.bat assembleDebug --stacktrace
```

Install APK to connected phone:

```powershell
& "C:\Users\enkud\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r "C:\Users\enkud\Desktop\react-bank-ui\android-boa-sms-companion\app\build\outputs\apk\debug\app-debug.apk"
```

Check phone connection:

```powershell
& "C:\Users\enkud\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices -l
```

Known connected phone from prior verification:

```text
R5CR317WWGK device product:y2sxxx model:SM_G986B device:y2s
```

## Deployment Notes

### Render Backend

The Render service appears to deploy from GitHub repository:

```text
https://github.com/dawitl2/bank-tracker
```

Recent Render log checked out commit:

```text
b05319ff200b5b29d00fff188a9da0c0384daa4e
```

Render build command shown:

```text
npm install
```

Render start command shown:

```text
node server.js
```

The service likely uses the `backend` folder as its root, because `server.js` runs directly.

Important Render environment variables:

```text
PORT
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_KEY
BOA_SMS_API_TOKEN
```

### Vercel Frontend

Important Vercel environment variable:

```text
REACT_APP_API_URL=https://bank-backend-anhp.onrender.com
```

If omitted, the source fallback currently points to the Render backend anyway.

### Supabase

The BOA SMS table should contain a row with `id = 1`.

The table can be created from:

```text
backend/sql/boa_sms_account_state.sql
```

For safest production behavior:

- Backend should use service role key.
- Frontend should only read through backend for BOA SMS values.
- Android should only know the backend URL and BOA SMS API token.

## Current End-To-End Flow

Incoming SMS flow:

```text
BOA SMS arrives on phone
Android SmsReceiver receives it
BoaSmsParser checks sender/body and ignores OTP/promotional/unrelated messages
Parser extracts balance/debit/credit values
ApiClient POSTs latest values to Render backend
Backend validates bearer token
Backend upserts row id 1 in Supabase boa_sms_account_state
React frontend fetches GET /boa-sms/account-state
Balance Apollo side displays current balance, latest deposit, latest withdrawal
```

Manual latest-SMS flow:

```text
Open Android app
Grant SMS permissions
Set backend URL
Set token
Save
Tap Refresh latest BOA SMS
Confirm parsed values
Tap Send latest BOA SMS now
Open web app balance card
Flip to Apollo side
Apollo values refresh from backend
```

## Known Completed Verification

Completed previously:

- Android debug build succeeded.
- APK installed successfully by `adb install -r`.
- Phone was detected by `adb devices -l`.
- Android parser test worked for the user's BOA messages.
- React `npm run build` succeeded after BOA SMS frontend changes.
- Backend syntax validation succeeded.
- Remote Render `GET /boa-sms/account-state` responded.
- Remote Render `POST /boa-sms/account-state` with bearer token worked.
- Supabase row was corrected from bad `7/1/1` values to the real sample values.

## Known Caveats

- The exact Vercel URL is not captured in this repo context.
- The Supabase service role key is not known locally.
- Some sensitive values are hardcoded fallbacks for convenience.
- Android SMS permissions must be granted manually on the phone.
- Android may be blocked by phone install security unless installed through Android Studio or `adb`.
- The phone app does not send raw SMS bodies to backend, only parsed values plus sender/hash/time.
- BOA SMS parser depends on message format. If Bank of Abyssinia changes wording, parser may need updates.
- The app stores latest state only. If a message is missed and the user does not refresh/send latest SMS from the Android app, the backend will keep the previous latest state.

## Safe Future Change Rules

- Do not make BOA SMS create transaction rows unless explicitly requested.
- Do not calculate BOA SMS balance from receipts.
- Keep Apollo balance values sourced from `/boa-sms/account-state`.
- Keep receipt transaction analytics separate from BOA SMS account state.
- If fixing parsing, always test with both `credited with ETB` and `debited with ETB`.
- If adding security, update Android setup instructions at the same time.
- If changing backend URL or token, update Android defaults and deployment envs together.
