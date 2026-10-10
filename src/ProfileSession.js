import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const API = "https://ywplzexakisliebyjtyf.supabase.co/rest/v1/rpc";
const KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";
const STORAGE_KEY = "bank-tracker:profile-session:v1";
const REVOCATION_KEY = "bank-tracker:profile-revocations:v1";
export const PROFILE_SIGNED_OUT = "bank-tracker:profile-signed-out";
const ProfileContext = createContext({ profile: null, checking: false });
export const useProfile = () => useContext(ProfileContext);
export const profileAccess = (profile, permission) => profile?.username === "dawit" && profile[permission] === true;

async function rpc(name, body) {
  let response;
  try {
    response = await fetch(`${API}/${name}`, {
      method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
  } catch { throw new Error("Could not sign in. Check your connection and try again."); }
  // PostgREST returns no body for a successful void RPC (sign-out).
  if (response.ok && response.status === 204) return null;
  let data;
  try { data = await response.json(); } catch { throw new Error("Profile sign-in is unavailable. Please try again later."); }
  if (!response.ok) throw new Error("Profile sign-in is unavailable. Please try again later.");
  if (data?.error) throw new Error(data.error === "locked" ? "Too many attempts. Try again in one minute." : data.error === "invalid" ? "Check your profile details and photo." : "Incorrect username or password.");
  return data;
}

async function revokePending() {
  let pending;
  try { pending = JSON.parse(localStorage.getItem(REVOCATION_KEY) || "[]"); } catch { return; }
  if (!Array.isArray(pending)) return;
  for (const previous of pending.filter(value => /^[a-f0-9]{64}$/.test(value))) {
    try {
      await rpc("app_profile_sign_out", { p_token: previous });
      const current = JSON.parse(localStorage.getItem(REVOCATION_KEY) || "[]");
      localStorage.setItem(REVOCATION_KEY, JSON.stringify(current.filter(value => value !== previous)));
    } catch { /* Retry when this device next reconnects. */ }
  }
}

export function ProfileProvider({ children }) {
  const token = useRef(null);
  const generation = useRef(0);
  const expiryTimer = useRef(null);
  const signingIn = useRef(false);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [remembered, setRemembered] = useState(false);
  const clear = useCallback(() => {
    generation.current += 1;
    token.current = null;
    window.clearTimeout(expiryTimer.current);
    setProfile(null);
    setRemembered(false);
    setChecking(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Memory-only sessions still work. */ }
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Memory-only sessions still work. */ }
    // Profile access never writes the guest unlock flags. Clear any older ones
    // on sign-out so the next guest must use the original password prompts.
    try { localStorage.removeItem("apollo_visibility_day"); localStorage.removeItem("interest_visibility_day"); } catch { /* Storage may be unavailable. */ }
    window.dispatchEvent(new Event(PROFILE_SIGNED_OUT));
  }, []);
  const install = useCallback(data => {
    const expires = Date.parse(data?.expires_at);
    if (!profileAccess(data?.profile, "apollo_access") || (data?.persistent !== true && (!Number.isFinite(expires) || expires <= Date.now()))) { clear(); return false; }
    setProfile(data.profile);
    setRemembered(true);
    window.clearTimeout(expiryTimer.current);
    if (data.persistent !== true) expiryTimer.current = window.setTimeout(clear, Math.min(expires - Date.now(), 2147483647));
    return true;
  }, [clear]);
  useEffect(() => {
    let active = true;
    try {
      token.current = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (token.current) localStorage.setItem(STORAGE_KEY, token.current);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* Continue with any available memory session. */ }
    setRemembered(Boolean(token.current));
    const validate = async () => {
      if (signingIn.current) return;
      if (!token.current) { if (active) setChecking(false); return; }
      const version = ++generation.current;
      try {
        const data = await rpc("app_profile_session", { p_token: token.current });
        if (active && version === generation.current) install(data);
      } catch { if (active && version === generation.current) setProfile(null); }
      finally { if (active && version === generation.current) setChecking(false); }
    };
    const storageChanged = event => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      let next = null;
      try { next = localStorage.getItem(STORAGE_KEY); } catch { return; }
      if (next === token.current) return;
      if (!next) { clear(); return; }
      generation.current += 1; token.current = next; setProfile(null); setRemembered(true); setChecking(true); validate();
    };
    const reconnect = () => { revokePending(); validate(); };
    validate();
    revokePending();
    window.addEventListener("focus", validate);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("online", reconnect);
    return () => { active = false; generation.current += 1; window.clearTimeout(expiryTimer.current); window.removeEventListener("focus", validate); window.removeEventListener("storage", storageChanged); window.removeEventListener("online", reconnect); };
  }, [install, clear]);
  const signIn = async (username, password) => {
    signingIn.current = true;
    const version = ++generation.current;
    try {
      const data = await rpc("app_profile_sign_in", { p_username: username.trim(), p_password: password });
      if (version !== generation.current) throw new Error("Profile sign-in is unavailable. Please try again later.");
      if (!/^[a-f0-9]{64}$/.test(data?.token || "") || !install(data)) throw new Error("Profile sign-in is unavailable. Please try again later.");
      token.current = data.token;
      try { localStorage.setItem(STORAGE_KEY, data.token); } catch { /* Keep the session in memory for this tab. */ }
    } finally { signingIn.current = false; }
  };
  const signOut = async () => {
    const previousToken = token.current;
    if (previousToken) {
      try {
        const pending = JSON.parse(localStorage.getItem(REVOCATION_KEY) || "[]");
        localStorage.setItem(REVOCATION_KEY, JSON.stringify([...new Set([...pending, previousToken])]));
      } catch { /* Still revoke directly when storage is unavailable. */ }
    }
    clear();
    if (previousToken) {
      await rpc("app_profile_sign_out", { p_token: previousToken });
      await revokePending();
    }
  };
  const updateProfile = async details => {
    const previousToken = token.current;
    const data = await rpc("app_profile_update", { p_token: previousToken, p_name: details.name, p_email: details.email, p_avatar: details.avatar });
    if (previousToken !== token.current) throw new Error("Sign in again to edit your profile.");
    // A focus check may run while a photo/editor is open. Do not let its older
    // response overwrite a successful save or turn it into a sign-in error.
    generation.current += 1;
    if (!install(data)) throw new Error("Sign in again to edit your profile.");
    setChecking(false);
  };
  return <ProfileContext.Provider value={{ profile, checking, remembered, signIn, signOut, updateProfile }}>{children}</ProfileContext.Provider>;
}
