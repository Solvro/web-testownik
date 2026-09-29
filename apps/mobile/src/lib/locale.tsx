import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { storage } from "./storage";

// iOS offers a per-app language in the Settings app, so the app follows it.
const systemOnly = Platform.OS === "ios";

export type Language = "pl" | "en";
export type LanguagePreference = Language | "system";
const deviceLanguage = (): Language =>
  Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("pl")
    ? "pl"
    : "en";
const Context = createContext({
  language: "pl" as Language,
  preference: "system" as LanguagePreference,
  setPreference: async (_: LanguagePreference) => {},
  t: (pl: string, _en: string) => pl,
});
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setLanguage] = useState<LanguagePreference>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void storage
      .read<LanguagePreference>("language", "system")
      .then((value) => {
        setLanguage(["pl", "en"].includes(value) ? value : "system");
      })
      .catch(() => setLanguage("system"))
      .finally(() => setReady(true));
  }, []);
  const language =
    preference === "system" || systemOnly ? deviceLanguage() : preference;
  const value = useMemo(
    () => ({
      language,
      preference,
      setPreference: async (next: LanguagePreference) => {
        await storage.write("language", next);
        setLanguage(next);
      },
      t: (pl: string, en: string) => (language === "pl" ? pl : en),
    }),
    [language, preference],
  );
  return (
    <Context.Provider value={value}>{ready ? children : null}</Context.Provider>
  );
}
export const useLocale = () => useContext(Context);
