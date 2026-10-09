# BOA SMS Companion Setup

This repository now has a separate native Android app in `android-boa-sms-companion/`.

The companion app listens for incoming SMS messages, processes only BOA senders, ignores OTP and promotional messages, extracts account values, and posts those values to the existing backend.

## Architecture

- Android app: requests `RECEIVE_SMS` and `READ_SMS`, receives SMS broadcasts, parses BOA messages locally, and sends extracted values.
- Backend: `POST /boa-sms/account-state` accepts latest-state updates from the phone using a shared bearer token.
- Backend: `POST /boa-sms/events` accepts Apollo transaction backfill rows without touching latest state.
- Database: `boa_sms_account_state` stores one row only with the latest known balance, withdrawal, and deposit values.
- Database: `boa_sms_events` stores deduped deposit/withdrawal SMS events for the last month only.
- Frontend: the flipped Apollo side of the balance card reads `GET /boa-sms/account-state`.
- Frontend: the Apollo Summary panel reads recent BOA SMS transactions from `GET /boa-sms/monthly-summary`.

The receipt transaction table stays separate. Unlocked Apollo can now offer to import **only the newest** BOA SMS event into that table; older unmatched SMS messages are never offered automatically.

## Version 1.1 upgrade

1. Run `backend/sql/boa_sms_transaction_import.sql` in the existing project's Supabase SQL editor. This adds SMS date/narrative/receipt fields, an optional unique `transactions.source_sms_hash`, and an atomic timestamp-aware balance merge. It does not rewrite existing transactions.
2. Ensure the backend has `SUPABASE_SERVICE_ROLE_KEY`, then deploy the updated backend and frontend from this repository.
3. Install the v1.1 APK with `adb install -r android-boa-sms-companion/app/build/outputs/apk/debug/app-debug.apk`. Existing connection settings and SMS permissions are retained.
4. Open the companion. It recovers useful BOA messages from the last 31 days. `Sync Apollo transactions` can also refresh receipt metadata on previously synced messages.

During rollout, the backend preserves the existing account-state and monthly-summary behavior if the additive SQL upgrade is pending. The new import stays unavailable until the required columns exist, and the phone keeps undelivered details queued for retry. The companion checks backend delivery version 2 before replaying older updates.

### Apollo import behavior

- Mobile/PWA: swipe to Apollo and unlock with the existing password. After two seconds, offer the newest SMS only when it is missing from the ledger.
- Desktop: unlock Apollo on the Balance dashboard to use the same prompt.
- No prompt on the primary card, Interest, People, Construction, or Transactions pages. Leaving Apollo closes it and cancels pending work.
- Choose a person (or Unassigned), then click **Add transaction**. The amount, date, reference, narrative, withdrawal/deposit direction and genuine receipt URL are saved automatically. The existing **More** action appears when a receipt URL is available.
- BOA receipt details can fill missing date/reference/narrative when its amount and reference agree with the SMS. Missing fields stay empty when neither SMS nor receipt supplies them; receipt account suffixes are never guessed.
- The server rechecks the latest SMS before saving, detects an existing reference/receipt/hash, and uses a unique SMS hash to prevent duplicate inserts across retries or devices.
- **Later** dismisses that SMS for the current visit; reopening the app can offer it again if still missing.

### Delivery reliability

Incoming SMS is written to a private, persistent phone outbox before the receiver returns. Android JobScheduler sends when a network is available, retries failures with exponential backoff, survives reboot, and periodically reconciles the inbox (nominally every 15 minutes, subject to Android battery scheduling). Opening the companion also schedules recovery. **Retry queued SMS** requests a retry immediately.

The outbox contains parsed fields and a hash, not the raw SMS body. An update is acknowledged only after both its account state and transaction event have been saved. Older retries cannot replace newer balance/deposit/withdrawal values. The launcher icon and in-app logo combine BOA's gold mark with an SMS badge.

### Validation commands

```powershell
$env:CI = 'true'
npm test -- --watchAll=false --runInBand
node --test (Get-ChildItem backend/*.test.js).FullName
npm run build
```

