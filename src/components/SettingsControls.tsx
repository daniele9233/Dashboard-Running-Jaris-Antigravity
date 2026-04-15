import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { setLanguage } from "../i18n";

/**
 * Language switcher widget for the top header (IT / EN).
 */
export function SettingsControls() {
  const { t, i18n } = useTranslation();
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
    </div>
  );
}
