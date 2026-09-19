import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Lock, Minus, Plus, RotateCcw, Shield, Upload } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { Run, RunsResponse } from "../../types/api";
import { fmtClock, fmtPace } from "../gamification/gamiCore";
import {
  ROME_HM_PROFILE, badDayVdot, bestTime, buildPlan, courseClimb, equivalentFlatKm, fitProfile, flatCourse,
  fmtDelta, fmtKm, halfwayPrice, levelForCourse, limitPace, makeCourse, parseGpx, profileFromSplits,
  robustStart, splitsOf, tankTrace,
  type Course, type Plan, type ProfilePoint, type SplitLocks, type StrategyId, type StrategyInput,
} from "./paceEngine";
import type { PaceCtx } from "./PaceLabView";
import { PaceProChart } from "./PaceProChart";
import { paceColor } from "./chartKit";
import { CYAN, Card, LIT, LOAD, MONO, RISK, Label, SectionHead, Segmented } from "./ui";

/**
 * 04 · PACEPRO
 * ════════════════════════════════════════════════════════════════════════════
 * Il piano di gara km per km, come quello del Garmin — distanza, tempo,
 * strategia, percorso — con quello che al Garmin manca: il conto. Per ogni
 * piano il serbatoio km per km, il tempo che vale davvero, e cosa succede in
 * una giornata storta.
 *
 * La strategia consigliata non è un'opinione: è lo sforzo costante (il minimo
 * matematico su qualunque percorso) con la prima metà un filo più prudente,
 * di quanto serve a proteggerti dall'incertezza sul tuo livello e non di più.
 */

type CourseKind = "flat" | "rome" | "run" | "gpx";

const STRATEGIES: { id: StrategyId; label: string; short: string }[] = [
  { id: "consigliata", label: "Consigliata", short: "Consigliata" },
  { id: "sforzo", label: "Sforzo costante", short: "Sforzo" },
  { id: "passo", label: "Passo costante", short: "Passo" },
  { id: "custom", label: "Personalizzata", short: "Tua" },
];

const SIGMAS = [
  { value: 1, label: "Alta ±1%", title: "Hai corso questa distanza di recente, in condizioni simili" },
  { value: 1.5, label: "Normale ±1,5%", title: "La variabilità tipica di un giorno di gara" },
  { value: 2.5, label: "Bassa ±2,5%", title: "Prima volta sulla distanza, forma incerta o condizioni dubbie" },
];

const GPX_STORE = "metic.pacelab.gpx";
const PREF_STORE = "metic.pacelab.pacepro";

interface Prefs { courseKind: CourseKind; strategy: StrategyId; split: number; hills: number; sigma: number; runId: string | null }

function loadPrefs(): Prefs {
  const base: Prefs = { courseKind: "rome", strategy: "consigliata", split: 0, hills: 100, sigma: 1.5, runId: null };
  try {
    const s = JSON.parse(localStorage.getItem(PREF_STORE) ?? "{}") as Partial<Prefs>;
    return {
      courseKind: (["flat", "rome", "run", "gpx"] as const).includes(s.courseKind as CourseKind) ? (s.courseKind as CourseKind) : base.courseKind,
      strategy: STRATEGIES.some((x) => x.id === s.strategy) ? (s.strategy as StrategyId) : base.strategy,
      split: typeof s.split === "number" ? s.split : base.split,
      hills: typeof s.hills === "number" ? s.hills : base.hills,
      sigma: SIGMAS.some((x) => x.value === s.sigma) ? (s.sigma as number) : base.sigma,
      runId: typeof s.runId === "string" ? s.runId : null,
    };
  } catch {
    return base;
  }
}

function loadGpx(): { name: string; profile: ProfilePoint[] } | null {
  try {
    const s = JSON.parse(localStorage.getItem(GPX_STORE) ?? "null");
    return s && Array.isArray(s.profile) && s.profile.length >= 2 ? s : null;
  } catch {
    return null;
  }
}

/** Un profilo da migliaia di punti diventa uno da ~50 m: per salvarlo basta. */
function thin(profile: ProfilePoint[]): ProfilePoint[] {
  const out: ProfilePoint[] = [];
  for (const p of profile) if (!out.length || p.km - out[out.length - 1].km >= 0.05) out.push({ km: +p.km.toFixed(3), ele: +p.ele.toFixed(1) });
  const last = profile[profile.length - 1];
  if (out[out.length - 1].km < last.km) out.push({ km: +last.km.toFixed(3), ele: +last.ele.toFixed(1) });
  return out;
}

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const shortDate = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T00:00:00Z"); return `${d.getUTCDate()} ${MESI[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`; };

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title={title}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-black border transition-colors"
      style={{ borderColor: on ? `${LIT}66` : "rgba(255,255,255,0.1)", background: on ? `${LIT}1f` : "rgba(0,0,0,0.4)", color: on ? LIT : "#9CA3AF" }}>
      {children}
    </button>
  );
}

