import { useEffect, useRef, useState } from "react";
import { FiSliders, FiUsers, FiRefreshCw, FiPlus, FiTrash2 } from "react-icons/fi";

function PersonConfirmation({ action, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current.showModal(); }, []);
  const adding = action.type === "add";
  return (
    <dialog className="settings-confirm" ref={dialogRef} aria-labelledby="settings-confirm-title"
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
      <span className="settings-dialog-icon"><FiUsers aria-hidden="true" /></span>
      <h2 id="settings-confirm-title">{adding ? "Add" : "Remove"} {action.person.name}?</h2>
      <p>{adding ? "They will be available in transaction dropdowns." : "They will leave the people list. Existing transactions will stay."}</p>
      {error && <p className="settings-error" role="alert">{error}</p>}
      <div className="settings-confirm-actions">
        <button type="button" autoFocus onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={adding ? "settings-primary" : "settings-danger"} onClick={onConfirm} disabled={busy}>
          {busy ? "Saving…" : adding ? "Confirm add" : "Remove person"}
        </button>
      </div>
    </dialog>
  );
}

export default function AppSettings({ preferences, onPreferenceChange, storageError, people, peopleError, peopleReady,
  onAddPerson, onRemovePerson, onRefresh, version }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const requestAdd = event => {
    event.preventDefault();
    setError(""); setNotice("");
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!cleanName) { setError("Enter a name first."); return; }
    if (["all", "withdraw", "deposit", "construction", "null"].includes(cleanName.toLowerCase())) {
      setError("Choose another name; this name is already used by a transaction filter."); return;
    }
    if (people.some(person => person.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
      setError("This person is already in the list."); return;
    }
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const id = slug && !people.some(person => person.id === slug) ? slug : `person-${crypto.randomUUID()}`;
    setAction({ type: "add", person: { id, name: cleanName, role: role.trim() || "Member", class: "avatar-other" } });
  };
  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (action.type === "add") {
        await onAddPerson(action.person);
        setName(""); setRole(""); setAdding(false);
      } else { await onRemovePerson(action.person); }
      setNotice(`${action.person.name} ${action.type === "add" ? "added" : "removed"}.`);
      setAction(null);
    } catch (err) { setError(err.message || "Could not save. Please try again."); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setRefreshing(true); setNotice(""); setError("");
    try { await onRefresh(); setNotice("Latest data loaded."); }
    catch { setError("Could not refresh all data. Check your connection and try again."); }
    finally { setRefreshing(false); }
  };
  return (
    <section className="app-settings" aria-labelledby="settings-heading">
      <header className="settings-heading"><span>MAKE IT YOURS</span><h1 id="settings-heading">Settings</h1><p>A few useful controls, close at hand.</p></header>
      <section className="settings-card" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading"><FiSliders aria-hidden="true" /> App preferences</h2>
        <p className="settings-caption">For this device’s mobile app. Desktop stays the same.</p>
        {[
          ["calculator", "Calculator", "Show the calculator and table-total shortcut."],
          ["compactRows", "Compact transactions", "Fit more transactions on your screen."],
          ["reduceMotion", "Reduce motion", "Keep app transitions and buttons still."]
        ].map(([key, label, description]) => (
          <label className="settings-toggle-row" key={key}>
            <span><strong>{label}</strong><small>{description}</small></span>
            <input type="checkbox" role="switch" checked={preferences[key]} onChange={event => onPreferenceChange(key, event.target.checked)} />
          </label>
        ))}
        {storageError && <p className="settings-error" role="alert">{storageError}</p>}
      </section>
      <details className="settings-card settings-people">
        <summary><span><FiUsers aria-hidden="true" /> People <small>{people.length}</small></span><span className="settings-chevron" aria-hidden="true">⌄</span></summary>
        <p className="settings-caption">People in your transaction dropdowns. Changes are shared across the account.</p>
        {peopleError && <p className="settings-error" role="alert">{peopleError} Use Refresh data below to retry.</p>}
        {!peopleReady && !peopleError && <p className="settings-caption">Loading people…</p>}
        <ul className="settings-people-list">
          {people.map(person => <li key={person.id}>
            <span className={`settings-avatar ${person.class || "avatar-other"}`}>{person.name.slice(0, 1).toUpperCase()}</span>
            <span className="settings-person-name"><strong>{person.name}</strong><small>{person.role}</small></span>
            <button type="button" className="settings-remove" aria-label={`Remove ${person.name}`} disabled={!peopleReady || Boolean(peopleError)}
              onClick={() => { setError(""); setNotice(""); setAction({ type: "remove", person }); }}><FiTrash2 aria-hidden="true" /></button>
          </li>)}
        </ul>
        {!people.length && peopleReady && <p className="settings-caption">Add your first person below.</p>}
        {adding ? <form className="settings-person-form" onSubmit={requestAdd}>
          <label>Name<input value={name} maxLength={60} autoFocus required onChange={event => setName(event.target.value)} placeholder="Person’s name" /></label>
          <label>Role <span>(optional)</span><input value={role} maxLength={80} onChange={event => setRole(event.target.value)} placeholder="e.g. Site manager" /></label>
          <div className="settings-form-actions"><button type="button" onClick={() => { setAdding(false); setError(""); }}>Cancel</button><button className="settings-primary" disabled={!peopleReady || Boolean(peopleError)}>Continue</button></div>
        </form> : <button type="button" className="settings-add-person" disabled={!peopleReady || Boolean(peopleError)} onClick={() => { setAdding(true); setError(""); setNotice(""); }}><FiPlus aria-hidden="true" /> Add person</button>}
      </details>
      <section className="settings-card settings-refresh">
        <div><h2><FiRefreshCw aria-hidden="true" /> Refresh data</h2><p className="settings-caption">Get the latest transactions, balances and people.</p></div>
        <button type="button" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
      </section>
      {!action && error && <p className="settings-error" role="alert">{error}</p>}
      <p className="settings-notice" role="status">{notice}</p>
      <p className="settings-version">Bank Tracker · Version {version}</p>
      {action && <PersonConfirmation action={action} busy={busy} error={error} onCancel={() => { if (!busy) { setAction(null); setError(""); } }} onConfirm={confirm} />}
    </section>
  );
}
