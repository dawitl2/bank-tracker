import { useEffect, useRef, useState } from "react";
import { matchesSmsTransaction, smsTransactionDraft } from "./boaSmsImport";
import useApolloViewport from "./useApolloViewport";
import "./ApolloTransactionPrompt.css";

const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";

export default function ApolloTransactionPrompt({ enabled, transactions = [], personOptions = [], onAdded }) {
  const [event, setEvent] = useState(null);
  const [person, setPerson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef(new Set());
  const saveLock = useRef(false);
  const dialog = useRef(null);
  const overlay = useApolloViewport(Boolean(event) && enabled);
  const matching = event && transactions.some(tx => matchesSmsTransaction(event, tx));
  const open = Boolean(enabled && event && !matching);

  useEffect(() => {
    if (!enabled) { setEvent(null); return undefined; }
    const controller = new AbortController();
    let timer;
    const delay = new Promise(resolve => { timer = window.setTimeout(resolve, 2000); });
    const check = async () => {
      try {
        const snapshot = fetch(`${API_URL}/boa-sms/latest-transaction`, { signal: controller.signal })
          .then(response => response.ok ? response.json() : null);
        const [data] = await Promise.all([snapshot, delay]);
        if (!data) return;
        if (controller.signal.aborted || !data.event?.message_hash || data.already_added || seen.current.has(data.event.message_hash)) return;
        setEvent(data.event);
        setPerson("");
        setError("");
      } catch { /* An unavailable SMS service must not interrupt Apollo. */ }
    };
    check();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [enabled]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    dialog.current?.querySelector("select")?.focus();
    return () => previousFocus?.focus?.();
  }, [open]);

  const close = () => {
    if (saveLock.current) return;
    seen.current.add(event.message_hash);
    setEvent(null);
  };

  const add = async submitEvent => {
    submitEvent.preventDefault();
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/boa-sms/transactions/latest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_hash: event.message_hash, person: person === "null" ? null : person })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add this transaction. Please try again.");
      seen.current.add(event.message_hash);
      onAdded?.(data.transaction);
      setEvent(null);
    } catch (failure) {
      setError(failure.message || "Could not add this transaction. Please try again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  if (!open) return null;
  const draft = smsTransactionDraft(event);
  const onKeyDown = keyEvent => {
    if (keyEvent.key === "Escape") { keyEvent.preventDefault(); close(); }
    if (keyEvent.key !== "Tab") return;
    const elements = [...dialog.current.querySelectorAll("button, select, a[href]")].filter(element => !element.disabled);
    const first = elements[0], last = elements[elements.length - 1];
    if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last?.focus(); }
    if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first?.focus(); }
  };

  return (
    <div ref={overlay} className="apollo-transaction-overlay" onKeyDown={onKeyDown}>
      <form ref={dialog} className="apollo-transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="apollo-transaction-title" onSubmit={add} aria-busy={saving}>
        <span className="apollo-transaction-source">Apollo · BOA SMS</span>
        <h2 id="apollo-transaction-title">Add the latest transaction?</h2>
        <p>Your latest BOA SMS transaction hasn’t been added to the table.</p>
        <dl>
          <div><dt>{draft.is_withdraw ? "Withdrawal" : "Deposit"}</dt><dd>ETB {Number(draft.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</dd></div>
          <div><dt>Date</dt><dd>{draft.date}</dd></div>
          <div><dt>Reference</dt><dd>{draft.reference || "Not included in SMS"}</dd></div>
          <div><dt>Narrative</dt><dd>{draft.narrative || "Not included in SMS"}</dd></div>
        </dl>
        {draft.receipt_url && <a href={draft.receipt_url} target="_blank" rel="noreferrer">View bank receipt</a>}
        <label htmlFor="apollo-transaction-person">Who is this transaction for?</label>
        <select id="apollo-transaction-person" value={person} onChange={change => setPerson(change.target.value)} required disabled={saving}>
          <option value="" disabled>Choose a person</option>
          {personOptions.map(option => <option key={option.value} value={option.value}>{option.value === "null" ? "Unassigned" : option.label}</option>)}
        </select>
        {error && <p className="apollo-transaction-error" role="alert">{error}</p>}
        <div className="apollo-transaction-actions">
          <button type="button" onClick={close} disabled={saving}>Later</button>
          <button type="submit" disabled={saving || !person}>{saving ? "Adding…" : "Add transaction"}</button>
        </div>
      </form>
    </div>
  );
}
