import { getBoaReceiptLink, getLocalReceiptUrl, rememberSavedReceipt } from "./boaReceipt";

export default function ReceiptLink({ transaction, children, ...props }) {
  const bankLink = getBoaReceiptLink(transaction.receipt_url);
  return (
    <a {...props} href={bankLink ? getLocalReceiptUrl(bankLink.token) : transaction.receipt_url}
      target="_blank" rel="noopener noreferrer"
      onClick={() => { if (bankLink) rememberSavedReceipt(bankLink.token, transaction); }}
      onAuxClick={() => { if (bankLink) rememberSavedReceipt(bankLink.token, transaction); }}>
      {children}
    </a>
  );
}
