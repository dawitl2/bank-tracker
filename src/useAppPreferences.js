import { useEffect, useState } from "react";

const STORAGE_KEY = "bank-tracker:pwa-preferences:v1";
const defaults = {
  calculator: true,
  compactRows: false,
  reduceMotion: false,
  language: "en",
  visibleCards: { primary: true, apollo: true, telebirr: true }
};
const PREFERENCE_EVENT = "bank-tracker:app-preferences";
const sanitizeVisibleCards = (cards) => {
  const primary = cards?.primary !== false;
  const apollo = cards?.apollo !== false;
  const telebirr = cards?.telebirr !== false;
  if (!primary && !apollo && !telebirr) {
    return { primary: true, apollo: false, telebirr: false };
  }
  return { primary, apollo, telebirr };
};
const sanitize = saved => Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
  key,
  key === "language"
    ? saved?.language === "am" ? "am" : "en"
    : key === "visibleCards"
    ? sanitizeVisibleCards(saved?.visibleCards)
    : typeof saved?.[key] === "boolean" ? saved[key] : value
]));
const readPreferences = () => {
  try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return defaults; }
};

export default function useAppPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    const changed = event => setPreferences(sanitize(event.detail));
    const stored = event => { if (event.key === STORAGE_KEY) setPreferences(readPreferences()); };
    window.addEventListener(PREFERENCE_EVENT, changed);
    window.addEventListener("storage", stored);
    return () => { window.removeEventListener(PREFERENCE_EVENT, changed); window.removeEventListener("storage", stored); };
  }, []);
  const [storageError, setStorageError] = useState("");
  const updatePreference = (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError("");
    } catch { setStorageError("Your browser could not save preferences. They will last until you close the app."); }
    window.dispatchEvent(new CustomEvent(PREFERENCE_EVENT, { detail: next }));
  };
  return { preferences, updatePreference, storageError };
}
