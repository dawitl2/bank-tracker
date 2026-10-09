import { useEffect, useRef, useState } from "react";
import { matchesSmsTransaction, smsTransactionDraft } from "./boaSmsImport";
import useApolloViewport from "./useApolloViewport";
import "./ApolloTransactionPrompt.css";

const APOLLO_PASSWORD = "pass";
const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";

export default function ApolloTransactionPrompt({ requestId = 0, enabled = true, transactions = [], personOptions = [], onAdded }) {
  const [event, setEvent] = useState(null);
  const [person, setPerson] = useState("");
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
    dialog.current?.querySelector("input, select, button")?.focus();
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
        body: JSON.stringify({ ...smsTransactionDraft(event, person), _boa_sms_message_hash: event.message_hash })
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
  const titles = { password: "Check latest transaction", checking: "Checking latest BOA SMS...", empty: "No BOA SMS transactions yet", matched: "You're up to date", error: "Could not check BOA SMS", transaction: "Add the latest transaction?" };
  const onKeyDown = keyEvent => {
    if (keyEvent.key === "Escape") { keyEvent.preventDefault(); close(); }
    if (keyEvent.key !== "Tab") return;
    const elements = [...dialog.current.querySelectorAll("button, input, select, a[href]")].filter(element => !element.disabled);
    const first = elements[0], last = elements[elements.length - 1];
    if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last?.focus(); }
    if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first?.focus(); }
  };

  return (
    <div ref={overlay} className="apollo-transaction-overlay apollo-password-overlay" onKeyDown={onKeyDown}>
      <form ref={dialog} className="apollo-transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="apollo-transaction-title" onSubmit={add} aria-busy={saving || stage === "checking"}>
        <div className="apollo-logo-frame"><img className="apollo-unlock-logo" src="/apollo-logo.webp" alt="Apollo" /></div>
        <span className="apollo-transaction-source">Apollo · BOA SMS</span>
        <h2 id="apollo-transaction-title">{titles[stage]}</h2>
        {stage === "password" && <>
          <p>Enter the Apollo password to compare the newest BOA SMS with your transaction table.</p>
          <label htmlFor="apollo-check-password">Apollo password</label>
          <input id="apollo-check-password" type="password" autoComplete="off" value={password} onChange={change => { setPassword(change.target.value); setError(""); }} required />
        </>}
        {stage === "checking" && <p role="status">Comparing the latest SMS with saved transactions...</p>}
        {stage === "empty" && <p>Sync BOA messages from the companion app, then check again.</p>}
        {stage === "matched" && <p>The latest BOA SMS is already in your transaction table.</p>}
        {stage === "transaction" && <>
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
