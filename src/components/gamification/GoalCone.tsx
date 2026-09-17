import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Table2, Target, type LucideIcon } from "lucide-react";
import { fmtClock } from "./gamiCore";
import { humanDays, type PhysioState } from "./physioEngine";
import { buildGoalCone, coneGoals, type ConeEta, type ConePoint, type GoalCone as Cone, type PlanGoalInput } from "./goalConeEngine";
import { levelFromXp } from "./evolutionEngine";
import { CHART_SERIES, CHART_SURFACE, CHART_TEXT } from "../statistics/chartTheme";

const MONO = "'JetBrains Mono', monospace";
const LIME = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

/** "20 dic", con l'anno solo quando non è quello in corso. */
const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const year = new Date().getFullYear();
  return `${d} ${MESI[m - 1]}${y !== year ? ` ’${String(y).slice(2)}` : ""}`;
};
const pct = (p: number) => `${Math.round(p * 100)}%`;
const secs = (s: number) => `${Math.abs(Math.round(s))}″`;

interface Props {
  physio: PhysioState;
  /** Gli obiettivi del piano di allenamento, ognuno con la sua data. */
  mine: PlanGoalInput[] | null;
  /** Il ritmo degli XP: serve a dire quante sedute separano dalla data. */
  xp: { perDay: number; perSession: number; total: number } | null;
}

/**
 * IL CONO DEL TRAGUARDO.
 *
 * "Quando ci arrivi" dà una data, e la data da sola è la metà della risposta:
 * è il giorno della monetina. Qui la previsione è una forchetta che si allarga
 * col tempo, e la riga dell'obiettivo la taglia in tre punti — quando diventa
 * possibile, quando è alla pari, quando è probabile. È la stessa incertezza con
 * cui il banco di prova calcola le probabilità di gara.
 */
