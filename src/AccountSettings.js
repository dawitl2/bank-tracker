import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiArrowLeft, FiCamera, FiChevronRight, FiLogOut, FiShield, FiUser, FiX } from "react-icons/fi";
import { useLanguage, LocalizedTextInput } from "./Language";
import { useProfile } from "./ProfileSession";
import "./AccountSettings.css";

export function ProfilePhoto({ personId = "dawit", className = "", name = "" }) {
  const { profile } = useProfile();
  const { t } = useLanguage();
  if (personId !== "dawit") return <span className={className}>{t(name).slice(0,1)}</span>;
  return <img className={`profile-photo ${className}`} src={profile?.avatar || "/profiles/dawit.jpg"}
    alt={t("Profile photo")} onError={event => { if (event.currentTarget.getAttribute("src") !== "/profiles/dawit.jpg") event.currentTarget.src = "/profiles/dawit.jpg"; }} />;
}

export function AccountDialog({ title, description, busy, onClose, children }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = "hidden";
    dialog.querySelector('input:not([type="file"])')?.focus();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return createPortal(<dialog ref={ref} className="account-dialog" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2 id={titleId}>{t(title)}</h2><button type="button" className="account-icon-button" aria-label={t("Close")} disabled={busy} onClick={onClose}><FiX /></button></header>
    {description && <p id={descriptionId} className="account-dialog-caption">{t(description)}</p>}
    {children}
  </dialog>, document.body);
}

export function AccountSummary({ onOpen }) {
  const { t } = useLanguage();
  const { profile, checking, remembered } = useProfile();
  return <button type="button" className="account-summary" onClick={onOpen}>
    {profile ? <ProfilePhoto /> : <span className="account-empty-avatar"><FiUser /></span>}
    <span><strong>{profile ? t(profile.name) : t(checking ? "Checking session…" : remembered ? "Account offline" : "No account")}</strong>
      <small>{t(profile ? "Profile and device access" : "Add an account to this device")}</small></span>
    <FiChevronRight className="account-chevron" aria-hidden="true" />
  </button>;
}