Android: `gradle assembleDebug testDebugUnitTest`. The dependency-free `DeliveryInstrumentation` runner additionally checks durable queuing, failed-send retention, successful retry and deduplication on an actual phone, using isolated test preferences and a disposable local API on port 5002 via `adb reverse`.

The SQL can be checked without touching live data:

```powershell
npm install --prefix .gradle-local/sql-verification --no-audit --no-fund @electric-sql/pglite
node backend/sql/verify-boa-sms-upgrade.cjs (Resolve-Path .gradle-local/sql-verification/node_modules/@electric-sql/pglite).Path
```

The verification uses an isolated in-memory PostgreSQL instance and never touches the live database.

## Supabase Setup

Run these SQL files in the Supabase SQL editor:

```sql
-- backend/sql/boa_sms_account_state.sql
-- backend/sql/boa_sms_events.sql
```

Open each file, paste its contents into Supabase, and run it once.

`boa_sms_events` is deduped by `message_hash`, stores only deposit/withdrawal amount rows, and the backend deletes rows older than one month when new SMS updates arrive.

## Backend Setup

Set this environment variable on the backend host:

```bash
BOA_SMS_API_TOKEN=boa123
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Keep the same value for the Android app setup screen. For the current simple setup, type `boa123`.

`BOA_SMS_API_TOKEN` authenticates the Android phone to your backend. `SUPABASE_SERVICE_ROLE_KEY` lets the backend update the single `boa_sms_account_state` row while keeping public database writes disabled.

Run locally:

```bash
cd backend
npm install
npm start
```

The phone must be able to reach the backend URL. For local testing, use your computer LAN IP, for example:

```text
http://192.168.1.50:5000
```

## Frontend Setup

The frontend automatically calls:

```text
GET /boa-sms/account-state
POST /boa-sms/events
GET /boa-sms/monthly-summary
```

If using a custom backend URL, set:

```bash
REACT_APP_API_URL=http://your-backend-host:5000
```

Then run:

```bash
npm install
npm start
```

## Android Build

Install Android Studio, then:

1. Open `android-boa-sms-companion/`.
2. Let Android Studio install the Android Gradle plugin and SDK 35 if prompted.
3. Build with `Build > Build Bundle(s) / APK(s) > Build APK(s)`.
4. The APK will be under `android-boa-sms-companion/app/build/outputs/apk/`.

Command-line build after Android Studio/SDK is installed:

```bash
cd android-boa-sms-companion
gradle assembleDebug
```

## Install On Phone

1. Copy the debug APK to the Android phone or install with `adb install`.
2. Open `BOA SMS Companion`.
3. Tap `Grant SMS permission`.
4. Enter the backend URL.
5. Enter the same `BOA_SMS_API_TOKEN` configured on the backend.
6. Tap `Save and test connection`.
7. Use `Test parser` with sample BOA text before relying on live SMS.
8. Tap `Sync Apollo transactions` once to backfill the Apollo recent transactions. This writes only to `boa_sms_events`.
9. Incoming SMS messages will update the latest values and summary automatically after that.

## SMS Parsing Rules

The app accepts only sender names that look like BOA, Bank of Abyssinia, or Abyssinia Bank.

It ignores messages containing OTP, one-time password, verification code, password reset, promotion, offer, discount, campaign, lottery, bonus, or advert language.

It updates only values directly found in the SMS:

- `current_balance`
- `latest_withdrawal_amount`
- `latest_deposit_amount`

It does not calculate balances from receipts or previous messages.

## Summary Behavior

The original card Month Summary still comes from the receipt transaction table.

When the card is flipped to Apollo, the Summary panel changes to recent BOA SMS transactions.

The summary shows:

- Debit and credit SMS messages from BOA only.
- Only messages from the last month.
- Amount and balance-after values from each SMS.

The Android app can backfill this by scanning the phone inbox with `Sync Apollo transactions`.

The parser requires a BOA-looking sender. A BOA-formatted message sent from a normal phone number or another sender is ignored.

## Important Notes

Android SMS permissions are sensitive. The Android app is meant for direct installation on your own phone. Publishing to Google Play may require additional SMS permission approval or a different approach.

The backend stores a message hash and sender for troubleshooting, but it does not store the raw SMS body.
