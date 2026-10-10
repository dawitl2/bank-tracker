import { useLanguage } from "./Language";
import { useProfile } from "./ProfileSession";
import { AccountSummary, ProfilePhoto } from "./AccountSettings";
import { useEffect, useRef, useState } from "react";
import { FiSliders, FiUsers, FiRefreshCw, FiPlus, FiTrash2, FiChevronDown, FiGlobe } from "react-icons/fi";

function PersonConfirmation({ action, busy, error, onCancel, onConfirm }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current.showModal(); }, []);
  const adding = action.type === "add";
  return (
    <dialog className="settings-confirm" ref={dialogRef} aria-labelledby="settings-confirm-title"
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
      <span className="settings-dialog-icon"><FiUsers aria-hidden="true" /></span>
      <h2 id="settings-confirm-title">{t(adding ? "Add" : "Remove")} {t(action.person.name)}{t("?")}</h2>
      <p>{t(adding ? "They will be available in transaction dropdowns." : "They will leave the people list. Existing transactions will stay.")}</p>
      {error && <p className="settings-error" role="alert">{t(error)}</p>}
      <div className="settings-confirm-actions">
        <button type="button" autoFocus onClick={onCancel} disabled={busy}>{t("Cancel")}</button>
        <button type="button" className={adding ? "settings-primary" : "settings-danger"} onClick={onConfirm} disabled={busy}>
          {t(busy ? "Saving…" : adding ? "Confirm add" : "Remove person")}
        </button>
      </div>
    </dialog>
  );
}

export default function AppSettings({ preferences, onPreferenceChange, storageError, people, peopleError, peopleReady,
  onAddPerson, onRemovePerson, onRefresh, version, onOpenAccounts }) {
  const { t } = useLanguage();
  const { profile } = useProfile();
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
      <header className="settings-heading"><h1 id="settings-heading">{t("Settings")}</h1></header>
      <AccountSummary onOpen={onOpenAccounts} />
      <section className="settings-card" aria-labelledby="preferences-heading">
        <h2 id="preferences-heading"><FiSliders aria-hidden="true" />{t(" App preferences")}</h2>
        <p className="settings-caption">{t("For this device’s mobile app. Desktop stays the same.")}</p>
        {[
          ["calculator", "Calculator", "Show the calculator and table-total shortcut."],
          ["compactRows", "Compact transactions", "Fit more transactions on your screen."],
          ["reduceMotion", "Reduce motion", "Keep app transitions and buttons still."]
        ].map(([key, label, description]) => (
          <label className="settings-toggle-row" key={key}>
            <span><strong>{t(label)}</strong><small>{t(description)}</small></span>
            <input type="checkbox" role="switch" checked={preferences[key]} onChange={event => onPreferenceChange(key, event.target.checked)} />
          </label>
        ))}
        {storageError && <p className="settings-error" role="alert">{t(storageError)}</p>}
      </section>
      <section className="settings-card settings-language">
        <label htmlFor="app-language"><strong><FiGlobe aria-hidden="true" />{t(" Language")}</strong><small>{t("Display only, on this device.")}</small></label>
        <select id="app-language" value={preferences.language} onChange={event => onPreferenceChange("language", event.target.value)}>
          <option value="en">{t("English")}</option><option value="am">{t("አማርኛ")}</option>
        </select>
      </section>
      <details className="settings-card settings-people">
        <summary><span><FiUsers aria-hidden="true" />{t(" People ")}<small>{t(people.length)}</small></span><span className="settings-chevron" aria-hidden="true"><FiChevronDown /></span></summary>
        <p className="settings-caption">{t("People in your transaction dropdowns. Changes are shared across the account.")}</p>
        {peopleError && <p className="settings-error" role="alert">{t(peopleError)}{t(" Use Refresh data below to retry.")}</p>}
        {!peopleReady && !peopleError && <p className="settings-caption">{t("Loading people…")}</p>}
        <ul className="settings-people-list">
          {people.map(person => <li key={person.id}>
            <ProfilePhoto personId={person.id} name={person.name} className={`settings-avatar ${person.class || "avatar-other"}`} />
            <span className="settings-person-name"><strong>{t(person.id === profile?.person_id ? profile.name : person.name)}</strong><small>{t(person.role)}</small></span>
            <button type="button" className="settings-remove" aria-label={t(`Remove ${person.name}`)} disabled={!peopleReady || Boolean(peopleError)}
              onClick={() => { setError(""); setNotice(""); setAction({ type: "remove", person }); }}><FiTrash2 aria-hidden="true" /></button>
          </li>)}
        </ul>
        {!people.length && peopleReady && <p className="settings-caption">{t("Add your first person below.")}</p>}
        {adding ? <form className="settings-person-form" onSubmit={requestAdd}>
          <label>{t("Name")}<input value={name} maxLength={60} autoFocus required onChange={event => setName(event.target.value)} placeholder={t("Person’s name")} /></label>
          <label>{t("Role ")}<span>{t("(optional)")}</span><input value={role} maxLength={80} onChange={event => setRole(event.target.value)} placeholder={t("e.g. Site manager")} /></label>
          <div className="settings-form-actions"><button type="button" onClick={() => { setAdding(false); setError(""); }}>{t("Cancel")}</button><button className="settings-primary" disabled={!peopleReady || Boolean(peopleError)}>{t("Continue")}</button></div>
        </form> : <button type="button" className="settings-add-person" disabled={!peopleReady || Boolean(peopleError)} onClick={() => { setAdding(true); setError(""); setNotice(""); }}><FiPlus aria-hidden="true" />{t(" Add person")}</button>}
      </details>
      <section className="settings-card settings-refresh">
        <div><h2><FiRefreshCw aria-hidden="true" />{t(" Refresh data")}</h2><p className="settings-caption">{t("Get the latest transactions, balances and people.")}</p></div>
        <button type="button" onClick={refresh} disabled={refreshing}>{t(refreshing ? "Refreshing…" : "Refresh")}</button>
      </section>
      {!action && error && <p className="settings-error" role="alert">{t(error)}</p>}
      <p className="settings-notice" role="status">{t(notice)}</p>
      <p className="settings-version">{t("Bank Tracker · Version ")}{t(version)}</p>
      {action && <PersonConfirmation action={action} busy={busy} error={error} onCancel={() => { if (!busy) { setAction(null); setError(""); } }} onConfirm={confirm} />}
    </section>
  );
}
