import { useEffect, useMemo, useRef, useState } from "react";
import {
  Shield, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, Swords,
  AlertTriangle, Timer, Crosshair, Flame,
} from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { CHART_TEXT } from "../statistics/chartTheme";
import { useAthleteVdot } from "./useAthleteVdot";
import {
  buildLeague, decayOn, DECAY_GRACE, DIVISIONS, RATING_FLOOR,
  type LeagueState, type LeagueMatch, type SessionOdds,
} from "./leagueEngine";
import { dayToIso } from "./gamiCore";
import { PhysioVerdict } from "./PhysioVerdict";
import { usePhysio } from "./usePhysio";

const MONO = "'JetBrains Mono', monospace";

// ── stemma della divisione ────────────────────────────────────────────────────
function Crest({ color, size = 96, pct }: { color: string; size?: number; pct: number }) {
  const R = 42, C = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="crestFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff14" strokeWidth="5" />
      <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 50 50)" />
      <path d="M50 18 L74 28 L74 52 Q74 72 50 82 Q26 72 26 52 L26 28 Z"
        fill="url(#crestFill)" stroke={color} strokeWidth="2" />
    </svg>
  );
}

// ── curva del rating con le bande delle divisioni ─────────────────────────────
/**
 * Il grafico che la v1 non può avere: qui la linea SCENDE. Le fasce colorate
 * sono le divisioni, così un crollo non è un numero più piccolo ma il momento
 * in cui la linea esce da una fascia ed entra in quella sotto.
 */