export function GoalCone({ physio, mine, xp }: Props) {
  const goals = useMemo(() => (physio.ok ? coneGoals(physio, mine) : []), [physio, mine]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const goal = goals.find((g) => g.id === goalId) ?? goals[0] ?? null;
  const cone = useMemo(() => (goal ? buildGoalCone(physio, goal, new Date().toISOString()) : null), [physio, goal]);
  const [table, setTable] = useState(false);

  if (!physio.ok || !goal || !cone) return null;

  const best = cone.points.reduce((a, b) => (b.sec < a.sec ? b : a), cone.points[0]);
  // la data su cui contare le sedute: la gara se c'è, altrimenti il giorno alla pari
  const anchor = cone.race ?? cone.even ?? cone.likely;
  const sessionsPerDay = xp && xp.perSession > 0 ? xp.perDay / xp.perSession : 0;

  return (
    <section className="aef-rise min-w-0">
      <Title icon={Target} hint="carico delle ultime 6 settimane · clima del mese">Il cono del traguardo</Title>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 md:p-5">
        {/* gli obiettivi: il tuo per primo */}
        <div className="flex flex-wrap gap-1.5 mb-4" role="radiogroup" aria-label="Obiettivo">
          {goals.map((g) => {
            const sel = g.id === goal.id;
            return (
              <button key={g.id} type="button" role="radio" aria-checked={sel} onClick={() => setGoalId(g.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-wide border transition-colors ${sel ? "bg-[#C0FF00]/12 border-[#C0FF00]/50 text-white" : "border-white/10 text-gray-400 hover:text-white hover:border-white/25"}`}
                style={{ fontFamily: MONO }}>
                {g.mine && <span className="mr-1" style={{ color: LIME }}>★</span>}
                {g.label}
                {g.mine && g.raceIso && <span className="ml-1 text-gray-500 font-bold">· {shortDate(g.raceIso)}</span>}
              </button>
            );
          })}
        </div>

        <Headline cone={cone} best={best} />

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
          <EtaTile label="Possibile" chance="20%" eta={cone.possible} empty={cone.gapSec <= 0 ? "già oggi" : "non a questo carico"} note="basta una giornata perfetta" />
          <EtaTile label="Alla pari" chance="50%" eta={cone.even} empty={cone.gapSec <= 0 ? "già oggi" : "non a questo carico"} note={cone.even ? humanDays(cone.even.days) : ""} strong />
          <EtaTile label="Probabile" chance="80%" eta={cone.likely} empty="non a questo carico" note="la data su cui prenotare" />
          {cone.race ? (
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 min-w-0">
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-500">Gara · {shortDate(cone.race.iso)}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-white" style={{ fontFamily: MONO }}>{fmtClock(cone.race.sec)}</span>
                <span className="text-[11px] font-black text-gray-300" style={{ fontFamily: MONO }}>{pct(cone.race.p)}</span>
              </div>
              <div className="text-[9px] text-gray-500 truncate">previsto · circa {cone.race.tempC}° quel mese</div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 min-w-0">
              <div className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-500">Il meglio previsto</div>
              <div className="mt-1 text-xl font-black text-white" style={{ fontFamily: MONO }}>{fmtClock(best.sec)}</div>
              <div className="text-[9px] text-gray-500 truncate">intorno al {shortDate(best.iso)}</div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <ConeChart cone={cone} />
        </div>

        {/* legenda: due serie, ognuna con la sua chiave di linea */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-gray-400">
          <LineKey color={LIME}>previsione se continui così</LineKey>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 h-2.5 rounded-sm" style={{ background: `${LIME}26` }} />forchetta 20-80%
          </span>
          {cone.boost && <LineKey color={CYAN} dashed>con {cone.boost.label}</LineKey>}
          <LineKey color={CHART_TEXT.muted} dashed>obiettivo {fmtClock(goal.targetSec)}</LineKey>
          <button type="button" onClick={() => setTable((v) => !v)} aria-expanded={table}
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-gray-500 hover:text-white">
            <Table2 className="w-3 h-3" />{table ? "nascondi tabella" : "vedi come tabella"}
          </button>
        </div>

        {table && <ConeTable cone={cone} />}

        {(cone.boost || (anchor && sessionsPerDay > 0)) && (
          <div className="mt-4 pt-3.5 border-t border-white/10 grid gap-2 md:grid-cols-2">
            {cone.boost && cone.boost.even && (
              <div className="flex items-start gap-2.5 text-[11px] leading-snug text-gray-400">
                <span className="mt-1.5 w-4 border-t-2 border-dashed shrink-0" style={{ borderColor: CYAN }} />
                <span>
                  Con <b className="text-white">{cone.boost.label}</b> sei alla pari il{" "}
                  <b className="text-white">{shortDate(cone.boost.even.iso)}</b>
                  {cone.boost.daysSaved != null
                    ? <> — <b className="text-white">{cone.boost.daysSaved} giorni</b> prima.</>
                    : <>: al carico di adesso non ci arrivi proprio.</>}
                </span>
              </div>
            )}
            {anchor && sessionsPerDay > 0 && xp && (
              <div className="flex items-start gap-2.5 text-[11px] leading-snug text-gray-400">
                <CalendarClock className="mt-0.5 w-3.5 h-3.5 shrink-0 text-gray-500" />
                <span>
                  Da qui {cone.race ? "alla gara" : "al giorno alla pari"}, al tuo ritmo:{" "}
                  <b className="text-white">~{Math.max(1, Math.round(anchor.days * sessionsPerDay))} sedute</b> e{" "}
                  <b className="text-white">~{Math.round(anchor.days * xp.perDay).toLocaleString("it-IT")} XP</b>
                  {" "}— ci arrivi a livello <b className="text-white">{levelFromXp(xp.total + anchor.days * xp.perDay)}</b>.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── la frase in cima ──────────────────────────────────────────────────────────
function Headline({ cone, best }: { cone: Cone; best: ConePoint }) {
  const t = fmtClock(cone.goal.targetSec);
  const today = <b className="text-white">{fmtClock(cone.todaySec)}</b>;
  const race = cone.race && (
    <> Il giorno della gara la previsione è <b className="text-white">{fmtClock(cone.race.sec)}</b>, con il <b className="text-white">{pct(cone.race.p)}</b> di probabilità di stare sotto.</>
  );
  let body: React.ReactNode;
  if (cone.gapSec <= 0) {
    body = <>Oggi faresti {today}: sei già sotto il {t}. Il motore c'è — manca la giornata giusta.{race}</>;
  } else if (cone.even) {
    body = <>Oggi faresti {today}, {secs(cone.gapSec)} sopra. Sei alla pari col {t} il <b className="text-white">{shortDate(cone.even.iso)}</b>
      {cone.likely ? <>, e diventa probabile il <b className="text-white">{shortDate(cone.likely.iso)}</b>.</> : <>, ma non arriva mai a essere probabile senza un carico diverso.</>}{race}</>;
  } else {
    body = <>Oggi faresti {today}, {secs(cone.gapSec)} sopra. Al carico di adesso la previsione si ferma a{" "}
      <b className="text-white">{fmtClock(best.sec)}</b>
      {cone.possible ? <>: il {t} è possibile dal <b className="text-white">{shortDate(cone.possible.iso)}</b> solo con una giornata perfetta.</> : <>: per il {t} serve un carico diverso, non altro tempo.</>}{race}</>;
  }
  return <p className="text-[12.5px] leading-relaxed text-gray-400">{body}</p>;
}

function EtaTile({ label, chance, eta, empty, note, strong }: {
  label: string; chance: string; eta: ConeEta | null; empty: string; note: string; strong?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 min-w-0 ${strong ? "border-[#C0FF00]/35 bg-[#C0FF00]/[0.05]" : "border-white/10 bg-black/25"}`}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-500">{label}</span>
        <span className="text-[9px] font-black text-gray-500" style={{ fontFamily: MONO }}>{chance}</span>
      </div>
      <div className="mt-1 text-xl font-black text-white truncate" style={{ fontFamily: MONO }}>{eta ? shortDate(eta.iso) : "—"}</div>
      <div className="text-[9px] text-gray-500 truncate">{eta ? note : empty}</div>
    </div>
  );
}

function LineKey({ color, dashed, children }: { color: string; dashed?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-4 border-t-2 ${dashed ? "border-dashed" : ""}`} style={{ borderColor: color }} />{children}
    </span>
  );
}

function Title({ icon: Icon, children, hint }: { icon: LucideIcon; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
      <div className="flex items-center gap-2 min-w-0"><Icon className="w-4 h-4 text-[#C0FF00] shrink-0" /><h2 className="text-[11px] font-black tracking-[0.28em] uppercase text-white/90 truncate">{children}</h2></div>
      {hint && <span className="hidden sm:inline text-[9px] tracking-widest uppercase text-gray-600 shrink-0 truncate">{hint}</span>}
    </div>
  );
}

// ── il grafico ────────────────────────────────────────────────────────────────
/**
 * Asse X = calendario, asse Y = tempo sulla distanza, il più veloce in alto.
 * La larghezza è misurata sul contenitore invece di scalare un viewBox fisso:
 * su un telefono le etichette restano di 9-10 px veri, non di 5.
 */
function ConeChart({ cone }: { cone: Cone }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = W < 520;
  const H = narrow ? 230 : 260, L = 46, R = narrow ? 12 : 20, T = 30, B = 26;
  const [cur, setCur] = useState<number | null>(null);       // indice del punto sotto al cursore

  const pts = cone.points;
  const target = cone.goal.targetSec;
  const boost = cone.boost?.points ?? [];
  const lo = Math.min(target, ...pts.map((p) => p.lo), ...boost.map((b) => b.sec));
  const hi = Math.max(target, ...pts.map((p) => p.hi));
  const pad = Math.max(4, (hi - lo) * 0.08);
  const y0 = lo - pad, y1 = hi + pad;
  const X = (day: number) => L + (day / cone.horizon) * (W - L - R);
  const Y = (sec: number) => T + ((sec - y0) / (y1 - y0)) * (H - T - B);

  // tacche Y a secondi tondi: 3-5 righe, mai una griglia fitta
  const span = y1 - y0;
  const step = [5, 10, 15, 20, 30, 60, 120, 300].find((s) => span / s <= 5) ?? 600;
  const yTicks: number[] = [];
  for (let s = Math.ceil(y0 / step) * step; s <= y1; s += step) yTicks.push(s);

  // una tacca per mese, al primo punto del mese
  const months: { x: number; label: string }[] = [];
  let lastMonth = -1;
  for (const p of pts) {
    const m = +p.iso.slice(5, 7) - 1;
    if (m !== lastMonth) {
      if (lastMonth !== -1) months.push({ x: X(p.day), label: MESI[m] });
      lastMonth = m;
    }
  }
  const monthStep = narrow && months.length > 6 ? 2 : 1;

  const line = (arr: { day: number; sec: number }[]) => arr.map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)} ${Y(p.sec).toFixed(1)}`).join(" ");
  const band = `${pts.map((p, i) => `${i ? "L" : "M"}${X(p.day).toFixed(1)} ${Y(p.lo).toFixed(1)}`).join(" ")} ${[...pts].reverse().map((p) => `L${X(p.day).toFixed(1)} ${Y(p.hi).toFixed(1)}`).join(" ")} Z`;

  // i tre incroci con l'obiettivo, etichettati solo se non si pestano
  const crossings = ([["20%", cone.possible], ["50%", cone.even], ["80%", cone.likely]] as [string, ConeEta | null][])
    .filter((c): c is [string, ConeEta] => c[1] != null && c[1].days <= cone.horizon);
  let lastLabelX = -Infinity;
  const labeled = crossings.map(([k, e]) => {
    const x = X(e.days);
    const show = x - lastLabelX >= 30;
    if (show) lastLabelX = x;
    return { k, x, show };
  });

  const move = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const day = ((clientX - r.left) / r.width * W - L) / (W - L - R) * cone.horizon;
    let bestI = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].day - day) < Math.abs(pts[bestI].day - day)) bestI = i;
    setCur(bestI);
  };
  const info = cur == null ? null : pts[cur];
  const boostAt = cur == null ? null : boost[cur] ?? null;
  const race = cone.race;

  return (
    <div ref={wrapRef} className="w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block touch-none select-none focus-visible:outline-none"
        role="img" tabIndex={0}
        aria-label={`Previsione del tempo per ${cone.goal.label}. Oggi ${fmtClock(cone.todaySec)}.${cone.even ? ` Alla pari il ${shortDate(cone.even.iso)}.` : ""} Usa le frecce per esplorare.`}
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerDown={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setCur(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setCur((c) => Math.min(pts.length - 1, (c ?? -1) + 1)); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setCur((c) => Math.max(0, (c ?? 1) - 1)); }
          else if (e.key === "Escape") setCur(null);
        }}>
        {/* griglia: linee piene sottilissime, un passo sopra la superficie */}
        {yTicks.map((s) => (
          <g key={s}>
            <line x1={L} x2={W - R} y1={Y(s)} y2={Y(s)} stroke={CHART_SURFACE.grid} strokeWidth={1} />
            <text x={L - 8} y={Y(s) + 3} textAnchor="end" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 9 }}>{fmtClock(s)}</text>
          </g>
        ))}
        {months.map((m, i) => i % monthStep === 0 && (
          <g key={`${m.label}${i}`}>
            <line x1={m.x} x2={m.x} y1={H - B} y2={H - B + 4} stroke={CHART_SURFACE.borderStrong} />
            <text x={m.x} y={H - B + 15} textAnchor="middle" fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 9 }}>{m.label}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={CHART_SURFACE.borderStrong} />

        {/* la forchetta: una velatura, non un blocco */}
        <path d={band} fill={LIME} fillOpacity={0.1} />

        {/* l'obiettivo */}
        <line x1={L} x2={W - R} y1={Y(target)} y2={Y(target)} stroke={CHART_TEXT.muted} strokeWidth={1} strokeDasharray="5 4" />
        <text x={W - R} y={Y(target) - 6} textAnchor="end" fill={CHART_TEXT.muted} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>
          obiettivo {fmtClock(target)}
        </text>

        {/* la gara */}
        {race && race.days <= cone.horizon && (
          <g>
            <line x1={X(race.days)} x2={X(race.days)} y1={T - 12} y2={H - B} stroke={CHART_TEXT.faint} strokeWidth={1} />
            <text x={X(race.days)} y={T - 16} textAnchor="middle" fill={CHART_TEXT.primary} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em" }}>GARA</text>
          </g>
        )}

        {/* scenario e previsione */}
        {boost.length > 1 && <path d={line(boost)} fill="none" stroke={CYAN} strokeWidth={2.5} strokeDasharray="7 5" strokeLinecap="round" />}
        <path d={line(pts)} fill="none" stroke={LIME} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* gli incroci con l'obiettivo */}
        {labeled.map(({ k, x, show }) => (
          <g key={k}>
            <circle cx={x} cy={Y(target)} r={4.5} fill={k === "50%" ? LIME : CHART_SURFACE.panel} stroke={k === "50%" ? CHART_SURFACE.panel : LIME} strokeWidth={2} />
            {show && <text x={x} y={Y(target) + 16} textAnchor="middle" fill={CHART_TEXT.primary} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>{k}</text>}
          </g>
        ))}

        {/* oggi */}
        <circle cx={X(0)} cy={Y(pts[0].sec)} r={4.5} fill={LIME} stroke={CHART_SURFACE.panel} strokeWidth={2} />
        {!info && (
          <text x={X(0) + 8} y={Y(pts[0].sec) + (Y(pts[0].sec) > (H - B) - 20 ? -8 : 14)} fill={CHART_TEXT.primary} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>
            oggi {fmtClock(pts[0].sec)}
          </text>
        )}
        {/* il punto della gara sulla previsione, con il numero che conta */}
        {race && race.days <= cone.horizon && !info && (
          <g>
            <circle cx={X(race.days)} cy={Y(race.sec)} r={4.5} fill={LIME} stroke={CHART_SURFACE.panel} strokeWidth={2} />
            <text x={X(race.days) + (X(race.days) > W - 110 ? -8 : 8)} y={Y(race.sec) - 8} textAnchor={X(race.days) > W - 110 ? "end" : "start"}
              fill={CHART_TEXT.primary} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>
              {fmtClock(race.sec)} · {pct(race.p)}
            </text>
          </g>
        )}

        {/* crosshair + targhetta */}
        {info && <Crosshair info={info} boostSec={boostAt?.sec ?? null} boostLabel={cone.boost?.short ?? ""} x={X(info.day)} yMain={Y(info.sec)} yBoost={boostAt ? Y(boostAt.sec) : null} W={W} T={T} H={H} B={B} target={target} />}
      </svg>
    </div>
  );
}

