# Bank Tracker

A custom React + Node + Supabase bank tracker for managing Bank of Abyssinia receipt data and a separate BOA SMS balance companion.

The web app still tracks receipt-based transactions and analytics, while the Android companion app supplies the Apollo balance card with the latest BOA SMS account values.

## What Is Included

- React frontend in `src/`
- Express backend in `backend/`
- Supabase database integration
- Android BOA SMS companion app in `android-boa-sms-companion/`
- Receipt scraping, QR scanning, and OCR receipt intake
- Apollo balance card integration for BOA SMS values

## Main Features

- Track receipt-based transactions by person/group.
- Scrape BOA receipt links through the backend.
- Add receipt links manually, through QR scan, or through image OCR.
- View analytics, balance summaries, and spending breakdowns.
- Read latest BOA SMS account state from the companion app:
  - Current balance
  - Latest withdrawal amount
  - Latest deposit amount

The BOA SMS integration stores only the latest known values. It does not create transaction history and does not calculate balance from receipts.

## Project Structure

```text
backend/                    Express API, receipt scraping, Supabase writes
src/                        React frontend
public/                     Static frontend assets
android-boa-sms-companion/  Native Android SMS companion app
docs/                       Setup and feature documentation
```

## Local Web Setup

Install dependencies:

```bash
npm install
```

Run the React app:

```bash
npm start
```

Build the React app:

```bash
npm run build
```

## Backend Setup

From `backend/`:

```bash
npm install
node server.js
```

Important environment variables:

- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_KEY`
- `BOA_SMS_API_TOKEN`

## Android Companion

The Android app lives in `android-boa-sms-companion/`. It requests SMS permissions, parses incoming Bank of Abyssinia SMS messages, ignores OTP/promotional/unrelated messages, and sends only the latest account state to the backend.

Detailed Android setup is in [docs/boa-sms-companion.md](docs/boa-sms-companion.md).

## Deployment

- Frontend: Vercel
- Backend: Render
- Database: Supabase
- Android: debug APK installed manually with Android Studio or `adb`

## Detailed Project Handoff

For a complete technical map of the project, including sensitive defaults, online services, database structures, file responsibilities, endpoints, and current BOA SMS behavior, see [AI_PROJECT_CONTEXT.md](AI_PROJECT_CONTEXT.md).
