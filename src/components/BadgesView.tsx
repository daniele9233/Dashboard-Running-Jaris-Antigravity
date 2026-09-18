import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Medal, Lock, Play, RefreshCw, Search, Sparkles, Target } from "lucide-react";
import { useBadges } from "./celebrations/BadgeProvider";
import { CELEBRATIONS, CELEBRATION_GROUPS, type CelebrationDef } from "./celebrations/celebrationRegistry";
import { badgeProgressMap, type BadgeProgress } from "./celebrations/badgeProgress";
import { BRAND } from "../theme/tokens";
import { Button } from "./ui/Button";

/**
 * BACHECA DEI TRAGUARDI
 * ════════════════════════════════════════════════════════════════════════════
 * Prima era una griglia di cento serrande: sbloccato o chiuso, senza sfumature,
 * e con gli sblocchi che comparivano solo se passavi dal bottone "sincronizza".
 * Ora la valutazione la fa il provider a ogni corsa nuova (vedi BadgeProvider) e
 * questa pagina racconta tre cose che prima non diceva:
 *
 *   · quanti ne hai, per categoria, con l'anello di completamento;
 *   · quali sono a un passo — «940 / 1000 km» è un invito, «chiuso» non lo è;
 *   · quali hai preso per ultimi, in ordine di data.
 *
 * Il resto è filtro e ricerca, perché cento card senza filtro sono un muro.
 */

const LIME = BRAND;
const CYAN = "#22D3EE";
const MONO = "'JetBrains Mono', monospace";

function fmtDate(iso: string | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "en" ? "en-GB" : "it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale === "en" ? "en-GB" : "it-IT", { hour: "2-digit", minute: "2-digit" });
}

/** L'anello di completamento: un cerchio vale mille barre. */
function ProgressRing({ pct, size = 104 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id="badge-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={LIME} />
          <stop offset="100%" stopColor={CYAN} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff14" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#badge-ring)" strokeWidth={8}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        fill="#fff" style={{ fontFamily: MONO, fontSize: size * 0.26, fontWeight: 800 }}>
        {pct}%
      </text>
    </svg>
  );
}

/** La barra di avvicinamento su una card chiusa. */
function ProgressBar({ p }: { p: BadgeProgress }) {
  if (p.pct == null) return null;
  const pct = Math.round(p.pct * 100);
  return (
    <div className="mt-2">
      <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: pct >= 80 ? LIME : pct >= 45 ? CYAN : "#4B5563" }} />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-gray-500 truncate" style={{ fontFamily: MONO }}>{p.label}</span>
        <span className="text-[11px] font-black tabular-nums shrink-0"
          style={{ fontFamily: MONO, color: pct >= 80 ? LIME : "#878787" }}>{pct}%</span>
      </div>
    </div>
  );
}

type Filter = "all" | "unlocked" | "locked";