function Crosshair({ info, boostSec, boostLabel, x, yMain, yBoost, W, T, H, B, target }: {
  info: ConePoint; boostSec: number | null; boostLabel: string; x: number; yMain: number; yBoost: number | null;
  W: number; T: number; H: number; B: number; target: number;
}) {
  const rows: { key: string; value: string; color?: string; dashed?: boolean }[] = [
    { key: "previsto", value: fmtClock(info.sec), color: LIME },
    { key: "forchetta", value: `${fmtClock(info.lo)}–${fmtClock(info.hi)}` },
    { key: `sotto ${fmtClock(target)}`, value: pct(info.p) },
    { key: "clima", value: `~${info.tempC}°` },
  ];
  if (boostSec != null) rows.splice(1, 0, { key: boostLabel, value: fmtClock(boostSec), color: CYAN, dashed: true });
  const bw = 150, bh = 22 + rows.length * 14;
  const flip = x + bw + 14 > W;
  const bx = flip ? x - bw - 10 : x + 10;
  const by = Math.max(T - 4, Math.min(H - B - bh, yMain - bh / 2));
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={T - 4} y2={H - B} stroke={CHART_TEXT.faint} strokeWidth={1} />
      {yBoost != null && <circle cx={x} cy={yBoost} r={4} fill={CYAN} stroke={CHART_SURFACE.panel} strokeWidth={2} />}
      <circle cx={x} cy={yMain} r={4.5} fill={LIME} stroke={CHART_SURFACE.panel} strokeWidth={2} />
      <rect x={bx} y={by} width={bw} height={bh} rx={8} fill="#0A0A0AF0" stroke={CHART_SURFACE.borderStrong} />
      <text x={bx + 10} y={by + 15} fill={CHART_TEXT.muted} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800 }}>
        {shortDate(info.iso)} · {info.day === 0 ? "oggi" : humanDays(info.day)}
      </text>
      {rows.map((r, i) => (
        <g key={r.key}>
          {r.color && <line x1={bx + 10} x2={bx + 20} y1={by + 26 + i * 14} y2={by + 26 + i * 14} stroke={r.color} strokeWidth={2} strokeDasharray={r.dashed ? "3 2" : undefined} />}
          <text x={bx + (r.color ? 25 : 10)} y={by + 29 + i * 14} fill={CHART_TEXT.axis} style={{ fontFamily: MONO, fontSize: 9 }}>{r.key}</text>
          <text x={bx + bw - 10} y={by + 29 + i * 14} textAnchor="end" fill={CHART_TEXT.primary} style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800 }}>{r.value}</text>
        </g>
      ))}
    </g>
  );
}

// ── la stessa cosa, in tabella ────────────────────────────────────────────────
function ConeTable({ cone }: { cone: Cone }) {
  // un punto ogni due settimane, più il giorno della gara
  const rows = cone.points.filter((p, i) => i % 5 === 0 || (cone.race && p.day === Math.round(cone.race.days / 3) * 3));
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/10">
            <th className="px-3 py-2 font-black">Data</th>
            <th className="px-3 py-2 font-black text-right">Previsto</th>
            <th className="px-3 py-2 font-black text-right">Forchetta 20-80%</th>
            <th className="px-3 py-2 font-black text-right">Sotto {fmtClock(cone.goal.targetSec)}</th>
            <th className="px-3 py-2 font-black text-right">Clima</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.day} className="border-b border-white/[0.05] last:border-0 text-gray-300">
              <td className="px-3 py-1.5">{shortDate(p.iso)}</td>
              <td className="px-3 py-1.5 text-right text-white font-black tabular-nums">{fmtClock(p.sec)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtClock(p.lo)}–{fmtClock(p.hi)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{pct(p.p)}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">~{p.tempC}°</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
