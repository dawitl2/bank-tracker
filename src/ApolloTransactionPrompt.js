import { useLanguage } from "./Language";
import { useCallback, useEffect, useRef, useState } from "react";
import { smsTransactionDraft } from "./boaSmsImport";
import { API_URL, checkLatestSms, readJsonResponse } from "./boaSmsClient";
import { formatTransactionAmount } from "./transactionAmount";
import useApolloViewport from "./useApolloViewport";
import "./ApolloTransactionPrompt.css";


export default function ApolloTransactionPrompt({ requestId = 0, enabled = false, personOptions = [], onAdded }) {
  const { t } = useLanguage();
  const [event, setEvent] = useState(null);
  const [person, setPerson] = useState("");
  const [narrative, setNarrative] = useState("Materials");
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(null);
  const handledRequest = useRef(0);
  const controller = useRef(null);
  const saveLock = useRef(false);
  const dialog = useRef(null);
  const overlay = useApolloViewport(Boolean(stage) && enabled);
  const open = Boolean(enabled && stage);

  const checkLatest = useCallback(async () => {
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setStage("checking");
    setError("");
    try {
      const data = await checkLatestSms(pending.signal);
      if (pending.signal.aborted) return;
      if (!data.event) { setStage("empty"); return; }
      setEvent(data.event);
      if (data.already_added) {
        setStage("matched"); return;
      }
      setPerson("");
      setNarrative(data.event.narrative || "Materials");
      setEditingNarrative(false);
      setStage("transaction");
    } catch (failure) {
      if (pending.signal.aborted) return;
      setError(failure.message || "Could not check the latest BOA SMS. Please try again.");
      setStage("error");
    }
  }, []);

  useEffect(() => {
    controller.current?.abort();
    if (!enabled) setStage(null);
    else if (requestId && requestId !== handledRequest.current) {
      handledRequest.current = requestId;
      setEvent(null);
      setPerson("");
      setNarrative("Materials");
      setEditingNarrative(false);
      checkLatest();
    }
    return () => controller.current?.abort();
  }, [requestId, enabled, checkLatest]);

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
    if (stage !== "transaction" || !person || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      const latest = await checkLatestSms();
      if (!latest.event || latest.event.message_hash !== event.message_hash) {
        setStage("error");
        throw new Error("A newer BOA SMS is available. Check again before adding.");
      }
      if (latest.already_added) {
        onAdded?.(latest.transaction);
        setStage("matched");
        return;
      }
      // Send exactly the same fields as the existing plus-button save flow.
      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...smsTransactionDraft(latest.event, person), narrative: narrative.trim() || null })
      });
      const data = await readJsonResponse(response, "Could not save this transaction. Please try again.");
      if (!data?.id) throw new Error("Could not confirm the saved transaction. Check again before retrying.");
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
  const titles = { checking: "Check latest", empty: "No recent SMS", matched: "Up to date", error: "Couldn't check", transaction: "Latest transaction" };
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
        <div className="apollo-logo-frame"><img className="apollo-unlock-logo" src="/apollo-logo.webp" alt={t("Apollo")} /></div>
        {stage === "transaction" && <span className="apollo-transaction-source">{t("BOA SMS")}</span>}
        <h2 id="apollo-transaction-title" aria-live="polite">{t(titles[stage])}</h2>
        {stage === "checking" && <p role="status">{t("Comparing your latest BOA SMS with saved transactions.")}</p>}
        {stage === "empty" && <p>{t("Sync your messages, then try again.")}</p>}
        {stage === "matched" && <><p>{t("Your latest SMS is already saved.")}</p><dl><div><dt>{t("Reference")}</dt><dd>{t(draft?.reference)}</dd></div></dl></>}
        {stage === "transaction" && <>
          <p>{t("Select a person to add this transaction.")}</p>
          <dl>
            <div><dt>{t(draft.is_withdraw ? "Withdrawal" : "Deposit")}</dt><dd>{t("ETB ")}{t(formatTransactionAmount(draft.amount))}</dd></div>
            <div><dt>{t("Date")}</dt><dd>{draft.date}</dd></div>
            <div><dt>{t("Narrative")}</dt><dd>
              {editingNarrative ? <input aria-label={t("Narrative")} className="apollo-narrative-input" value={narrative} maxLength={2000} autoFocus disabled={saving} onChange={change => setNarrative(change.target.value)} onBlur={() => setEditingNarrative(false)} onKeyDown={keyEvent => { if (keyEvent.key === "Enter") keyEvent.preventDefault(); }} />
                : <button type="button" className="apollo-narrative-edit" aria-label={t("Edit narrative")} disabled={saving} onClick={() => setEditingNarrative(true)}>{t(narrative || "Add narrative")}<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg></button>}
            </dd></div>
          </dl>
          <label htmlFor="apollo-transaction-person">{t("Person")}</label>
          <select id="apollo-transaction-person" value={person} onChange={change => setPerson(change.target.value)} required disabled={saving}>
            <option value="" disabled>{t("Select person")}</option>
            {personOptions.map(option => <option key={option.value} value={option.value}>{t(option.value === "null" ? "Unassigned" : option.label)}</option>)}
          </select>
          <details className="apollo-transaction-details">
            <summary>{t("Details")}</summary>
            <dl><div><dt>{t("Reference")}</dt><dd>{t(draft.reference || "Unavailable")}</dd></div></dl>
            {draft.receipt_url && <a href={draft.receipt_url} target="_blank" rel="noreferrer">{t("View receipt")}</a>}
          </details>
        </>}
        {error && <p className="apollo-transaction-error" role="alert">{t(error)}</p>}
        <div className="apollo-transaction-actions">
          <button type="button" onClick={close} disabled={saving}>{t(stage === "transaction" ? "Later" : "Close")}</button>
          {stage === "transaction" && <button type="submit" disabled={saving || !person}>{t(saving ? "Adding..." : "Add transaction")}</button>}
          {["error", "empty"].includes(stage) && <button type="button" className="apollo-transaction-primary" onClick={checkLatest}>{t("Try again")}</button>}
        </div>
      </form>
    </div>
  );
}
