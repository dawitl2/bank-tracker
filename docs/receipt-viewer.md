# Instant Bank of Abyssinia receipt copies

The mobile **More**, desktop **View**, and person-detail **View** actions open an in-app receipt immediately for Bank of Abyssinia slip links. Other receipt hosts retain their existing external-link behavior. Modified clicks (Ctrl/Cmd/Shift) still open the bank website.

The viewer uses the bank's original CSS, system font stack, logo, leaf watermark, stamp, SWIFT image, table ordering, gold borders, and social footer. Files are served locally from `public/boa-receipt/`, so displaying the copy does not require the bank website to load. CSS is isolated in an iframe so bank styles cannot change the dashboard.

## Data and availability

Saved amount, date, reference, and narrative render first. The viewer then requests `GET /receipt-details?trx=<token>` from the Express backend. This route reads only the bank's `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=<token>` endpoint; it does not access or write Supabase. The bank request times out after four seconds; the frontend stops waiting after six seconds, including a cold backend start. Network failures, invalid references, malformed responses, or mismatched references leave the saved copy visible.

Successful bank responses add that transaction's account fields, charges, VAT, total, and payment type. The browser holds at most 100 successful receipts in memory for the current page session. No personal receipt data is stored in public assets, source files, localStorage, or URLs in this implementation.

Copies are labeled as Bank Tracker copies, including in PDF downloads. Missing details are omitted rather than invented. The QR opens the corrected original bank link; it deliberately does not recreate the bank's encrypted payment-verification QR. **Download PDF** produces a PDF locally; **Print / Save PDF** uses the browser print dialog. The PDF library loads only when downloading.

## Confirmed broken link

The supplied token `FT26082QM3HF413499` returns HTTP 200 with `Payer's Name: Invalid reference number`. The token has an extra final `9`. `FT26082QM3HF41349` returns the actual receipt for reference `FT26082QM3HF`.

`getBoaReceiptLink` corrects this one confirmed token. It does not truncate other tokens or infer account suffixes. This correction changes only the link used for viewing, not the saved database transaction.

## Deployment and checks

Deploy the updated React frontend on Vercel and the updated `backend/` service on Render through the existing GitHub integrations. There are no schema migrations or new environment variables. `REACT_APP_API_URL` continues to select the backend. If the frontend deploys first, it can already show saved copies; full bank enrichment becomes available when the backend is deployed.

Checks:

```sh
CI=true npm test -- --watchAll=false --runInBand
npm run build
node --test backend/boaReceipt.test.js
```

To verify in the browser, open the transactions table, click More/View for a BOA receipt, and confirm its saved fields appear immediately. Confirm both supplied links load full bank fields with a running updated backend. Disable or block the `/receipt-details` request and confirm the copy stays usable. Check mobile layout, Escape/Close, the original bank link, QR destination, and PDF download. Do not commit real transaction fixtures or exported PDFs.

Asset source (retrieved 2026-10-08): `https://cs.bankofabyssinia.com/slip/`, bundle `index-C2eKgekR.css`, images `Logo-dC0ZsAUl.png`, `BOALeaf2-Cm6qtFka.png`, `Boastamp-DF_7dWa9.png`, `swift-7yBLt-L-.png`. The bank currently uses system sans-serif fonts, not a downloadable font. If the bank redesigns its receipts, update the local assets and template together.