function RatingCurve({ st }: { st: LeagueState }) {
  const W = 720, H = 260, PAD_L = 46, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const pts = st.curve;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const geo = useMemo(() => {
    if (pts.length < 2) return null;
    const x0 = pts[0].day, x1 = pts[pts.length - 1].day;
    const lo = Math.min(RATING_FLOOR + 40, ...pts.map((p) => p.rating)) - 30;
    const hi = Math.max(...pts.map((p) => p.rating)) + 40;
    const sx = (d: number) => PAD_L + ((d - x0) / Math.max(1, x1 - x0)) * (W - PAD_L - PAD_R);
    const sy = (r: number) => PAD_T + (1 - (r - lo) / Math.max(1, hi - lo)) * (H - PAD_T - PAD_B);
    return { x0, x1, lo, hi, sx, sy };
  }, [pts]);

  if (!geo) return <div className="h-[260px] grid place-items-center text-xs text-gray-600">Servono più corse per tracciare la curva</div>;
  const { lo, hi, sx, sy } = geo;

  const path = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.day).toFixed(1)},${sy(p.rating).toFixed(1)}`).join(" ");
  const area = `${path} L${sx(pts[pts.length - 1].day).toFixed(1)},${H - PAD_B} L${sx(pts[0].day).toFixed(1)},${H - PAD_B} Z`;
  const col = st.division.def.color;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const rel = ((e.clientX - box.left) / box.width) * W;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(sx(p.day) - rel); if (d < bd) { bd = d; bi = i; } });
    setHover(bi);
  };
  const hp = hover != null ? pts[hover] : null;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" style={{ height: 260 }}
      onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Andamento del punteggio classifica">
      <defs>
        <linearGradient id="ratingArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.26" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* fasce divisione */}
      {DIVISIONS.map((d) => {
        const yTop = sy(Math.min(hi, d.ceil)), yBot = sy(Math.max(lo, d.floor));
        if (yBot <= PAD_T || yTop >= H - PAD_B || yBot - yTop < 1) return null;
        return (
          <g key={d.id}>
            <rect x={PAD_L} y={yTop} width={W - PAD_L - PAD_R} height={yBot - yTop} fill={d.color} opacity={0.06} />
            <line x1={PAD_L} x2={W - PAD_R} y1={yBot} y2={yBot} stroke={d.color} strokeOpacity={0.3} strokeDasharray="3 4" />
            <text x={PAD_L - 6} y={Math.min(yBot - 3, H - PAD_B - 3)} textAnchor="end" fontSize="8"
              fill={d.color} fontFamily={MONO} opacity={0.8}>{d.name.slice(0, 4).toUpperCase()}</text>
          </g>
        );
      })}

      <path d={area} fill="url(#ratingArea)" />
      <path d={path} fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {hp && (
        <g>
          <line x1={sx(hp.day)} x2={sx(hp.day)} y1={PAD_T} y2={H - PAD_B} stroke="#fff" strokeOpacity={0.25} />
          <circle cx={sx(hp.day)} cy={sy(hp.rating)} r="4.5" fill={col} stroke="#0A0A0A" strokeWidth="2" />
          <g transform={`translate(${Math.min(W - 130, Math.max(PAD_L, sx(hp.day) - 55))}, ${PAD_T + 4})`}>
            <rect width="120" height="34" rx="7" fill="#0A0A0Aee" stroke="#ffffff1f" />
            <text x="8" y="14" fontSize="9" fill={CHART_TEXT.axis} fontFamily={MONO}>{dayToIso(hp.day)}</text>
            <text x="8" y="27" fontSize="12" fill={col} fontFamily={MONO} fontWeight="bold">{hp.rating} PR</text>
          </g>
        </g>
      )}
      <text x={PAD_L} y={H - 8} fontSize="8" fill={CHART_TEXT.axis} fontFamily={MONO}>{dayToIso(pts[0].day)}</text>
      <text x={W - PAD_R} y={H - 8} textAnchor="end" fontSize="8" fill={CHART_TEXT.axis} fontFamily={MONO}>oggi</text>
    </svg>
  );
}

// ── ± ─────────────────────────────────────────────────────────────────────────
function Delta({ v, big = false }: { v: number; big?: boolean }) {
  const pos = v > 0, zero = v === 0;
  const c = zero ? CHART_TEXT.axis : pos ? "#22C55E" : "#F43F5E";
  const Icon = zero ? Minus : pos ? ChevronUp : ChevronDown;
  return (
    <span className={`inline-flex items-center gap-0.5 font-black tabular-nums ${big ? "text-xl" : "text-[13px]"}`}
      style={{ fontFamily: MONO, color: c }}>
      <Icon className={big ? "w-4 h-4" : "w-3 h-3"} />{pos ? "+" : ""}{v}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}
function CardHead({ icon: Icon, title, hint }: { icon: typeof Shield; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
      <Icon className="w-4 h-4 self-center text-white/70" />
      <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">{title}</h2>
      {hint && <span className="ml-auto text-[10px] text-gray-500 truncate">{hint}</span>}
    </div>
  );
}

// ── PAGINA ────────────────────────────────────────────────────────────────────
export function GamificationV2() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const vdot = useAthleteVdot();
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const [today, setToday] = useState(() => new Date().toISOString());
  useEffect(() => {
    const sync = () => setToday(new Date().toISOString());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const st = useMemo(() => buildLeague(runs, today, vdot), [runs, today, vdot]);
  const physio = usePhysio(runs);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".lg-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.05, ease: "power3.out" });
      gsap.from(".lg-num", { textContent: 0, duration: 1.1, ease: "power2.out", snap: { textContent: 1 } });
    }, root);
    return () => c.revert();
  }, [st.ok]);

  if (!st.ok) return (
    <main className="flex-1 grid place-items-center text-gray-500">
      <p className="text-sm font-black uppercase tracking-widest">Servono almeno 4 corse per entrare in classifica</p>
    </main>
  );

  const d = st.division;
  const TrendIcon = st.perWeek > 0 ? TrendingUp : st.perWeek < 0 ? TrendingDown : Minus;
  const trendCol = st.perWeek > 0 ? "#22C55E" : st.perWeek < 0 ? "#F43F5E" : CHART_TEXT.axis;

  return (
    <main ref={root} className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-8 text-white">

        {/* Il punteggio dice come stai andando rispetto a te stesso; il verdetto
            dice dove porta. Servono tutti e due, ma in quest'ordine. */}
        <div className="lg-rise mb-5"><PhysioVerdict p={physio} /></div>

        {/* ── STEMMA ─────────────────────────────────────────────────────── */}
        <Card className="lg-rise p-5 md:p-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(120% 130% at 10% 0%, ${d.def.color}1f, transparent 60%)` }} />
          <div className="relative flex flex-wrap items-center gap-6">
            <div className="relative shrink-0 grid place-items-center">
              <Crest color={d.def.color} pct={st.bandPct} />
              <Shield className="absolute w-8 h-8" style={{ color: d.def.color }} />
            </div>

            <div className="min-w-[180px]">
              <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500">Divisione</div>
              <div className="text-3xl md:text-4xl font-black uppercase italic tracking-tight leading-none mt-1"
                style={{ color: d.def.color }}>{d.subLabel}</div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="lg-num text-5xl font-black tabular-nums leading-none" style={{ fontFamily: MONO }}>{st.rating}</span>
                <span className="text-xs font-black text-gray-500">PR</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1" style={{ fontFamily: MONO }}>picco {st.peak} · minimo divisione {d.def.floor}</div>
            </div>

            <div className="flex-1 min-w-[260px] grid gap-2.5">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-2 py-1 rounded-lg font-black tabular-nums flex items-center gap-1"
                  style={{ fontFamily: MONO, background: `${trendCol}1f`, color: trendCol }}>
                  <TrendIcon className="w-3 h-3" />{st.perWeek > 0 ? "+" : ""}{st.perWeek} PR / settimana
                </span>
                {vdot && <span className="px-2 py-1 rounded-lg text-gray-400 bg-white/5 font-black tabular-nums" style={{ fontFamily: MONO }}>VDOT {vdot.toFixed(1)}</span>}
                {st.best5k && <span className="px-2 py-1 rounded-lg text-gray-400 bg-white/5 font-black tabular-nums" style={{ fontFamily: MONO }}>5K {st.best5k}</span>}
              </div>

              {st.next ? (
                <>
                  <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${st.bandPct}%`, background: `linear-gradient(90deg, ${d.def.color}, ${st.next.color})` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">
                      <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.toNext}</b> PR a <b style={{ color: st.next.color }}>{st.next.name}</b>
                    </span>
                    <span className="text-gray-400">
                      {st.weeksToNext != null
                        ? <>ci arrivi in <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.weeksToNext}</b> settimane</>
                        : <span className="text-[#F43F5E]">al ritmo attuale non ci arrivi</span>}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[12px] text-gray-400">Vertice della classifica: da qui si difende.</div>
              )}

              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="px-2 py-1 rounded-lg bg-white/5 text-gray-400">
                  Margine sulla retrocessione: <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.safeBy}</b> PR
                </span>
                {st.idleDays > 0 && (
                  <span className="px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: st.decayToday ? "#F43F5E1f" : "#ffffff0d", color: st.decayToday ? "#F43F5E" : CHART_TEXT.axis }}>
                    <Timer className="w-3 h-3" />
                    {st.idleDays} giorni di stop{st.decayToday ? ` · −${st.decayToday} PR oggi` : " · nessun calo ancora"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="relative mt-4 pt-3 border-t border-white/10 text-[12px] text-gray-400 leading-relaxed">
            <b className="text-white">{d.def.name}</b> — {d.def.meaning}
            {/* "ad Argento", non "a Argento": la preposizione dipende dall'iniziale */}
            {st.next && <> Salendo {/^[aeiou]/i.test(st.next.name) ? "ad" : "a"} <b style={{ color: st.next.color }}>{st.next.name}</b>: {st.next.unlock}</>}
          </p>
        </Card>

        {/* ── CURVA + QUOTE ──────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] items-start">
          <Card className="lg-rise overflow-hidden">
            <CardHead icon={TrendingUp} title="Storia della classifica" hint="ultimi 180 giorni · le fasce sono le divisioni" />
            <div className="px-2 pb-2"><RatingCurve st={st} /></div>
          </Card>

          <Card className="lg-rise">
            <CardHead icon={Crosshair} title="Quanto vale la prossima corsa" hint="calcolato sui tuoi standard di oggi" />
            <div className="px-4 pb-4 space-y-2">
              {st.odds.map((o) => <OddsRow key={o.id} o={o} />)}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/10">
                <Timer className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold text-gray-300">Non corri</div>
                  <div className="text-[10px] text-gray-500">
                    {st.idleDays > DECAY_GRACE
                      ? `${st.idleDays}° giorno di stop: ecco quanto costa oggi`
                      : `dopo ${DECAY_GRACE} giorni di stop, il primo costa questo`}
                  </div>
                </div>
                <Delta v={-(st.idleDays > DECAY_GRACE ? st.decayToday : Math.round(decayOn(DECAY_GRACE + 1)))} />
              </div>
            </div>
          </Card>
        </div>

        {/* ── PARTITE + STANDARD ─────────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] items-start">
          <Card className="lg-rise overflow-hidden">
            <CardHead icon={Swords} title="Le tue ultime partite" hint="ogni corsa contro il tuo standard di allora" />
            <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
              {st.matches.map((m) => <MatchRow key={m.id} m={m} />)}
            </div>
          </Card>

          <div className="grid gap-5">
            <Card className="lg-rise">
              <CardHead icon={Flame} title="Chi devi battere" hint="il tuo standard per zona" />
              <div className="px-4 pb-4 space-y-2">
                {st.baselines.map((b) => (
                  <div key={b.zone.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03]">
                    <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: b.zone.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-bold text-white/90">{b.zone.name}</div>
                      <div className="text-[10px] text-gray-500">{b.metric === "vdot" ? "VDOT mediano delle ultime sedute" : "distanza mediana della zona"}</div>
                    </div>
                    <span className="font-black tabular-nums text-[15px]" style={{ fontFamily: MONO, color: b.zone.color }}>
                      {b.value}{b.metric === "km" ? <span className="text-[10px] text-gray-500 ml-0.5">km</span> : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="lg-rise">
              <CardHead icon={AlertTriangle} title="Le regole" />
              <ul className="px-5 pb-5 space-y-2 text-[11.5px] text-gray-400 leading-relaxed list-disc list-inside marker:text-gray-600">
                <li>Una seduta di <b className="text-white">qualità</b> si giudica sul VDOT: due punti sopra il tuo standard valgono il massimo.</li>
                <li>Una seduta <b className="text-white">aerobica</b> si giudica sulla distanza: lì il lavoro è tempo sulle gambe.</li>
                <li>Il <b className="text-white">peso</b> della partita cresce con la durata e con la zona: un recupero muove un terzo di una ripetuta.</li>
                <li>Battere lo standard <b className="text-white">alza lo standard</b>. La stessa seduta, fra un mese, rende meno.</li>
                <li>Dopo 3 giorni fermo il punteggio cala, ma il calo <b className="text-white">rallenta</b>: si dimezza ogni due settimane. Uno stop lungo ti costa una divisione, non la scala.</li>
                <li>La classifica racconta gli <b className="text-white">ultimi 12 mesi</b>. Le stagioni vecchie non ti inseguono.</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function OddsRow({ o }: { o: SessionOdds }) {
  const pct = Math.round((o.delta / Math.max(1, o.deltaMax)) * 100);
  return (
    <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: o.zone.color }} />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold text-white/90 truncate">{o.label}</div>
          <div className="text-[10px] text-gray-500 truncate">{o.detail}</div>
        </div>
        <Delta v={o.delta} />
      </div>
      <div className="mt-1.5 ml-4 h-1 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.abs(pct)}%`, background: o.delta >= 0 ? "#22C55E" : "#F43F5E" }} />
      </div>
    </div>
  );
}

function MatchRow({ m }: { m: LeagueMatch }) {
  const beat = m.actual >= m.baseline;
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="mt-1 w-1.5 h-10 rounded-full shrink-0" style={{ background: m.zone.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-white/90 truncate">{m.name}</span>
          {m.isRace && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: "#E879F91f", color: "#E879F9" }}>gara</span>}
          {m.isPB && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: "#FBBF241f", color: "#FBBF24" }}>PB</span>}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
          {m.date} · {m.km} km · {m.pace}/km · peso {m.weight}
        </div>
        <div className="text-[11px] mt-1" style={{ color: beat ? "#86EFAC" : "#FCA5A5" }}>{m.why}</div>
      </div>
      <div className="text-right shrink-0">
        <Delta v={m.delta} big />
        <div className="text-[10px] text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>→ {m.ratingAfter}</div>
      </div>
    </div>
  );
}
