import { useLanguage, LocalizedTextInput } from "./Language";
import { useProfile } from "./ProfileSession";
import { AccountSummary, ProfilePhoto, readPhoto, getPersonCustomizations, savePersonCustomization } from "./AccountSettings";
import { useEffect, useRef, useState } from "react";
import {
  FiSliders,
  FiUsers,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiGlobe,
  FiCreditCard,
  FiEdit2,
  FiCamera,
  FiCheck
} from "react-icons/fi";

const PRESET_COLORS = [
  "#c73939",
  "#f4a300",
  "#b87200",
  "#20231f",
  "#8c52ff",
  "#10b981",
  "#2563eb",
  "#06b6d4",
  "#ec4899"
];

function PersonConfirmation({ action, busy, error, onCancel, onConfirm }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.showModal(); }, []);
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

export function EditPersonDialog({ person, busy, error, onCancel, onSave }) {
  const { t } = useLanguage();
  const dialogRef = useRef(null);
  const customs = getPersonCustomizations()[person.id] || {};
  const [draftName, setDraftName] = useState(person.name || "");
  const [draftRole, setDraftRole] = useState(person.role || "");
  const [draftAvatar, setDraftAvatar] = useState(customs.avatar || person.avatar || "");
  const [draftColor, setDraftColor] = useState(customs.color || person.color || "#8c52ff");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const avatarData = await readPhoto(file);
      setDraftAvatar(avatarData);
    } catch (err) {
      setPhotoError(err.message || "Failed to process photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = draftName.trim();
    if (!cleanName) return;
    onSave({
      ...person,
      name: cleanName,
      role: draftRole.trim() || "Member",
      avatar: draftAvatar,
      color: draftColor,
      class: person.class || "avatar-other"
    });
  };

  return (
    <dialog
      className="settings-confirm edit-person-dialog"
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}
      style={{ maxWidth: "420px", width: "90%" }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>{t("Edit Person Details")}</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          <ProfilePhoto
            personId={person.id}
            name={draftName}
            avatar={draftAvatar}
            color={draftColor}
            className="settings-avatar"
            style={{ width: "64px", height: "64px", fontSize: "24px" }}
          />
          <label className="account-photo-button" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FiCamera aria-hidden="true" />
            <span>{t(photoBusy ? "Processing..." : "Change photo")}</span>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={photoBusy || busy} style={{ display: "none" }} />
          </label>
          {photoError && <p className="settings-error" role="alert">{t(photoError)}</p>}
        </div>

        <label style={{ display: "block", marginBottom: "12px", textAlign: "left" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>{t("Name")}</span>
          <LocalizedTextInput
            value={draftName}
            maxLength={60}
            required
            disabled={busy}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t("Person’s name")}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "block", marginBottom: "16px", textAlign: "left" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>{t("Role")}</span>
          <input
            value={draftRole}
            maxLength={80}
            disabled={busy}
            onChange={(e) => setDraftRole(e.target.value)}
            placeholder={t("e.g. Site manager")}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #ccc" }}
          />
        </label>

        <div style={{ marginBottom: "20px", textAlign: "left" }}>
          <span style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "8px" }}>{t("Avatar color")}</span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setDraftColor(col)}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: col,
                  border: draftColor === col ? "3px solid #111" : "2px solid #fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                aria-label={`Color ${col}`}
              >
                {draftColor === col && <FiCheck color="#fff" size={14} />}
              </button>
            ))}
            <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer", marginLeft: "6px" }}>
              <input
                type="color"
                value={draftColor}
                onChange={(e) => setDraftColor(e.target.value)}
                style={{ width: "30px", height: "30px", border: "none", borderRadius: "50%", cursor: "pointer" }}
              />
            </label>
          </div>
        </div>

        {error && <p className="settings-error" role="alert">{t(error)}</p>}

        <div className="settings-confirm-actions">
          <button type="button" onClick={onCancel} disabled={busy}>{t("Cancel")}</button>
          <button type="submit" className="settings-primary" disabled={busy || !draftName.trim()}>
            {t(busy ? "Saving…" : "Save Changes")}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function AppSettings({
  preferences,
  onPreferenceChange,
  storageError,
  people,
  peopleError,
  peopleReady,
  onAddPerson,
  onUpdatePerson,
  onRemovePerson,
  onRefresh,
  version,
  onOpenAccounts
}) {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
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

  const handleUpdatePersonSubmit = async (updatedPerson) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // Save avatar & color customization
      savePersonCustomization(updatedPerson.id, {
        avatar: updatedPerson.avatar,
        color: updatedPerson.color,
        name: updatedPerson.name
      });

      if (onUpdatePerson) {
        await onUpdatePerson(updatedPerson);
      }
      setNotice(`${updatedPerson.name} updated.`);
      setEditingPerson(null);
    } catch (err) {
      setError(err.message || "Could not update person. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true); setNotice(""); setError("");
    try { await onRefresh(); setNotice("Latest data loaded."); }
    catch { setError("Could not refresh all data. Check your connection and try again."); }
    finally { setRefreshing(false); }
  };

  const visibleCards = preferences.visibleCards || { primary: true, apollo: true, telebirr: true };
  const handleCardToggle = (cardKey, nextChecked) => {
    const isCurrentlyChecked = visibleCards[cardKey] !== false;
    const currentActiveCount = ["primary", "apollo", "telebirr"].filter(k => visibleCards[k] !== false).length;

    if (!nextChecked && isCurrentlyChecked && currentActiveCount <= 1) {
      setError("At least one card must stay enabled.");
      return;
    }
    setError("");
    const nextCards = { ...visibleCards, [cardKey]: nextChecked };
    onPreferenceChange("visibleCards", nextCards);
  };

  return (
    <section className="app-settings" aria-labelledby="settings-heading">
      <header className="settings-heading"><h1 id="settings-heading">{t("Settings")}</h1></header>
      <AccountSummary onOpen={onOpenAccounts} />

      {/* Choose which cards to display on balance */}
      <section className="settings-card settings-cards-display">
        <h2><FiCreditCard aria-hidden="true" />{t(" Cards to display")}</h2>
        <p className="settings-caption">{t("Choose which cards to display on your balance screen.")}</p>
        {[
          ["primary", "Primary bank card", "Show the main Bank of Abyssinia receipt ledger balance."],
          ["apollo", "Apollo SMS card", "Show the live SMS balance and sync state."],
          ["telebirr", "Telebirr card", "Show your Telebirr balance card (300 ETB)."]
        ].map(([key, label, description]) => (
          <label className="settings-toggle-row" key={key}>
            <span><strong>{t(label)}</strong><small>{t(description)}</small></span>
            <input
              type="checkbox"
              role="switch"
              checked={visibleCards[key] !== false}
              onChange={(e) => handleCardToggle(key, e.target.checked)}
            />
          </label>
        ))}
      </section>

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

      <details className="settings-card settings-people" open>
        <summary><span><FiUsers aria-hidden="true" />{t(" People ")}<small>{t(people.length)}</small></span><span className="settings-chevron" aria-hidden="true"><FiChevronDown /></span></summary>
        <p className="settings-caption">{t("People in your transaction dropdowns. Changes are shared across the account.")}</p>
        {peopleError && <p className="settings-error" role="alert">{t(peopleError)}{t(" Use Refresh data below to retry.")}</p>}
        {!peopleReady && !peopleError && <p className="settings-caption">{t("Loading people…")}</p>}
        <ul className="settings-people-list">
          {people.map(person => (
            <li key={person.id}>
              <ProfilePhoto personId={person.id} name={person.name} className={`settings-avatar ${person.class || "avatar-other"}`} />
              <span className="settings-person-name">
                <strong>{t(person.id === profile?.person_id ? profile.name : person.name)}</strong>
                <small>{t(person.role)}</small>
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button
                  type="button"
                  className="settings-edit"
                  aria-label={t(`Edit ${person.name}`)}
                  title={t("Edit person")}
                  disabled={!peopleReady || Boolean(peopleError)}
                  onClick={() => { setError(""); setNotice(""); setEditingPerson(person); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", color: "#6b7280" }}
                >
                  <FiEdit2 aria-hidden="true" size={16} />
                </button>
                <button
                  type="button"
                  className="settings-remove"
                  aria-label={t(`Remove ${person.name}`)}
                  disabled={!peopleReady || Boolean(peopleError)}
                  onClick={() => { setError(""); setNotice(""); setAction({ type: "remove", person }); }}
                >
                  <FiTrash2 aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
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

      {!action && !editingPerson && error && <p className="settings-error" role="alert">{t(error)}</p>}
      {notice && <p className="settings-notice" role="status">{t(notice)}</p>}
      <p className="settings-version">{t("Bank Tracker · Version ")}{t(version)}</p>

      {action && <PersonConfirmation action={action} busy={busy} error={error} onCancel={() => { if (!busy) { setAction(null); setError(""); } }} onConfirm={confirm} />}
      {editingPerson && (
        <EditPersonDialog
          person={editingPerson}
          busy={busy}
          error={error}
          onCancel={() => { if (!busy) { setEditingPerson(null); setError(""); } }}
          onSave={handleUpdatePersonSubmit}
        />
      )}
    </section>
  );
}
