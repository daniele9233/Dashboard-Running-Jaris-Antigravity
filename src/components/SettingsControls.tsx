import { useTranslation } from "react-i18next";
import { Globe, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { setLanguage } from "../i18n";

/**
 * Combined Language + Theme toggle widget for the top header.
 * Shows a segmented language switcher and a sun/moon theme toggle.
 */
export function SettingsControls() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const currentLang = (i18n.language as "it" | "en") ?? "it";

  return (
    <div className="flex items-center gap-3">
      {/* Language switcher */}
      <div
        className="flex items-center rounded-lg border p-0.5"
        style={{
          backgroundColor: "var(--app-input-bg)",
          borderColor: "var(--app-border)",
        }}
        title={t("header.language")}
      >
        <Globe
          className="w-3.5 h-3.5 ml-1.5 mr-0.5"
          style={{ color: "var(--app-text-muted)" }}
        />
        {(["it", "en"] as const).map((lang) => {
          const isActive = currentLang === lang;
          return (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className="px-2 py-1 text-[10px] font-black tracking-wider uppercase rounded transition-colors"
              style={{
                backgroundColor: isActive ? "var(--app-accent)" : "transparent",
                color: isActive ? "#000" : "var(--app-text-muted)",
              }}
            >
              {lang}
            </button>
          );
        })}
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors"
        style={{
          backgroundColor: "var(--app-input-bg)",
          borderColor: "var(--app-border)",
          color: "var(--app-text-muted)",
        }}
        title={theme === "dark" ? t("header.light") : t("header.dark")}
        aria-label={theme === "dark" ? t("header.light") : t("header.dark")}
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
}
