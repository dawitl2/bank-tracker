import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useAppPreferences from "./useAppPreferences";
import amharic from "./amharic";

const dictionary = new Map(Object.entries(amharic).map(([english, translated]) => [english.toLowerCase(), translated]));
const phrases = Object.keys(amharic).filter(key => /[a-z]/i.test(key)).sort((a, b) => b.length - a.length);
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrasePattern = new RegExp(`(?<![a-z0-9])(${phrases.map(escapePattern).join("|")})(?![a-z0-9])`, "gi");

// Translate rendered copy, never stored IDs, form values, routes or API payloads.
export function translateUi(value, language = "en") {
  if (language !== "am" || typeof value !== "string" || !value.trim()) return value;
  if (/https?:\/\/|^(?:FT\w+|SMS-[\w-]+)$/i.test(value)) return value;
  const text = value.trim();
  const translated = dictionary.get(text.toLowerCase()) || text.replace(phrasePattern, match => dictionary.get(match.toLowerCase()));
  return value.replace(text, () => translated);
}

const LanguageContext = createContext({ language: "en", t: value => value });
export const useLanguage = () => useContext(LanguageContext);

// Display a translated narrative while idle; edit the original saved text.
// Merely focusing or changing languages must never change a draft's value.
export function LocalizedTextInput({ value, onFocus, onBlur, ...props }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  return <input {...props} value={editing ? value : t(value)}
    onFocus={event => { setEditing(true); onFocus?.(event); }}
    onBlur={event => { setEditing(false); onBlur?.(event); }} />;
}

export function LanguageProvider({ children }) {
  const { preferences } = useAppPreferences();
  const [mobile, setMobile] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 900);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const language = mobile ? preferences.language : "en";
  const context = useMemo(() => ({ language, t: value => translateUi(value, language) }), [language]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}
