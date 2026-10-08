import { lazy, Suspense, useState } from "react";
import { getBoaReceiptLink } from "./boaReceipt";

const BoaReceiptViewer = lazy(() => import("./BoaReceiptViewer"));

export default function ReceiptLink({ transaction, children, ...props }) {
  const [open, setOpen] = useState(false);
  const bankLink = getBoaReceiptLink(transaction.receipt_url);
  return (
    <>
      <a {...props} href={bankLink?.url || transaction.receipt_url} target="_blank" rel="noopener noreferrer"
        onClick={event => {
          if (!bankLink || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}>
        {children}
      </a>
      {open && <Suspense fallback={<div role="status">Opening receipt…</div>}>
        <BoaReceiptViewer transaction={transaction} bankLink={bankLink} onClose={() => setOpen(false)} />
      </Suspense>}
    </>
  );
}
