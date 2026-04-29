import { useState } from "react";
import { Activity, Upload, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getStravaAuthUrl } from "../api";

/**
 * FirstRunOnboarding — gate mostrato quando l'utente non ha ancora corse
 * sincronizzate. Sostituisce la dashboard "vuota" piena di skeleton/dash che
 * comunicava nulla. Due CTA chiari: Connetti Strava / Importa Garmin CSV.
 *
 * Tutte le stringhe localizzate via i18n (namespace `onboarding`).
 */
export function FirstRunOnboarding({ onImportClick }: { onImportClick?: () => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleStravaConnect = async () => {
    setLoading(true);
    try {
      const res = await getStravaAuthUrl();
      if (res?.url) window.location.href = res.url;
    } catch (e) {
      console.error("[onboarding] Strava auth URL failed:", e);
      setLoading(false);
    }
  };

  return (
    <main
      className="flex-1 flex items-center justify-center p-8 overflow-y-auto"
      style={{ color: "var(--app-text)" }}
    >
      <div className="max-w-2xl w-full">
        {/* Hero */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{
              backgroundColor: "var(--app-accent)",
              boxShadow: "0 0 40px var(--app-accent-soft)",
            }}
          >
            <Activity className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-3">
            {t("onboarding.welcome")}
          </h1>
          <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
            {t("onboarding.tagline")}
          </p>
        </div>

        {/* CTA Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strava */}
          <button
            type="button"
            onClick={handleStravaConnect}
            disabled={loading}
            className="group relative rounded-2xl border p-6 text-left transition-all hover:border-[#FC4C02]/60 disabled:opacity-50 disabled:cursor-wait"
            style={{
              backgroundColor: "var(--app-bg-alt)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white"
                style={{ backgroundColor: "#FC4C02" }}
              >
                S
              </div>
              <div>
                <div className="font-black text-base">{t("onboarding.stravaTitle")}</div>
                <div className="text-[10px] tracking-wider uppercase" style={{ color: "var(--app-text-muted)" }}>
                  {t("onboarding.stravaSubtitle")}
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
              {t("onboarding.stravaDesc")}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold" style={{ color: "#FC4C02" }}>
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("onboarding.stravaConnecting")}
                </>
              ) : (
                <>{t("onboarding.stravaCta")} →</>
              )}
            </div>
          </button>

          {/* Garmin CSV */}
          <button
            type="button"
            onClick={onImportClick ?? (() => (window.location.href = "/activities"))}
            className="group relative rounded-2xl border p-6 text-left transition-all hover:border-[var(--app-accent)]"
            style={{
              backgroundColor: "var(--app-bg-alt)",
              borderColor: "var(--app-border)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "var(--app-input-bg)" }}
              >
                <Upload className="w-5 h-5" style={{ color: "var(--app-text)" }} />
              </div>
              <div>
                <div className="font-black text-base">{t("onboarding.garminTitle")}</div>
                <div className="text-[10px] tracking-wider uppercase" style={{ color: "var(--app-text-muted)" }}>
                  {t("onboarding.garminSubtitle")}
                </div>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--app-text-muted)" }}>
              {t("onboarding.garminDesc")}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold" style={{ color: "var(--app-accent)" }}>
              {t("onboarding.garminCta")} →
            </div>
          </button>
        </div>

        {/* Footer */}
        <p
          className="text-center text-[10px] mt-8 tracking-wider uppercase"
          style={{ color: "var(--app-text-dim)" }}
        >
          {t("onboarding.privacyNote")}
        </p>
      </div>
    </main>
  );
}