async function readPhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Choose a JPG, PNG or WebP photo under 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const photo = new Image(); photo.src = url; await photo.decode();
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 320;
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff"; context.fillRect(0,0,320,320);
    const side = Math.min(photo.width, photo.height);
    context.drawImage(photo, (photo.width-side)/2, (photo.height-side)/2, side, side, 0,0,320,320);
    const result = canvas.toDataURL("image/jpeg", .82);
    if (result.length > 150000) throw new Error("Choose a smaller photo.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}

export default function AccountSettings({ onBack }) {
  const { t } = useLanguage();
  const { profile, checking, remembered, signIn, signOut, updateProfile } = useProfile();
  const [dialog, setDialog] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", avatar: "/profiles/dawit.jpg" });
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const photoVersion = useRef(0);
  useEffect(() => () => { photoVersion.current += 1; }, []);
  useEffect(() => {
    if (!profile && (dialog === "edit" || dialog === "save" || dialog === "signout")) { setDialog(null); setPassword(""); }
  }, [profile, dialog]);
  const close = () => { photoVersion.current += 1; setPhotoBusy(false); setDialog(null); setPassword(""); setError(""); };
  const open = action => { setError(""); setNotice(""); setPassword(""); setUsername(""); setDialog(action); };
  const login = async event => {
    event.preventDefault(); if (busy || checking) return;
    setBusy(true); setError("");
    try { await signIn(username,password); setPassword(""); setUsername(""); setDialog(null); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const edit = () => {
    setDraft({ name: profile.name, email: profile.email || "", avatar: profile.avatar || "/profiles/dawit.jpg" }); open("edit");
  };
  const replacePhoto = async event => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    const version = ++photoVersion.current; setPhotoBusy(true); setError("");
    try { const avatar = await readPhoto(file); if (version === photoVersion.current) setDraft(value => ({...value,avatar})); }
    catch (failure) { if (version === photoVersion.current) setError(failure.message || "The photo could not be read. Try another photo."); }
    finally { if (version === photoVersion.current) setPhotoBusy(false); }
  };
  const save = async () => {
    if (busy) return; setBusy(true); setError("");
    try { await updateProfile({...draft,name:draft.name.trim(),email:draft.email.trim()}); setDialog(null); setNotice("Profile updated."); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    if (busy) return; setBusy(true); setError("");
    try { await signOut(); setNotice("Signed out on this device."); }
    catch { setNotice("Signed out on this device. Server sign-out will retry when connected."); }
    finally { setBusy(false); setDialog(null); }
  };
  return <section className="accounts-page" aria-labelledby="accounts-title">
    <header className="accounts-heading"><button type="button" className="account-icon-button" aria-label={t("Back to Settings")} onClick={onBack}><FiArrowLeft /></button><h1 id="accounts-title">{t("Accounts")}</h1></header>
    {profile ? <>
      <section className="profile-identity"><ProfilePhoto /><h2>{t(profile.name)}</h2><p>@{profile.username}</p><span className="account-status">{t("Signed in on this device")}</span></section>
      <section className="account-details"><div><span>{t("Username")}</span><strong>{profile.username}</strong></div><div><span>{t("Display name")}</span><strong>{t(profile.name)}</strong></div><div><span>{t("Email")}</span><strong>{profile.email || t("Not added")}</strong></div>
        <button type="button" className="account-row-button" onClick={edit}><span>{t("Edit profile")}</span><FiChevronRight aria-hidden="true" /></button></section>
      <p className="account-access"><FiShield aria-hidden="true" /><span>{t("Apollo and Interest are available while signed in.")}<small>{t("This device stays signed in until you sign out.")}</small></span></p>
      <button type="button" className="account-signout" disabled={busy} onClick={() => open("signout")}><FiLogOut aria-hidden="true" />{t("Sign out")}</button>
    </> : <section className="account-empty"><span className="account-empty-avatar"><FiUser /></span><h2>{t(checking ? "Checking session…" : remembered ? "Account offline" : "No account")}</h2><p>{t(remembered ? "Connect to verify your saved account." : "Add your account to sign in on this device.")}</p><button type="button" className="account-primary" disabled={checking || busy} onClick={() => open("signin")}>{t("Add account")}</button></section>}
    {notice && <p className="account-notice" role="status">{t(notice)}</p>}
    {dialog === "signin" && <AccountDialog title="Add account" description="Sign in to an existing account. This device will remember you." busy={busy} onClose={close}>
      <form className="account-form" onSubmit={login}>
        <label htmlFor="account-username">{t("Username")}</label><input id="account-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" value={username} onChange={event => setUsername(event.target.value)} required maxLength={60} autoFocus disabled={busy} />
        <label htmlFor="account-password">{t("Password")}</label><input id="account-password" name="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={72} disabled={busy} />
        {error && <p className="account-error" role="alert">{t(error)}</p>}
        <button type="submit" className="account-primary" disabled={busy}>{t(busy ? "Signing in…" : "Sign in")}</button>
      </form>
    </AccountDialog>}
    {dialog === "edit" && <AccountDialog title="Edit profile" description="Your display details. Your username and transactions stay the same." busy={busy || photoBusy} onClose={close}>
      <form className="account-form" onSubmit={event => { event.preventDefault(); if (!photoBusy) { setError(""); setDialog("save"); } }}>
        <div className="account-photo-editor"><img src={draft.avatar} className="profile-photo" alt={t("Profile photo")} /><label className="account-photo-button"><FiCamera aria-hidden="true" />{t(photoBusy ? "Reading photo…" : "Replace photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={replacePhoto} disabled={photoBusy} /></label></div>
        <label htmlFor="account-name">{t("Display name")}</label><LocalizedTextInput id="account-name" value={draft.name} onChange={event => setDraft(value => ({...value,name:event.target.value}))} required maxLength={60} autoFocus />
        <label htmlFor="account-email">{t("Email")} <span>{t("(optional)")}</span></label><input id="account-email" type="email" autoComplete="email" value={draft.email} onChange={event => setDraft(value => ({...value,email:event.target.value}))} maxLength={254} />
        {error && <p className="account-error" role="alert">{t(error)}</p>}
        <button type="submit" className="account-primary" disabled={photoBusy || !draft.name.trim()}>{t("Review changes")}</button>
      </form>
    </AccountDialog>}
    {dialog === "save" && <AccountDialog title="Save profile changes?" description="These display details will appear on your account and in People." busy={busy} onClose={close}>
      <div className="account-review"><img className="profile-photo" src={draft.avatar} alt={t("Profile photo")} /><div><strong>{t(draft.name)}</strong><small>{draft.email || t("No email added")}</small></div></div>
      {error && <p className="account-error" role="alert">{t(error)}</p>}
      <div className="account-actions"><button type="button" onClick={() => { setError(""); setDialog("edit"); }} disabled={busy}>{t("Back")}</button><button type="button" className="account-primary" onClick={save} disabled={busy}>{t(busy ? "Saving…" : "Save changes")}</button></div>
    </AccountDialog>}
    {dialog === "signout" && <AccountDialog title="Sign out of this device?" description="Apollo and Interest will need a password again. Your data stays saved." busy={busy} onClose={close}>
      <div className="account-actions"><button type="button" autoFocus disabled={busy} onClick={close}>{t("Cancel")}</button><button type="button" className="account-danger" onClick={leave} disabled={busy}>{t("Sign out")}</button></div>
    </AccountDialog>}
  </section>;
}
