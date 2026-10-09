import { useEffect, useRef, useState } from "react";
import { matchesSmsTransaction, smsTransactionDraft } from "./boaSmsImport";
import useApolloViewport from "./useApolloViewport";
import "./ApolloTransactionPrompt.css";

const APOLLO_PASSWORD = "pass";
const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";

export default function ApolloTransactionPrompt({ requestId = 0, enabled = true, transactions = [], personOptions = [], onAdded }) {
  const [event, setEvent] = useState(null);
  const [person, setPerson] = useState("");
  const [narrative, setNarrative] = useState("Materials");
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(null);
  const [password, setPassword] = useState("");
  const handledRequest = useRef(0);
  const controller = useRef(null);
  const saveLock = useRef(false);
  const dialog = useRef(null);
  const overlay = useApolloViewport(Boolean(stage) && enabled);
  const open = Boolean(enabled && stage);

  useEffect(() => {
    controller.current?.abort();
    if (!enabled) setStage(null);
    else if (requestId && requestId !== handledRequest.current) {
      handledRequest.current = requestId;
      setStage("password");
      setPassword("");
      setPerson("");
      setNarrative("Materials");
      setEditingNarrative(false);
      setEvent(null);
      setError("");
    }
    return () => controller.current?.abort();
  }, [requestId, enabled]);

  const checkLatest = async () => {
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setStage("checking");
    setError("");
    try {
      const response = await fetch(`${API_URL}/boa-sms/latest-transaction`, { signal: pending.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check the latest BOA SMS. Please try again.");
      if (pending.signal.aborted) return;
      if (!data.event) { setStage("empty"); return; }
      if (data.already_added || transactions.some(tx => matchesSmsTransaction(data.event, tx))) {
        setStage("matched"); return;
      }
      setEvent(data.event);
      setPerson("");
      setNarrative(data.event.narrative || "Materials");
      setEditingNarrative(false);
      setStage("transaction");
    } catch (failure) {
      if (pending.signal.aborted) return;
      setError(failure.message || "Could not check the latest BOA SMS. Please try again.");
      setStage("error");
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    (dialog.current?.querySelector("input, select") || dialog.current?.querySelector("button"))?.focus();
    return () => previousFocus?.focus?.();
  }, [open, stage]);

  const close = () => {
    if (saveLock.current) return;
    controller.current?.abort();
    setStage(null);
  };

  const add = async submitEvent => {
    submitEvent.preventDefault();
    if (stage === "password") {
      if (password !== APOLLO_PASSWORD) { setError("Incorrect Apollo password."); return; }
      setPassword("");
      await checkLatest();
      return;
    }
    if (stage !== "transaction" || !person || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...smsTransactionDraft(event, person), narrative: narrative.trim() || null, _boa_sms_message_hash: event.message_hash })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) setStage("error");
        throw new Error(data.error || "Could not add this transaction. Please try again.");
      }
      onAdded?.(data);
      setStage(null);
    } catch (failure) {
      setError(failure.message || "Could not add this transaction. Please try again.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  if (!open) return null;
  const draft = event ? smsTransactionDraft(event) : null;
  const titles = { password: "Check latest", checking: "Checking...", empty: "No recent SMS", matched: "Up to date", error: "Couldn't check", transaction: "Latest transaction" };
  const onKeyDown = keyEvent => {
    if (keyEvent.key === "Escape") { keyEvent.preventDefault(); close(); }
    if (keyEvent.key !== "Tab") return;
    const elements = [...dialog.current.querySelectorAll("button, input, select, summary, a[href]")].filter(element => !element.disabled && element.getClientRects().length > 0);
    const first = elements[0], last = elements[elements.length - 1];
    if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last?.focus(); }
    if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first?.focus(); }
  };

  return (
    <div ref={overlay} className="apollo-transaction-overlay apollo-password-overlay" onKeyDown={onKeyDown}>
      <form ref={dialog} className="apollo-transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="apollo-transaction-title" onSubmit={add} aria-busy={saving || stage === "checking"}>
        <div className="apollo-logo-frame"><img className="apollo-unlock-logo" src="/apollo-logo.webp" alt="Apollo" /></div>
        {stage === "transaction" && <span className="apollo-transaction-source">BOA SMS</span>}
        <h2 id="apollo-transaction-title" aria-live="polite">{titles[stage]}</h2>
        {stage === "password" && <>
          <label htmlFor="apollo-check-password">Password</label>
          <input id="apollo-check-password" type="password" autoComplete="off" value={password} onChange={change => { setPassword(change.target.value); setError(""); }} required />
        </>}
        {stage === "empty" && <p>Sync your messages, then try again.</p>}
        {stage === "matched" && <p>Latest SMS already saved.</p>}
        {stage === "transaction" && <>
          <dl>
            <div><dt>{draft.is_withdraw ? "Withdrawal" : "Deposit"}</dt><dd>ETB {Number(draft.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt>Date</dt><dd>{draft.date}</dd></div>
            <div><dt>Narrative</dt><dd>
              {editingNarrative ? <input aria-label="Narrative" className="apollo-narrative-input" value={narrative} maxLength={2000} autoFocus disabled={saving} onChange={change => setNarrative(change.target.value)} onBlur={() => setEditingNarrative(false)} onKeyDown={keyEvent => { if (keyEvent.key === "Enter") keyEvent.preventDefault(); }} />
                : <button type="button" className="apollo-narrative-edit" aria-label="Edit narrative" disabled={saving} onClick={() => setEditingNarrative(true)}>{narrative || "Add narrative"}<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></button>}
            </dd></div>
          </dl>
          <label htmlFor="apollo-transaction-person">Person</label>
          <select id="apollo-transaction-person" value={person} onChange={change => setPerson(change.target.value)} required disabled={saving}>
            <option value="" disabled>Select person</option>
            {personOptions.map(option => <option key={option.value} value={option.value}>{option.value === "null" ? "Unassigned" : option.label}</option>)}
          </select>
          <details className="apollo-transaction-details">
            <summary>Details</summary>
            <dl><div><dt>Reference</dt><dd>{draft.reference || "Unavailable"}</dd></div></dl>
            {draft.receipt_url && <a href={draft.receipt_url} target="_blank" rel="noreferrer">View receipt</a>}
          </details>
        </>}
        {error && <p className="apollo-transaction-error" role="alert">{error}</p>}
        <div className="apollo-transaction-actions">
          <button type="button" onClick={close} disabled={saving}>{stage === "transaction" ? "Later" : "Close"}</button>
          {stage === "password" && <button type="submit">Check latest</button>}
          {stage === "transaction" && <button type="submit" disabled={saving || !person}>{saving ? "Adding..." : "Add transaction"}</button>}
          {["error", "empty"].includes(stage) && <button type="button" className="apollo-transaction-primary" onClick={checkLatest}>Try again</button>}
        </div>
      </form>
    </div>
  );
}