function RangeRow({ label, left, right, value, min, max, step, onChange, fmt }: {
  label: string; left: string; right: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] text-gray-400">{label}</span>
        <span className="text-[12px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[#C0FF00] cursor-pointer" aria-label={label} />
      <div className="flex justify-between text-[9.5px] text-gray-600 mt-0.5"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}

export function PaceProSection({ ctx }: { ctx: PaceCtx }) {
  const { distId, distKm: D, targetSec } = ctx;
  const prefs = useMemo(loadPrefs, []);
  const [courseKind, setCourseKind] = useState<CourseKind>(prefs.courseKind);
  const [runId, setRunId] = useState<string | null>(prefs.runId);
  const [gpx, setGpx] = useState(loadGpx);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyId>(prefs.strategy);
  const [split, setSplit] = useState(prefs.split);
  const [hills, setHills] = useState(prefs.hills);
  const [sigma, setSigma] = useState(prefs.sigma);
  const [splitKm, setSplitKm] = useState(1);
  const [locks, setLocks] = useState<SplitLocks>({});
  const [sel, setSel] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { localStorage.setItem(PREF_STORE, JSON.stringify({ courseKind, strategy, split, hills, sigma, runId } satisfies Prefs)); } catch { /* pazienza */ }
  }, [courseKind, strategy, split, hills, sigma, runId]);

  // ── il percorso ──
  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const eligibleRuns = useMemo(() => (runsData?.runs ?? [])
    .filter((r: Run) => !r.is_treadmill && (r.splits?.length ?? 0) >= 2
      && r.distance_km >= D * 0.9 && r.distance_km <= D * 1.25)
    .slice(0, 40), [runsData, D]);
  const run = eligibleRuns.find((r) => r.id === runId) ?? null;
  const romeOk = distId === "21k";
  const kind: CourseKind = courseKind === "rome" && !romeOk ? "flat"
    : courseKind === "run" && !run ? "flat"
      : courseKind === "gpx" && !gpx ? "flat" : courseKind;

  const course: Course = useMemo(() => {
    if (kind === "rome") {
      return makeCourse("rome", "Rome Half Marathon · 18 ottobre", D, ROME_HM_PROFILE,
        "Profilo ricostruito dall'altimetria ufficiale: circa +63 m, strappi fra il km 2,5 e il 5, arrivo in salita al Colosseo.");
    }
    if (kind === "run" && run) {
      return makeCourse(`run-${run.id}`, run.name || `Corsa del ${shortDate(run.date)}`, D, fitProfile(profileFromSplits(run.splits), D),
        `Quota dagli split per km della corsa del ${shortDate(run.date)} (${fmtKm(run.distance_km, 2)} km): un dato per km, quindi gli strappi più corti si perdono. Per il percorso esatto carica il GPX della gara.`);
    }
    if (kind === "gpx" && gpx) {
      const len = gpx.profile[gpx.profile.length - 1].km - gpx.profile[0].km;
      const how = len > D * 1.1
        ? `tagliato ai primi ${fmtKm(D, 2)} km: se è il percorso di un'altra gara, scegli la distanza giusta`
        : len < D * 0.9
          ? `stirato su ${fmtKm(D, 2)} km: è molto più corto della gara, controlla che sia il file giusto`
          : `riportato a ${fmtKm(D, 2)} km`;
      return makeCourse("gpx", gpx.name, D, fitProfile(gpx.profile, D), `GPX di ${fmtKm(len, 2)} km, ${how}.`);
    }
    return flatCourse(D);
  }, [kind, D, run, gpx]);

  // cambiare distanza, percorso o frazioni rimette gli split a posto
  useEffect(() => { setLocks({}); setSel(null); }, [D, course.id, splitKm]);
  useEffect(() => { setSplitKm(1); }, [distId]);

  // ── il livello sul percorso ──
  const vdot = ctx.levelMode === "target" ? levelForCourse(course, targetSec) : ctx.vdot;
  const robust = useMemo(() => robustStart(D, vdot, sigma), [D, vdot, sigma]);
  const best = useMemo(() => bestTime(course, vdot), [course, vdot]);
  const vBad = useMemo(() => badDayVdot(D, vdot, sigma), [D, vdot, sigma]);

  const stratInput = (id: StrategyId): StrategyInput =>
    id === "custom" ? { id, split: split / 100, hills: hills / 100 } : { id };

  const plans = useMemo(() => {
    const out = {} as Record<StrategyId, Plan>;
    for (const s of STRATEGIES) out[s.id] = buildPlan(course, stratInput(s.id), targetSec, vdot, { robust, splitKm });
    return out;
  }, [course, targetSec, vdot, robust, splitKm, split, hills]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLocks = Object.keys(locks).length > 0;
  const plan = useMemo(
    () => (hasLocks ? buildPlan(course, stratInput(strategy), targetSec, vdot, { robust, splitKm, locks }) : plans[strategy]),
    [hasLocks, plans, strategy, course, targetSec, vdot, robust, splitKm, locks], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const splits = useMemo(() => splitsOf(plan, course, splitKm), [plan, course, splitKm]);
  const avgPace = plan.totalSec / D;
  const badTrace = useMemo(() => tankTrace(plan, vBad), [plan, vBad]);
  const badWall = badTrace[badTrace.length - 1].tank <= 0 && badTrace[badTrace.length - 1].km < D - 1e-6 ? badTrace[badTrace.length - 1].km : null;

  const compare = useMemo(() => STRATEGIES.map((s) => {
    const p = s.id === strategy ? plan : plans[s.id];
    return { s, p, bad: halfwayPrice(course, p, vBad), wall: tankTrace(p, vBad) };
  }), [plans, plan, strategy, course, vBad]);

  const { up, down } = courseClimb(course);
  const deq = equivalentFlatKm(course);
  const courseCost = targetSec * (1 - D / deq);
  const flatLimit = limitPace(D, vdot);

  const nudge = (i: number, d: number) => {
    const cur = splits[i].paceSec;
    setLocks((l) => ({ ...l, [i]: Math.round(cur) + d }));
  };
  const unlock = (i: number) => setLocks((l) => { const n = { ...l }; delete n[i]; return n; });

  const copySplits = async () => {
    const lines = [
      `PacePro · ${ctx.distLabel} · ${course.label} · ${STRATEGIES.find((s) => s.id === strategy)!.label}`,
      `Totale ${fmtClock(plan.totalSec)} · media ${fmtPace(avgPace)}/km`,
      ...splits.map((s) => `${String(s.index + 1).padStart(2, " ")}  ${fmtKm(s.distKm, 2)} km  ${fmtPace(s.paceSec)}/km  ${fmtClock(s.timeSec)}  ${fmtClock(s.cumSec)}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* senza appunti non c'è niente da fare */ }
  };

  const onGpx = async (file: File | undefined) => {
    if (!file) return;
    setGpxError(null);
    try {
      const prof = parseGpx(await file.text());
      if (prof.length < 2) { setGpxError("Nel file non ci sono punti con la quota."); return; }
      const g = { name: file.name.replace(/\.gpx$/i, ""), profile: thin(prof) };
      setGpx(g);
      setCourseKind("gpx");
      try { localStorage.setItem(GPX_STORE, JSON.stringify(g)); } catch { /* il percorso vale per questa visita */ }
    } catch {
      setGpxError("Non riesco a leggere questo GPX.");
    }
  };

  const splitOptions = D <= 5 ? [0.5, 1] : D <= 10 ? [0.5, 1, 5] : [1, 5];
  const deltaTarget = plan.totalSec - targetSec;
  const strategyLabel = STRATEGIES.find((s) => s.id === strategy)!.label;
  const robustMatters = robust.deltaSec >= 0.75;
  const curBad = compare.find((c) => c.s.id === strategy)!.bad;
  // i passi medi delle due metà, sul percorso vero: quello che leggerai sull'orologio
  const halfPaces = useMemo(() => {
    let t1 = 0, t2 = 0;
    for (const s of plan.segs) {
      if ((s.km0 + s.km1) / 2 < D / 2) t1 += s.timeSec; else t2 += s.timeSec;
    }
    return [t1 / (D / 2), t2 / (D / 2)] as const;
  }, [plan, D]);

  return (
    <Card id="pacepro" className="pl-rise overflow-hidden">
      <SectionHead n="04" title="PacePro" question="La tua gara, km per km" />

      <div className="px-5 pb-5 grid grid-cols-1 gap-5">
        {/* ── i comandi ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 grid grid-cols-1 gap-3 content-start min-w-0">
            <Label>Percorso</Label>
            <div className="flex flex-wrap gap-2">
              <Chip on={kind === "flat"} onClick={() => setCourseKind("flat")}>Piatto</Chip>
              {romeOk && (
                <Chip on={kind === "rome"} onClick={() => setCourseKind("rome")} title="La tua gara del 18 ottobre">Rome Half Marathon</Chip>
              )}
              <Chip on={kind === "run"} onClick={() => { setCourseKind("run"); if (!run && eligibleRuns[0]) setRunId(eligibleRuns[0].id); }}
                title={eligibleRuns.length ? "Il profilo di una tua corsa di lunghezza simile" : `Nessuna corsa di lunghezza simile ai ${fmtKm(D, 1)} km`}>
                Una tua corsa
              </Chip>
              <Chip on={kind === "gpx"} onClick={() => (gpx ? setCourseKind("gpx") : fileRef.current?.click())}>
                <Upload className="w-3.5 h-3.5" />{gpx ? "GPX" : "Carica GPX"}
              </Chip>
              {gpx && kind === "gpx" && (
                <button type="button" onClick={() => fileRef.current?.click()} className="text-[10.5px] font-bold text-gray-500 hover:text-white px-1">cambia file</button>
              )}
              <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml" className="hidden"
                onChange={(e) => { void onGpx(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {courseKind === "run" && (
              eligibleRuns.length ? (
                <select value={run?.id ?? ""} onChange={(e) => setRunId(e.target.value)} aria-label="Corsa da cui prendere il percorso"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] text-white outline-none focus:border-[#C0FF00]/50">
                  {eligibleRuns.map((r) => (
                    <option key={r.id} value={r.id}>
                      {shortDate(r.date)} · {fmtKm(r.distance_km, 1)} km · +{Math.round(r.elevation_gain || 0)} m · {r.name || "corsa"}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-gray-500">Nessuna tua corsa lunga fra {fmtKm(D * 0.9, 1)} e {fmtKm(D * 1.25, 1)} km con gli split: uso il piatto.</p>
              )
            )}
            {gpxError && <p className="text-[11px]" style={{ color: RISK }}>{gpxError}</p>}
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {course.flat ? (
                <>Percorso piatto: passo costante e sforzo costante coincidono.</>
              ) : (
                <><b className="text-white">{course.label}</b>: <span className="tabular-nums" style={{ fontFamily: MONO }}>+{Math.round(up)} m / −{Math.round(down)} m</span>.
                  {" "}Allo stesso sforzo vale <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtKm(deq, 2)} km</b> in piano: costa{" "}
                  <b className="tabular-nums" style={{ fontFamily: MONO, color: LOAD }}>{fmtDelta(courseCost)}</b>, quindi {fmtClock(targetSec)} qui
                  valgono {fmtClock(targetSec - courseCost)} in piano ({fmtPace((targetSec - courseCost) / D)}/km).
                  {course.note && <span className="block mt-1 text-gray-600">{course.note}</span>}</>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 grid grid-cols-1 gap-3 content-start min-w-0">
            <Label>Strategia di passo</Label>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.map((s) => (
                <Chip key={s.id} on={strategy === s.id} onClick={() => setStrategy(s.id)}>
                  {s.id === "consigliata" && <Shield className="w-3.5 h-3.5" />}{s.label}
                </Chip>
              ))}
            </div>
            {strategy === "custom" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RangeRow label="Distribuzione" left="parti forte" right="chiudi forte" value={split} min={-6} max={6} step={0.5}
                  onChange={setSplit}
                  fmt={(v) => (Math.abs(v) < 0.01 ? "pari" : `${v > 0 ? "negativa" : "positiva"} ${Math.abs(v).toFixed(1).replace(".", ",")}%`)} />
                <RangeRow label="In salita" left="stesso passo" right="stesso sforzo" value={hills} min={0} max={100} step={10}
                  onChange={setHills} fmt={(v) => `${v}% sforzo`} />
              </div>
            )}
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <div>
                <Label className="mb-1.5">Frazioni</Label>
                <Segmented size="sm" ariaLabel="Lunghezza delle frazioni" value={splitKm} onChange={setSplitKm}
                  options={splitOptions.map((k) => ({ value: k, label: k === 0.5 ? "500 m" : `${k} km` }))} />
              </div>
              <div>
                <Label className="mb-1.5">Quanto sei sicuro del tuo livello</Label>
                <Segmented size="sm" ariaLabel="Certezza sul livello" value={sigma} onChange={setSigma}
                  options={SIGMAS.map((s) => ({ value: s.value, label: s.label, title: s.title }))} />
              </div>
            </div>
          </div>
        </div>

        {/* ── il riassunto ── */}
        <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
          <SummaryTile label={plan.fit === "obiettivo" ? "Tempo del piano" : "Il tempo che vale"} value={fmtClock(plan.totalSec)}
            sub={plan.fit === "obiettivo"
              ? <>è il tuo obiettivo, e il serbatoio lo regge</>
              : strategy === "consigliata" && deltaTarget < 6 && !hasLocks
                ? <><span style={{ color: LOAD }}>{fmtDelta(deltaTarget)}</span> sull'obiettivo: è il premio dell'assicurazione, qui sotto</>
                : <><span style={{ color: RISK }}>{fmtDelta(deltaTarget)}</span> sull'obiettivo: con questa distribuzione il {fmtClock(targetSec)} non regge</>}
            color={plan.fit === "obiettivo" ? LIT : "#fff"} />
          <SummaryTile label="Passo medio" value={`${fmtPace(avgPace)}`}
            sub={<>prima metà {fmtPace(halfPaces[0])}, seconda {fmtPace(halfPaces[1])}</>} />
          <SummaryTile label="Serbatoio all'arrivo" value={plan.tankEnd > 0.005 ? `${Math.round(plan.tankEnd * 100)}%` : "0%"}
            color={plan.tankEnd > 0.005 ? LIT : "#fff"}
            sub={plan.tankEnd > 0.005 ? <>di margine: il piano regge con avanzo</> : <>il piano è al tuo limite, niente avanzo</>} />
          <SummaryTile label={`Giornata storta · −${String(sigma).replace(".", ",")}%`}
            value={curBad.priceSec == null ? "crollo" : fmtDelta(curBad.priceSec)}
            color={curBad.priceSec == null || curBad.priceSec > 6 ? RISK : curBad.priceSec > 2.5 ? LOAD : LIT}
            sub={curBad.priceSec == null
              ? <>il serbatoio finisce al km {fmtKm(curBad.wallKm!)}, prima di metà gara</>
              : <>se a metà gara correggi; alla lettera {badWall != null ? <>il serbatoio finisce al <span style={{ color: RISK }}>km {fmtKm(badWall)}</span></> : <>regge fino in fondo</>}</>} />
        </div>

        {/* ── cosa fa questa strategia ── */}
        <StrategyNote strategy={strategy} course={course} plan={plan} plans={plans} robust={robust} robustMatters={robustMatters}
          halfPaces={halfPaces} flatLimit={flatLimit} targetSec={targetSec} best={best}
          levelMode={ctx.levelMode} sigma={sigma} split={split} hills={hills} strategyLabel={strategyLabel} distOn={ctx.distOn}
          curBad={curBad} />

        {/* ── il grafico ── */}
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
          <PaceProChart course={course} splits={splits} avgPace={avgPace} badTrace={badTrace} badWallKm={badWall}
            selected={sel} onSelect={setSel} />
        </div>

        {/* ── gli split ── */}
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Label>Frazioni</Label>
            <span className="text-[10.5px] text-gray-600">Con − e + blocchi una frazione a un passo tuo (la folla al via, un ristoro): il resto si ricalcola.</span>
            <div className="ml-auto flex items-center gap-2">
              {hasLocks && (
                <button type="button" onClick={() => setLocks({})}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-bold text-gray-300 hover:text-white hover:border-white/25 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" />Reimposta
                </button>
              )}
              <button type="button" onClick={copySplits}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-black transition-transform hover:scale-105"
                style={{ background: LIT }}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copiati" : "Copia split"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500">
                  <th className="py-2 pr-3 font-black">Frazione</th>
                  <th className="py-2 pr-3 font-black">Distanza</th>
                  {!course.flat && <th className="py-2 pr-3 font-black">Dislivello</th>}
                  <th className="py-2 pr-3 font-black">Passo</th>
                  <th className="py-2 pr-3 font-black">Tempo split</th>
                  <th className="py-2 pr-3 font-black">Cumulato</th>
                  <th className="py-2 font-black">Serbatoio</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => {
                  const dev = (s.paceSec - avgPace) / avgPace;
                  const tank = Math.max(0, s.tankLeft);
                  const badAt = badTrace.find((p) => p.km >= s.km1 - 1e-6);
                  return (
                    <tr key={s.index} onMouseEnter={() => setSel(i)} onMouseLeave={() => setSel(null)}
                      className="transition-colors" style={{ background: sel === i ? "rgba(255,255,255,0.05)" : undefined }}>
                      <td className="py-1.5 pr-3 border-t border-white/[0.05]">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-5 rounded-full" style={{ background: paceColor(dev) }} />
                          <span className="text-[12.5px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{s.index + 1}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums text-gray-300" style={{ fontFamily: MONO }}>
                        {fmtKm(s.distKm, 2)} km
                      </td>
                      {!course.flat && (
                        <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[11.5px] tabular-nums whitespace-nowrap" style={{ fontFamily: MONO }}>
                          <span style={{ color: s.up >= 1 ? "#FCA5A5" : "#4B5563" }}>↑{Math.round(s.up)}</span>{" "}
                          <span style={{ color: s.down >= 1 ? "#93C5FD" : "#4B5563" }}>↓{Math.round(s.down)}</span>
                        </td>
                      )}
                      <td className="py-1.5 pr-3 border-t border-white/[0.05]">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => nudge(i, -1)} aria-label={`Frazione ${s.index + 1}: un secondo più veloce`}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-[3.2rem] text-center text-[13.5px] font-black tabular-nums" style={{ fontFamily: MONO, color: s.locked ? LIT : "#fff" }}>
                            {fmtPace(s.paceSec)}
                          </span>
                          <button type="button" onClick={() => nudge(i, 1)} aria-label={`Frazione ${s.index + 1}: un secondo più lento`}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                          {s.locked && (
                            <button type="button" onClick={() => unlock(i)} title="Sblocca: torna al piano"
                              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors" style={{ color: LIT }}>
                              <Lock className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12.5px] tabular-nums text-gray-200" style={{ fontFamily: MONO }}>{fmtClock(s.timeSec)}</td>
                      <td className="py-1.5 pr-3 border-t border-white/[0.05] text-[12.5px] tabular-nums text-gray-200" style={{ fontFamily: MONO }}>{fmtClock(s.cumSec)}</td>
                      <td className="py-1.5 border-t border-white/[0.05]">
                        <div className="flex items-center gap-2">
                          <div className="relative h-[6px] w-20 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${tank * 100}%`, background: LIT, opacity: 0.85 }} />
                          </div>
                          <span className="text-[11px] tabular-nums text-gray-300 w-9" style={{ fontFamily: MONO }}>{Math.round(tank * 100)}%</span>
                          {badAt && badAt.tank <= 0 && badAt.km <= s.km1 + 1e-6 && (
                            <span className="text-[9.5px] font-black" style={{ color: RISK }} title="Giornata storta: serbatoio già vuoto">✕</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── le strategie a confronto ── */}
        <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4">
          <Label className="mb-1">Le strategie a confronto</Label>
          <p className="text-[10.5px] text-gray-500 mb-3 leading-relaxed">
            Stesso percorso, stesso livello. Nella giornata storta ({String(sigma).replace(".", ",")}% peggio del previsto) chi ragiona segue il piano fino a
            metà gara, poi corre il resto al meglio che le gambe gli permettono: il numero è quanto perde rispetto al meglio possibile di quel giorno.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[9px] font-black tracking-[0.18em] uppercase text-gray-500">
                  <th className="py-2 pr-3 font-black">Strategia</th>
                  <th className="py-2 pr-3 font-black">Tempo</th>
                  <th className="py-2 pr-3 font-black">Sul migliore</th>
                  <th className="py-2 pr-3 font-black">Serbatoio all'arrivo</th>
                  <th className="py-2 pr-3 font-black">Giornata storta</th>
                </tr>
              </thead>
              <tbody>
                {compare.map(({ s, p, bad, wall }) => {
                  const on = s.id === strategy;
                  const bw = wall[wall.length - 1];
                  const wallKm = bw.tank <= 0 && bw.km < D - 1e-6 ? bw.km : null;
                  const vsBest = p.totalSec - Math.min(...compare.map((c) => c.p.totalSec));
                  return (
                    <tr key={s.id} onClick={() => setStrategy(s.id)} className="cursor-pointer transition-colors hover:bg-white/[0.04]"
                      style={{ background: on ? "rgba(192,255,0,0.06)" : undefined }}>
                      <td className="py-2 pr-3 border-t border-white/[0.05]" style={{ boxShadow: on ? `inset 3px 0 0 ${LIT}` : undefined }}>
                        <span className="pl-2 inline-flex items-center gap-1.5 text-[12.5px] font-black text-white">
                          {s.id === "consigliata" && <Shield className="w-3.5 h-3.5" style={{ color: LIT }} />}
                          {s.label}{s.id === strategy && hasLocks && <span className="text-[10px] font-normal text-gray-500">+ split tuoi</span>}
                        </span>
                      </td>
                      <td className="py-2 pr-3 border-t border-white/[0.05] text-[12.5px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{fmtClock(p.totalSec)}</td>
                      <td className="py-2 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums" style={{ fontFamily: MONO, color: vsBest > 0.5 ? LOAD : LIT }}>
                        {vsBest > 0.5 ? fmtDelta(vsBest) : "il migliore"}
                      </td>
                      <td className="py-2 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums text-gray-300" style={{ fontFamily: MONO }}>
                        {p.tankEnd > 0.005 ? `${Math.round(p.tankEnd * 100)}% di margine` : "0% · al limite"}
                      </td>
                      <td className="py-2 pr-3 border-t border-white/[0.05] text-[12px] tabular-nums" style={{ fontFamily: MONO }}>
                        {bad.priceSec == null
                          ? <span style={{ color: RISK }}>crollo prima di metà (km {fmtKm(bad.wallKm!)})</span>
                          : <>
                              <span style={{ color: bad.priceSec > 3 ? "#FDA4AF" : "#D1D5DB" }}>{fmtDelta(bad.priceSec)}</span>
                              <span className="text-gray-600"> · {wallKm != null ? `alla lettera: muro al km ${fmtKm(wallKm)}` : "alla lettera: regge"}</span>
                            </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="-mt-1 text-[11px] text-gray-500 leading-relaxed max-w-5xl">
          <b className="text-gray-300">Il livello.</b>{" "}
          {ctx.levelMode === "target"
            ? <>L'obiettivo è preso come il tuo limite su questo percorso: VDOT {vdot.toFixed(1).replace(".", ",")}, che in piano vale {fmtPace(flatLimit)}/km.</>
            : <>VDOT {vdot.toFixed(1).replace(".", ",")}: su questo percorso il meglio possibile è <b className="text-gray-300">{fmtClock(best)}</b>
                {best <= targetSec ? <>, l'obiettivo ha margine.</> : <>: l'obiettivo {fmtClock(targetSec)} è oltre il tuo limite, e ogni piano mostra il tempo che vale davvero.</>}</>}
          {" "}Ogni piano che il serbatoio non regge viene riportato al tempo che vale davvero: il Garmin ti darebbe gli split dell'obiettivo, qui vedi quanto costano.
        </p>
      </div>
    </Card>
  );
}

function SummaryTile({ label, value, sub, color = "#fff" }: { label: string; value: string; sub: ReactNode; color?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3">
      <Label>{label}</Label>
      <div className="mt-1.5 text-[24px] md:text-[28px] font-black leading-none whitespace-nowrap" style={{ fontFamily: MONO, color }}>{value}</div>
      <div className="mt-1.5 text-[11px] text-gray-400 leading-snug">{sub}</div>
    </div>
  );
}

function StrategyNote({
  strategy, course, plan, plans, robust, robustMatters, halfPaces, flatLimit, targetSec, best, levelMode,
  sigma, split, hills, strategyLabel, distOn, curBad,
}: {
  strategy: StrategyId; course: Course; plan: Plan; plans: Record<StrategyId, Plan>;
  robust: ReturnType<typeof robustStart>; robustMatters: boolean; halfPaces: readonly [number, number]; flatLimit: number;
  targetSec: number; best: number; levelMode: PaceCtx["levelMode"]; sigma: number; split: number; hills: number;
  strategyLabel: string; distOn: string; curBad: { priceSec: number | null; wallKm: number | null };
}) {
  const vsEffort = plan.totalSec - plans.sforzo.totalSec;
  const saveBad = robust.badEvenSec - robust.badRobustSec;
  const saveAvg = robust.expectedEvenSec - robust.expectedRobustSec;
  let body: ReactNode;
  if (strategy === "consigliata") {
    const head = (
      <>
        Sforzo costante, con la prima metà <b style={{ color: CYAN }}>{robust.deltaSec.toFixed(1).replace(".", ",")}″/km più prudente</b> e la seconda
        più decisa. Sull'orologio{course.flat ? "" : ", pendenze comprese,"}{" "}
        <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtPace(halfPaces[0])}</b> di media fino a metà e{" "}
        <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtPace(halfPaces[1])}</b> dopo.{" "}
      </>
    );
    body = robustMatters && plan.fit === "limite" ? (
      <>
        {head}È un'assicurazione, e questo è il suo prezzo:{" "}
        <b className="tabular-nums" style={{ fontFamily: MONO, color: LOAD }}>{fmtDelta(robust.premiumSec)}</b> se la giornata è esattamente quella prevista.
        Se è storta ({String(sigma).replace(".", ",")}% peggio) correggendo a metà perdi{" "}
        <b className="tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{fmtDelta(robust.badRobustSec, "")}</b> invece di{" "}
        <b className="tabular-nums" style={{ fontFamily: MONO, color: RISK }}>{fmtDelta(robust.badEvenSec, "")}</b> col passo pari
        {saveAvg > 0.4 && <>; in media, su tutte le giornate possibili, ti fa guadagnare <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{Math.round(saveAvg)}″</b></>}.
        {" "}È il motivo vero del negative split: partire troppo forte costa molto più che partire un filo piano.
      </>
    ) : robustMatters ? (
      <>
        {head}Col margine che hai l'obiettivo regge e avanza il <b style={{ color: LIT }}>{Math.round(plan.tankEnd * 100)}%</b> del
        serbatoio: qui la prudenza è gratis. Serve il giorno in cui vali meno del previsto — con {String(sigma).replace(".", ",")}% in meno,
        correggendo a metà gara,{" "}
        {curBad.priceSec == null
          ? <>crolli prima di metà (km {fmtKm(curBad.wallKm!)}).</>
          : curBad.priceSec < 0.5
            ? <>fai comunque il meglio possibile di quel giorno.</>
            : <>perdi <b className="tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{fmtDelta(curBad.priceSec, "")}</b> rispetto al meglio di quel giorno.</>}
      </>
    ) : (
      <>
        {distOn[0].toUpperCase() + distOn.slice(1)} la prudenza non paga: la prima metà cambierebbe di {robust.deltaSec.toFixed(1).replace(".", ",")}″/km, e
        correggere a metà gara costa comunque poco. La consigliata qui è lo sforzo costante{course.flat ? ", cioè il passo costante" : ""}
        {saveBad > 0.4 && <> (in una giornata storta ti salva {Math.round(saveBad)}″)</>}.
      </>
    );
  } else if (strategy === "sforzo") {
    body = course.flat
      ? <>In piano sforzo costante e passo costante sono la stessa cosa, ed è l'ottimo: con un consumo che cresce più in fretta del passo, ogni
          secondo guadagnato da una parte ne costa di più dall'altra.</>
      : <>Stesso sforzo su ogni metro: in salita il passo cala, in discesa sale, quanto dice la pendenza. È il minimo matematico — nessuna
          distribuzione fa lo stesso tempo spendendo meno serbatoio. Il costo è che il passo sull'orologio non è mai lo stesso: in gara segui
          il piano km per km, non la media.</>;
  } else if (strategy === "passo") {
    body = course.flat
      ? <>In piano è l'ottimo: stesso passo, stesso consumo, il serbatoio scende dritto e si svuota sul traguardo.</>
      : plan.fit === "limite"
        ? <>Stesso passo su ogni km, salite comprese: in salita spendi più serbatoio del dovuto, in discesa lasci tempo per strada. Su questo
            percorso costa <b className="tabular-nums" style={{ fontFamily: MONO, color: LOAD }}>{fmtDelta(vsEffort)}</b> rispetto allo sforzo costante:
            col tuo serbatoio vale {fmtClock(plan.totalSec)}, non {fmtClock(targetSec)}.</>
        : <>Stesso passo su ogni km, salite comprese: in salita spendi più serbatoio del dovuto, in discesa lasci tempo per strada. L'obiettivo
            regge, ma arrivi con il {Math.round(plan.tankEnd * 100)}% di serbatoio invece del {Math.round(plans.sforzo.tankEnd * 100)}% dello
            sforzo costante: {Math.round((plans.sforzo.tankEnd - plan.tankEnd) * 100)} punti bruciati sulle salite.</>;
  } else {
    body = (
      <>
        La tua distribuzione: {Math.abs(split) < 0.01 ? "pari" : split > 0 ? `${split.toFixed(1).replace(".", ",")}% più lenta la prima parte` : `${Math.abs(split).toFixed(1).replace(".", ",")}% più veloce la prima parte`},
        {" "}{course.flat ? "" : `in salita ${hills}% dello sforzo costante, `}
        {Math.abs(vsEffort) < 0.5
          ? <>praticamente l'ottimo.</>
          : plan.fit === "limite"
            ? <>vale <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(plan.totalSec)}</b>:{" "}
                <b className="tabular-nums" style={{ fontFamily: MONO, color: LOAD }}>{fmtDelta(vsEffort)}</b> sullo sforzo costante.</>
            : <>regge l'obiettivo con {Math.round(plan.tankEnd * 100)}% di serbatoio avanzato (lo sforzo costante ne lascia {Math.round(plans.sforzo.tankEnd * 100)}%).</>}
      </>
    );
  }
  return (
    <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: strategy === "consigliata" ? `${LIT}33` : "rgba(255,255,255,0.07)", background: strategy === "consigliata" ? `${LIT}0a` : "rgba(0,0,0,0.3)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        {strategy === "consigliata" && <Shield className="w-4 h-4" style={{ color: LIT }} />}
        <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: strategy === "consigliata" ? LIT : "#9CA3AF" }}>{strategyLabel}</span>
        {levelMode === "vdot" && best < targetSec - 0.5 && (
          <span className="ml-auto text-[10.5px] text-gray-500">il tuo meglio su questo percorso: <b className="text-gray-300 tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(best)}</b></span>
        )}
      </div>
      <p className="text-[13px] md:text-[14px] text-gray-300 leading-relaxed">{body}</p>
      {strategy === "consigliata" && robustMatters && (
        <p className="mt-2 text-[11px] text-gray-500">In piano il tuo limite è {fmtPace(flatLimit)}/km: la prudenza vale {robust.deltaSec.toFixed(1).replace(".", ",")}″, non di più. Più sei incerto sul tuo livello, più conviene.</p>
      )}
      {!course.flat && strategy !== "passo" && (
        <p className="mt-2 text-[11px] text-gray-500">
          Sul percorso il passo cambia da solo con la pendenza: in discesa più veloce, in salita più lento, allo stesso sforzo. Un km in
          discesa sotto la media non è partire forte — lo è correrlo più veloce di così.
        </p>
      )}
    </div>
  );
}
