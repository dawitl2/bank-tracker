import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const API = "https://ywplzexakisliebyjtyf.supabase.co/rest/v1/rpc";
const KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";
const STORAGE_KEY = "bank-tracker:profile-session:v1";
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
  let data;
  try { data = await response.json(); } catch { throw new Error("Profile sign-in is unavailable. Please try again later."); }
  if (!response.ok) throw new Error("Profile sign-in is unavailable. Please try again later.");
  if (data?.error) throw new Error(data.error === "locked" ? "Too many attempts. Try again in one minute." : "Incorrect username or password.");
  return data;
}

export function ProfileProvider({ children }) {
  const token = useRef(null);
  const generation = useRef(0);
  const expiryTimer = useRef(null);
  const signingIn = useRef(false);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const clear = useCallback(() => {
    generation.current += 1;
    token.current = null;
    window.clearTimeout(expiryTimer.current);
    setProfile(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Memory-only sessions still work. */ }
    // Profile access never writes the guest unlock flags. Clear any older ones
    // on sign-out so the next guest must use the original password prompts.
    try { localStorage.removeItem("apollo_visibility_day"); localStorage.removeItem("interest_visibility_day"); } catch { /* Storage may be unavailable. */ }
    window.dispatchEvent(new Event(PROFILE_SIGNED_OUT));
  }, []);
  const install = useCallback(data => {
    const expires = Date.parse(data?.expires_at);
    if (!data?.profile || !Number.isFinite(expires) || expires <= Date.now()) { clear(); return false; }
    setProfile(data.profile);
    window.clearTimeout(expiryTimer.current);
    expiryTimer.current = window.setTimeout(clear, expires - Date.now());
    return true;
  }, [clear]);
  useEffect(() => {
    let active = true;
    try { token.current = sessionStorage.getItem(STORAGE_KEY); } catch { /* Continue as a guest. */ }
    const validate = async () => {
      if (signingIn.current) return;
      if (!token.current) { if (active) setChecking(false); return; }
      const version = ++generation.current;
      try {
        const data = await rpc("app_profile_session", { p_token: token.current });
        if (active && version === generation.current) install(data);
      } catch { if (active && version === generation.current) setProfile(null); }
      finally { if (active) setChecking(false); }
    };
    validate();
    window.addEventListener("focus", validate);
    return () => { active = false; generation.current += 1; window.clearTimeout(expiryTimer.current); window.removeEventListener("focus", validate); };
  }, [install]);
  const signIn = async (username, password) => {
    signingIn.current = true;
    const version = ++generation.current;
    try {
      const data = await rpc("app_profile_sign_in", { p_username: username.trim(), p_password: password });
      if (version !== generation.current) throw new Error("Profile sign-in is unavailable. Please try again later.");
      if (!/^[a-f0-9]{64}$/.test(data?.token || "") || !install(data)) throw new Error("Profile sign-in is unavailable. Please try again later.");
      token.current = data.token;
      try { sessionStorage.setItem(STORAGE_KEY, data.token); } catch { /* Keep the session in memory for this tab. */ }
    } finally { signingIn.current = false; }
  };
  const signOut = async () => {
    const previousToken = token.current;
    clear();
    if (previousToken) await rpc("app_profile_sign_out", { p_token: previousToken });
  };
  return <ProfileContext.Provider value={{ profile, checking, signIn, signOut }}>{children}</ProfileContext.Provider>;
}
