import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { translations } from "./translations";

// Retrieve saved language from localStorage or default to 'it'
const savedLang = typeof window !== "undefined"
  ? (localStorage.getItem("app-language") as "it" | "en" | null)
  : null;

i18n
  .use(initReactI18next)
  .init({
    resources: {
      it: { translation: translations.it },
      en: { translation: translations.en },
    },
    lng: savedLang ?? "it", // default Italian
    fallbackLng: "it",
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper to change language and persist
export function setLanguage(lang: "it" | "en") {
  i18n.changeLanguage(lang);
  localStorage.setItem("app-language", lang);
}

export function getLanguage(): "it" | "en" {
  return (i18n.language as "it" | "en") ?? "it";
}
