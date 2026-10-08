import { getBoaReceiptLink, getLocalReceiptUrl, isDawitTransaction, rememberSavedReceipt } from "./boaReceipt";
import { RECEIPT_NAVIGATION } from "./BrowserApp";

export default function ReceiptLink({ transaction, children, ...props }) {
  const isDawit = isDawitTransaction(transaction);
  const bankLink = isDawit ? getBoaReceiptLink(transaction?.receipt_url) : null;
  return (
    <a
      {...props}
      href={bankLink ? getLocalReceiptUrl(bankLink.token) : transaction?.receipt_url}
      target={bankLink ? props.target : (props.target || "_blank")}
      rel={bankLink ? props.rel : (props.rel || "noopener noreferrer")}
      onClick={event => {
        if (!bankLink) return;
        rememberSavedReceipt(bankLink.token, transaction);
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.history.pushState({ receipt: true }, "", getLocalReceiptUrl(bankLink.token));
        window.dispatchEvent(new CustomEvent(RECEIPT_NAVIGATION, { detail: { transaction } }));
      }}
      onAuxClick={() => { if (bankLink) rememberSavedReceipt(bankLink.token, transaction); }}>
      {children}
    </a>
  );
}
