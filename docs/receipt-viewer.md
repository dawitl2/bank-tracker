# Bank receipt tabs

Mobile **More**, desktop **View**, and person-detail **View** open a normal new tab at the app's /slip/?trx=<token> URL. Native modified clicks and middle-clicks work too. Other receipt hosts keep their existing external links. The tab title is **Receipt**. There is no app toolbar, opening/closed message, corrected-link label, or availability banner.

## Actual receipt first

The React receipt route loads the backend's GET /receipt-page?trx=<token> in a full-viewport iframe. The backend relays the bank's actual HTML shell and original assets from its fixed /slip/assets/ directory. It injects a small bridge before the original module to route its bank API call through GET /receipt-details. The bank itself constructs the layout, table, encrypted verification QR, social footer, and Download PDF action. Its CSS and viewport rules remain unchanged, including on phones.

This relay is necessary because the bank sends X-Frame-Options: DENY and its API cannot be requested directly from the app origin. Asset names and receipt tokens are validated; callers cannot select an arbitrary host or path. Public shell HTML is cached in server memory for five minutes. Hashed bank assets have browser cache headers. Receipt responses are always no-store, and personal bank data is not cached by this implementation.

The bank's logo/QR shell may appear before all transaction fields arrive. Only after the bank has rendered the requested transaction-reference row does the bridge declare the receipt ready. Explicit failures switch to the saved template immediately; a stalled page switches after 30 seconds, allowing for a cold backend start and delayed bank data. Individual upstream requests have a 12-second timeout.

## Quiet fallback

Clicking a BOA link hands off only its saved amount, date, reference, and narrative through a ten-minute localStorage entry. The receipt tab consumes that entry into sessionStorage for reloads; expired entries are rejected and cleaned up. Storage restrictions never block the actual bank page. No saved details are put in URLs. If the actual page fails, only those known fields appear in the local bank-style template. Missing account fields, fees, or totals are omitted. Shared links without saved fields can show the generic template on failure.

The fallback QR opens the original bank link; it does not claim to verify a payment. Its Download PDF action works locally. The original bank receipt keeps its original encrypted verification QR and original PDF generation.

The confirmed extra-digit token FT26082QM3HF413499 is still corrected to FT26082QM3HF41349 for viewing only. Other tokens and database records are unchanged.

## Installed-app startup

The HTML document contains the existing logoTop.png on the existing white background, with a subtle breathing scale and a masked light sweep. Inline CSS starts the animation before the React bundle downloads. It appears only in installed/standalone mode, supports iOS navigator.standalone and prefers-reduced-motion, and fades out when React commits the requested page. There is no artificial minimum launch delay. Receipt tabs skip it.

The OS-generated PWA splash is a static image controlled by the browser/OS; web code cannot animate that initial native frame. The custom animation starts when the HTML startup page can paint. See https://web.dev/learn/pwa/web-app-manifest.

## Verification

- CI=true npm test -- --watchAll=false --runInBand
- node --test backend/boaReceipt.test.js backend/receiptPage.test.js
- npm run build
- Check the app receipt route with the receipt-only local backend, including the real bank page on phone/desktop widths, an invalid token, delayed fields, and PDF download.

No hosting operations, schema migrations, environment changes, or additional dependencies are required by this change. Frontend and backend source must both be running the updated version for the original-page relay to be available. Delivery for this request is a Git commit and push only.
