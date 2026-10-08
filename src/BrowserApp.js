import { lazy, Suspense, useEffect, useState } from "react";

const App = lazy(() => import("./App"));
const Receipt = lazy(() => import("./BoaReceiptViewer"));
export const RECEIPT_NAVIGATION = "bank-tracker:receipt-navigation";

export function isReceiptLocation() {
  return window.location.pathname.replace(/\/$/, "") === `${process.env.PUBLIC_URL || ""}/slip`;
}

export default function BrowserApp({ AppComponent = App, ReceiptComponent = Receipt }) {
  const [route, setRoute] = useState(() => ({ receipt: isReceiptLocation(), search: window.location.search }));
  const [appStarted, setAppStarted] = useState(() => !isReceiptLocation());

  useEffect(() => {
    const update = event => {
      const receipt = isReceiptLocation();
      if (!receipt) setAppStarted(true);
      setRoute({ receipt, search: window.location.search, transaction: event.detail?.transaction });
    };
    window.addEventListener("popstate", update);
    window.addEventListener(RECEIPT_NAVIGATION, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(RECEIPT_NAVIGATION, update);
    };
  }, []);

  useEffect(() => { document.title = route.receipt ? "Receipt" : "Bank Tracker"; }, [route.receipt]);

  return <>
    {/* Keep filters, transaction data, and the user's current app view mounted
        while the receipt is open. Browser/device Back reveals the same app. */}
    {appStarted && <div hidden={route.receipt}><Suspense fallback={null}><AppComponent /></Suspense></div>}
    {route.receipt && <Suspense fallback={null}>
      <ReceiptComponent key={route.search} transaction={route.transaction} />
    </Suspense>}
  </>;
}