export function BadgesView() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { state, unlockedIds, runs, replay, checkNow, checkedAt, backfilled } = useBadges();

  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [checking, setChecking] = useState(false);

  const total = CELEBRATIONS.length;
  const got = unlockedIds.size;
  const pct = total > 0 ? Math.round((got / total) * 100) : 0;

  const progress = useMemo(
    () => (runs.length ? badgeProgressMap(runs, state?.baseline_run_ids ?? []) : {}),
    [runs, state?.baseline_run_ids],
  );

  /** I sei più vicini fra quelli chiusi: la sezione che dà una direzione. */
  const closest = useMemo(() => {
    return CELEBRATIONS
      .filter((d) => !unlockedIds.has(d.id))
      .map((d) => ({ def: d, p: progress[d.id] }))
      .filter((x): x is { def: CelebrationDef; p: BadgeProgress } => x.p != null && x.p.pct != null && x.p.pct > 0.25 && x.p.pct < 1)
      .sort((a, b) => (b.p.pct ?? 0) - (a.p.pct ?? 0))
      .slice(0, 6);
  }, [unlockedIds, progress]);

  /** Gli ultimi cinque sbloccati, dal più recente. */
  const latest = useMemo(() => {
    const u = state?.unlocked ?? {};
    return Object.entries(u)
      .map(([id, v]) => ({ def: CELEBRATIONS.find((c) => c.id === id), at: v?.at }))
      .filter((x): x is { def: CelebrationDef; at: string } => Boolean(x.def && x.at))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5);
  }, [state?.unlocked]);

  const onCheck = async () => {
    setChecking(true);
    try { await checkNow(); } finally { setChecking(false); }
  };

  const needle = q.trim().toLowerCase();
  const matches = (def: CelebrationDef) => {
    if (filter === "unlocked" && !unlockedIds.has(def.id)) return false;
    if (filter === "locked" && unlockedIds.has(def.id)) return false;
    if (needle && !`${def.title} ${def.mechanic}`.toLowerCase().includes(needle)) return false;
    return true;
  };

  const groups = group ? CELEBRATION_GROUPS.filter((g) => g === group) : CELEBRATION_GROUPS;
  const visibleCount = CELEBRATIONS.filter((d) => matches(d) && (!group || d.group === group)).length;

  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              {t("badges.title1")} <span className="text-brand">{t("badges.title2")}</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              {t("badges.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {checkedAt && (
              <span className="text-[11px] text-gray-600 tabular-nums hidden md:inline" style={{ fontFamily: MONO }}>
                {t("badges.checkedAt", { time: fmtTime(checkedAt, locale) })}
              </span>
            )}
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={checking} onClick={onCheck}>
              {checking ? t("badges.checking") : t("badges.recheck")}
            </Button>
            <div className="flex items-center gap-2 text-gray-500">
              <Medal className="w-5 h-5 text-brand" />
              <span className="text-[10px] font-black tracking-[0.25em] uppercase hidden sm:inline">{t("badges.hallOfFame")}</span>
            </div>
          </div>
        </div>

        {/* ── RIEPILOGO: anello, conteggio, ultimi sbloccati ── */}
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.03] to-black/40 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid gap-6 lg:grid-cols-[auto_1fr_1.1fr] lg:items-center">
            <ProgressRing pct={pct} />

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl md:text-6xl font-black text-brand tabular-nums" style={{ fontFamily: MONO }}>{got}</span>
                <span className="text-2xl font-black text-gray-600">/ {total}</span>
              </div>
              <div className="text-[10px] font-black tracking-[0.3em] uppercase text-gray-500 mt-1">{t("badges.unlockedCount")}</div>
              {backfilled != null && backfilled > 0 && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]"
                  style={{ borderColor: `${LIME}33`, background: `${LIME}0f`, color: LIME }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  {t("badges.backfilled", { count: backfilled })}
                </div>
              )}
              {got === 0 && (
                <p className="text-[11px] text-gray-500 mt-3 leading-relaxed max-w-md">{t("badges.emptyState")}</p>
              )}
              <p className="text-[11px] text-gray-600 mt-3 flex items-center gap-1.5 leading-relaxed max-w-md">
                <Play className="w-3 h-3 text-brand shrink-0" aria-hidden />
                {t("badges.previewHint")}
              </p>
            </div>

            {latest.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4">
                <div className="text-[10px] font-black tracking-[0.22em] uppercase text-gray-500 mb-3">{t("badges.latest")}</div>
                <div className="space-y-2">
                  {latest.map(({ def, at }) => (
                    <button key={def.id} type="button" onClick={() => replay(def)}
                      className="w-full flex items-center gap-2.5 text-left group">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: def.accent, boxShadow: `0 0 8px ${def.accent}` }} />
                      <span className="text-[11px] font-bold truncate group-hover:text-white transition-colors" style={{ color: def.accent }}>
                        {def.title}
                      </span>
                      <span className="ml-auto text-[11px] text-gray-600 shrink-0 tabular-nums" style={{ fontFamily: MONO }}>
                        {fmtDate(at, locale)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* barra per categoria: dove sei forte e dove no, in una riga */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {CELEBRATION_GROUPS.map((g) => {
              const defs = CELEBRATIONS.filter((c) => c.group === g);
              const n = defs.filter((d) => unlockedIds.has(d.id)).length;
              const p = defs.length ? Math.round((n / defs.length) * 100) : 0;
              return (
                <button key={g} type="button" onClick={() => setGroup(group === g ? null : g)}
                  className="text-left group/g"
                  aria-pressed={group === g}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className={`text-[10px] font-black tracking-[0.18em] uppercase transition-colors ${group === g ? "text-brand" : "text-gray-500 group-hover/g:text-gray-300"}`}>{g}</span>
                    <span className="text-[11px] font-black text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>{n}/{defs.length}</span>
                  </div>
                  <div className="h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${p}%`, background: group === g ? LIME : `${CYAN}aa` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CI SEI QUASI ── */}
        {closest.length > 0 && (
          <section className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">{t("badges.closest")}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {closest.map(({ def, p }) => {
                const pc = Math.round((p.pct ?? 0) * 100);
                return (
                  <button key={def.id} type="button" onClick={() => replay(def)}
                    className="text-left rounded-2xl border p-4 transition-colors hover:border-white/20"
                    style={{ borderColor: `${def.accent}2a`, background: `linear-gradient(180deg, ${def.accent}0a, rgba(0,0,0,0.35))` }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-black uppercase tracking-wide leading-tight" style={{ color: def.accent }}>
                        {def.title}
                      </span>
                      <span className="text-[15px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: pc >= 80 ? LIME : CYAN }}>
                        {pc}%
                      </span>
                    </div>
                    <div className="mt-2 h-[4px] rounded-full bg-white/[0.08] overflow-hidden">
                      <div className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pc}%`, background: `linear-gradient(90deg, ${def.accent}, ${def.accent2})` }} />
                    </div>
                    <div className="mt-2 text-[11px] text-gray-400" style={{ fontFamily: MONO }}>{p.label}</div>
                    {p.remaining && <div className="text-[11px] text-gray-600 mt-0.5">{p.remaining}</div>}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── FILTRI ── */}
        <div className="flex flex-wrap items-center gap-2">
          {([["all", t("badges.filterAll")], ["unlocked", t("badges.filterUnlocked")], ["locked", t("badges.filterLocked")]] as [Filter, string][])
            .map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-[0.18em] uppercase border transition-colors"
                style={{
                  borderColor: filter === id ? `${LIME}55` : "#ffffff12",
                  background: filter === id ? `${LIME}14` : "transparent",
                  color: filter === id ? LIME : "#9CA3AF",
                }}>
                {label}
              </button>
            ))}
          {group && (
            <button type="button" onClick={() => setGroup(null)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-[0.18em] uppercase border border-white/10 text-gray-400 hover:text-white transition-colors">
              {group} ✕
            </button>
          )}
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("badges.searchPlaceholder")}
              className="w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 py-2 text-[12px] text-white outline-none focus:border-brand/50 transition-colors"
            />
          </div>
        </div>

        {visibleCount === 0 && (
          <p className="text-[12px] text-gray-500 py-8 text-center">{t("badges.noMatch")}</p>
        )}

        {/* ── COLLEZIONE PER CATEGORIA ── */}
        {groups.map((g) => {
          const defs = CELEBRATIONS.filter((c) => c.group === g && matches(c));
          if (defs.length === 0) return null;
          const all = CELEBRATIONS.filter((c) => c.group === g);
          const gotInGroup = all.filter((d) => unlockedIds.has(d.id)).length;
          // gli sbloccati davanti: la bacheca deve aprirsi con ciò che hai fatto
          const ordered = [...defs].sort((a, b) => Number(unlockedIds.has(b.id)) - Number(unlockedIds.has(a.id)));
          return (
            <section key={g} className="rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.02] to-black/30 p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-black tracking-[0.25em] uppercase text-white">{g}</h2>
                <span className="text-[11px] font-black text-gray-600" style={{ fontFamily: MONO }}>
                  {gotInGroup}/{all.length}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {ordered.map((def) => {
                  const unlocked = unlockedIds.has(def.id);
                  const at = state?.unlocked[def.id]?.at;
                  const p = progress[def.id];

                  if (unlocked) {
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => replay(def)}
                        className="group relative text-left rounded-2xl border p-4 overflow-hidden transition-transform hover:-translate-y-0.5"
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
                        <div className="text-[11px] text-gray-500 mt-1.5">
                          {at ? t("badges.unlockedOn", { date: fmtDate(at, locale) }) : t("badges.unlocked")}
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={def.id}
                      type="button"
                      onClick={() => replay(def)}
                      aria-label={`${def.title} — ${t("badges.preview")}`}
                      className="group relative text-left rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 overflow-hidden cursor-pointer transition-colors hover:bg-white/[0.04] hover:border-white/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                      title={def.mechanic}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-2 h-2 rounded-full bg-gray-700" />
                        <Lock className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <div className="text-[12px] font-black uppercase tracking-wide text-gray-400 leading-tight">
                        {def.title}
                      </div>
                      <div className="text-[11px] text-[#8A8A8A] mt-1.5 leading-snug">{def.mechanic}</div>
                      {p?.pct != null ? <ProgressBar p={p} /> : p?.label ? (
                        // i record non hanno una percentuale: si mostra il numero da battere
                        <div className="mt-2 text-[11px] text-gray-500 leading-snug" style={{ fontFamily: MONO }}>
                          {p.label}
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-[10px] font-black tracking-[0.18em] uppercase text-gray-600 group-hover:text-white transition-colors">
                          <Play className="w-3 h-3" />
                          {t("badges.preview")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

      </div>
    </main>
  );
}
