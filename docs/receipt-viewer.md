# Bank receipts within the installed app

Mobile **More**, desktop **View**, and person-detail **View** navigate within the current app to /slip/?trx=<token>. The link adds one browser-history entry instead of opening a new tab or reloading the PWA. Device/browser Back reveals the previous app view with its transaction data and filters still mounted. Forward reopens the receipt. Modified clicks retain normal browser link behavior, and shared/reloaded receipt URLs have an explicit SPA rewrite.

There is no additional startup animation, receipt toolbar, opening/closed message, corrected-link label, or availability banner. The browser/OS still owns the installed PWA's initial static splash; the second web splash has been removed as requested.

## Actual bank page first

The viewer loads /api/boa-receipt?kind=page&trx=<token> from the app's own origin. The function in api/boa-receipt.js ships alongside the frontend source and calls only the bank's fixed public slip and receipt-data endpoints. It requires no credentials, database writes, new dependencies, Render update, or REACT_APP_API_URL setting.

The bank prevents direct embedding and does not permit cross-origin receipt-data fetches. The relay retains the bank's original HTML, CSS, rendering code, encrypted verification QR, footer, and PDF action. Only asset addresses are rewritten to the app's /api/boa-receipt/assets/ path, and the injected bridge relays the receipt-data request through the same function. Relative lazy PDF modules resolve beneath that asset path. vercel.json contains only the required source-controlled asset and SPA rewrites.

The bank's shell/QR may appear before fields arrive. The page becomes ready only after its original renderer displays the requested transaction-reference row. Confirmed invalid receipts switch to the saved template immediately. Temporary page, script, or API failures retry the actual page once within the same 30-second overall deadline. Optional image failures do not discard real receipt fields. A stalled page falls back at that deadline. Upstream requests have 12-second deadlines. The public shell has a five-minute in-process cache, public hashed assets have cache headers, and receipt data stays no-store. Tokens and asset names cannot select arbitrary hosts or filesystem paths.

The previous separate backend endpoints remain compatible for older clients, but the frontend no longer depends on them. The live backend returned 404 for both /receipt-page and /receipt-details when this fix was investigated; local-only testing had missed that boundary.

## Quiet fallback and navigation

The same-app navigation event passes the selected transaction directly to the viewer, so fallback works even when browser storage is disabled. A ten-minute handoff of only amount, date, reference, and narrative still supports modified clicks and reloads. Receipt tabs consume it into sessionStorage and reject expired entries. No saved financial details go into URL parameters.

Only when the actual receipt fails does the local template use those saved fields. It follows the supplied mobile reference's ten-row layout with em dashes for unrecorded account, name, fee, total, phone, or transaction-type details. Saved references and other values remain unchanged. An existing narrative adds its own row. The table's watermark fills a minimum 230px area using the original PNG's transparency; long values wrap inside their columns. The purple stamp is anchored beside the QR so its position remains stable when the data table grows. Its QR opens the original bank link; it does not claim to verify payment. A small footer identifies the saved transaction copy, including in PDF downloads. A shared link without saved fields can show a generic template on failure.

The confirmed token FT26082QM3HF413499 is corrected to FT26082QM3HF41349 for viewing only. Other tokens and database records are unchanged.

## Editing a transaction date

The shared edit-transaction form has a calendar button inside the right edge of its date input. It opens an animated day/month/year wheel picker with native scrolling and snapping. Today uses the device's actual local date. Month/year changes clamp invalid days, including leap days. Keyboard arrows and Page Up/Down work, focus stays in the picker, and reduced-motion settings disable decorative animation. Cancel, Close, Escape, or tapping the backdrop leave the draft unchanged.

Set date applies only the date to the draft, preserving its existing time suffix and date format. Save Changes uses the existing transaction-update flow. The picker makes no network requests and does not change other fields.

## Checks and delivery

- CI=true npm test -- --watchAll=false --runInBand
- node --test backend/boaReceipt.test.js backend/receiptPage.test.js backend/receiptApi.test.js
- npm run build
- Serve the production frontend and actual api/boa-receipt.js handler locally, with the repository rewrites. Verify mobile More → real receipt → Back → retained transaction view; repeat with a failed link and verify saved fallback. Check original and fallback PDF downloads and direct receipt reloads.

Delivery is a Git commit and push. No manual deployment commands or dashboard changes are part of this request. The frontend's existing GitHub integration must finish running the new commit before the live app can use its new same-origin function.
