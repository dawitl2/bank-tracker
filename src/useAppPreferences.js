import { useState } from "react";

const STORAGE_KEY = "bank-tracker:pwa-preferences:v1";
const defaults = { calculator: true, compactRows: false, reduceMotion: false };

export default function useAppPreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
        [key, typeof saved?.[key] === "boolean" ? saved[key] : value]));
    } catch { return defaults; }
  });
  const [storageError, setStorageError] = useState("");
  const updatePreference = (key, value) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError("");
    } catch { setStorageError("Your browser could not save preferences. They will last until you close the app."); }
  };
  return { preferences, updatePreference, storageError };
}
