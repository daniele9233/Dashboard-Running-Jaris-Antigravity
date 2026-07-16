import { useTranslation } from "react-i18next";
import { Medal, Lock, Play } from "lucide-react";
import { CelebrationStudio } from "./celebrations/CelebrationStudio";
import { useBadges } from "./celebrations/BadgeProvider";
import { CELEBRATIONS, CELEBRATION_GROUPS } from "./celebrations/celebrationRegistry";
import { isAutoDetectable } from "./celebrations/badgeRules";

/**
 * BadgesView — bacheca dei traguardi.
 *
 * Mostra cosa hai sbloccato (a colori, cliccabile per rivedere la celebrazione)
 * e cosa resta da sbloccare (in silhouette col criterio). Gli sblocchi arrivano
 * dopo ogni sync, valutati sulle corse nuove (no storico). Sotto resta il
 * Celebration Studio come simulatore per provare le animazioni.
 */

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export function BadgesView() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { state, unlockedIds, replay } = useBadges();
  const total = CELEBRATIONS.length;
  const got = unlockedIds.size;
  const pct = total > 0 ? Math.round((got / total) * 100) : 0;

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">
        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              {t("badges.title1")} <span className="text-[#C0FF00]">{t("badges.title2")}</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              {t("badges.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Medal className="w-5 h-5 text-[#C0FF00]" />
            <span className="text-[10px] font-black tracking-[0.25em] uppercase">{t("badges.hallOfFame")}</span>
          </div>
        </div>

        {/* ── RIEPILOGO ── */}
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-black/40 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-black text-[#C0FF00] tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{got}</span>
                <span className="text-2xl font-black text-gray-600">/ {total}</span>
              </div>
              <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mt-1">{t("badges.unlockedCount")}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-white tabular-nums">{pct}%</div>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-600">{t("badges.completed")}</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#C0FF00] to-[#22D3EE] transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          {got === 0 && (
            <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
              {t("badges.emptyState")}
            </p>
          )}
        </div>

        {/* ── COLLEZIONE PER CATEGORIA ── */}
        {CELEBRATION_GROUPS.map((group) => {
          const defs = CELEBRATIONS.filter((c) => c.group === group);
          const gotInGroup = defs.filter((d) => unlockedIds.has(d.id)).length;
          return (
            <section key={group} className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">{group}</h2>
                <span className="text-[10px] font-black text-gray-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {gotInGroup}/{defs.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {defs.map((def) => {
                  const unlocked = unlockedIds.has(def.id);
                  const at = state?.unlocked[def.id]?.at;

                  if (unlocked) {
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => replay(def)}
                        className="group relative text-left rounded-2xl border p-4 overflow-hidden transition-colors"
                        style={{ borderColor: `${def.accent}55`, background: `linear-gradient(180deg, ${def.accent}14, rgba(0,0,0,0.4))` }}
                      >
                        <div aria-hidden className="absolute top-0 left-0 right-0 h-[2px]"
                          style={{ background: `linear-gradient(90deg, ${def.accent}, ${def.accent2}, transparent)` }} />
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: def.accent, boxShadow: `0 0 8px ${def.accent}` }} />
                          <Play className="w-3.5 h-3.5 text-gray-500 group-hover:text-white transition-colors" />
                        </div>
                        <div className="text-[12px] font-black uppercase tracking-wide leading-tight" style={{ color: def.accent }}>
                          {def.title}
                        </div>
                        <div className="text-[9px] text-gray-500 mt-1.5">
                          {at ? t("badges.unlockedOn", { date: fmtDate(at, locale) }) : t("badges.unlocked")}
                        </div>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={def.id}
                      className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 overflow-hidden opacity-60"
                      title={isAutoDetectable(def.id) ? def.mechanic : t("badges.notAutoDetect")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-2 h-2 rounded-full bg-gray-700" />
                        <Lock className="w-3.5 h-3.5 text-gray-700" />
                      </div>
                      <div className="text-[12px] font-black uppercase tracking-wide text-gray-500 leading-tight">
                        {def.title}
                      </div>
                      <div className="text-[9px] text-gray-600 mt-1.5 leading-snug">{def.mechanic}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* ── SIMULATORE (dev) ── */}
        <div className="pt-2">
          <p className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-700 mb-2 px-1">
            {t("badges.simulatorNote")}
          </p>
          <CelebrationStudio />
        </div>
      </div>
    </main>
  );
}
