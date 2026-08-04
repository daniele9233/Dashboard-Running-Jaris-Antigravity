import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, CalendarClock, Flame, Battery, Trophy, Lock, Check, Clock } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { CHART_TEXT } from "../statistics/chartTheme";
import {
  buildMomentum, chargeOf, CHAPTERS, MOM_DECAY_PER_REST_DAY, MOM_MAX, SEASON_WEEKS,
  type MomentumState, type Slot,
} from "./momentumEngine";

const MONO = "'JetBrains Mono', monospace";
const HOT = "#F97316", COOL = "#22D3EE";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}
function Head({ icon: Icon, title, hint }: { icon: typeof Zap; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
      <Icon className="w-4 h-4 self-center text-white/70" />
      <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">{title}</h2>
      {hint && <span className="ml-auto text-[10px] text-gray-500 truncate">{hint}</span>}
    </div>
  );
}

/** Il momentum come batteria: dieci tacche che si spengono da sole. */
function Gauge({ value }: { value: number }) {
  const cells = 10, lit = Math.round((value / MOM_MAX) * cells);
  const col = value >= 70 ? HOT : value >= 40 ? "#FBBF24" : value >= 15 ? COOL : "#64748B";
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col-reverse gap-1">
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className="mo-cell block w-9 h-2.5 rounded-sm transition-colors"
            style={{ background: i < lit ? col : "#ffffff0f", boxShadow: i < lit ? `0 0 10px ${col}66` : "none" }} />
        ))}
      </div>
      <div>
        <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500">Momentum</div>
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: col }}>{value}</span>
          <span className="text-sm font-black text-gray-600">/{MOM_MAX}</span>
        </div>
      </div>
    </div>
  );
}

/** Andamento del momentum: barra per ogni giorno, piena se hai corso. */
function MomentumStrip({ st }: { st: MomentumState }) {
  const h = st.history;
  if (h.length < 2) return null;
  const W = 700, H = 90;
  const bw = W / h.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} role="img" aria-label="Momentum degli ultimi 90 giorni">
      <line x1="0" x2={W} y1={H - 12} y2={H - 12} stroke="#ffffff14" />
      {h.map((p, i) => {
        const bh = (p.momentum / MOM_MAX) * (H - 20);
        const col = p.momentum >= 70 ? HOT : p.momentum >= 40 ? "#FBBF24" : COOL;
        return (
          <g key={p.day}>
            <rect x={i * bw} y={H - 12 - bh} width={Math.max(1, bw - 0.8)} height={Math.max(0.5, bh)}
              fill={col} fillOpacity={p.ran ? 0.85 : 0.3} rx="1" />
            {p.ran && <circle cx={i * bw + bw / 2} cy={H - 6} r="1.6" fill={col} />}
          </g>
        );
      })}
    </svg>
  );
}

// ── PAGINA ────────────────────────────────────────────────────────────────────
export function GamificationV4() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const [today, setToday] = useState(() => new Date().toISOString());
  useEffect(() => {
    const sync = () => setToday(new Date().toISOString());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  const st = useMemo(() => buildMomentum(runs, today), [runs, today]);
  const [pick, setPick] = useState<Slot | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".mo-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.05, ease: "power3.out" });
      gsap.from(".mo-cell", { scaleY: 0, transformOrigin: "bottom", duration: 0.4, stagger: 0.03, ease: "power3.out", delay: 0.15 });
      gsap.from(".mo-slot", { opacity: 0, scale: 0.9, duration: 0.3, stagger: 0.008, ease: "power2.out", delay: 0.25 });
    }, root);
    return () => c.revert();
  }, [st.ok]);

  if (!st.ok) return (
    <main className="flex-1 grid place-items-center text-gray-500">
      <p className="text-sm font-black uppercase tracking-widest">Servono almeno 3 corse per misurare il momentum</p>
    </main>
  );

  const maxSp = Math.max(1, ...st.grid.map((g) => g.sp));
  const shown = pick ?? st.best;
  const shownSession = shown ? st.sessions.find((s) => s.id === shown.sessionId) : null;
  const shownDay = shown ? st.days[shown.dayOffset] : null;
  const todaySlot = shown ? st.grid.find((g) => g.sessionId === shown.sessionId && g.dayOffset === 0) : null;

  return (
    <main ref={root} className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-8 text-white">

        {/* ── STATO ──────────────────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] items-stretch">
          <Card className="mo-rise p-5 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(110% 120% at 100% 0%, ${st.momentum >= 60 ? HOT : COOL}1a, transparent 60%)` }} />
            <div className="relative flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[#F97316]" />
              <h1 className="text-lg font-black tracking-tight uppercase italic">Momen<span className="text-[#F97316]">tum</span></h1>
            </div>
            <div className="relative"><Gauge value={st.momentum} /></div>

            <div className="relative grid grid-cols-2 gap-2 mt-5">
              <Stat label="Moltiplicatore ora" value={`×${st.multiplierNow.toFixed(2)}`} col={st.multiplierNow >= 1.8 ? "#22C55E" : st.multiplierNow >= 1.2 ? "#FBBF24" : "#F43F5E"} />
              <Stat label="Ultima uscita" value={st.daysSinceLastRun === 0 ? "oggi" : `${st.daysSinceLastRun} gg fa`} />
              <Stat label="Giorni di fila" value={String(st.streakDays)} />
              <Stat label="Settimane piene" value={String(st.streakWeeks)} />
            </div>

            <div className="relative mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
              style={{ background: st.zeroIn <= 3 ? "#F43F5E14" : "#ffffff08", color: st.zeroIn <= 3 ? "#FCA5A5" : CHART_TEXT.muted }}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {st.momentum === 0
                ? <>Momentum a zero: la prossima corsa vale la carica base, senza bonus.</>
                : <>Senza correre, il momentum si azzera fra <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.zeroIn}</b> giorni.</>}
            </div>
          </Card>

          {/* ── STAGIONE ─────────────────────────────────────────────────── */}
          <Card className="mo-rise p-5">
            <div className="flex flex-wrap items-baseline gap-2 mb-1">
              <Trophy className="w-4 h-4 self-center text-[#C0FF00]" />
              <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">Stagione · {SEASON_WEEKS} settimane</h2>
              <span className="ml-auto text-[10px] text-gray-500" style={{ fontFamily: MONO }}>
                {st.daysLeft} giorni alla chiusura
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black tabular-nums leading-none" style={{ fontFamily: MONO }}>{st.sp}</span>
              <span className="text-xs font-black text-gray-500">SP</span>
              <span className="text-[11px] text-gray-500 ml-2" style={{ fontFamily: MONO }}>+{st.spPerWeek}/settimana</span>
            </div>

            <ChapterTrack st={st} />

            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
                <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-1">Prossimo capitolo</div>
                {st.nextChapter ? (
                  <>
                    <div className="text-[14px] font-black uppercase text-white">{st.nextChapter.n}. {st.nextChapter.name}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      mancano <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.toNext}</b> SP
                      {st.etaIso
                        ? <> · lo tocchi il <b className="text-white">{st.etaIso}</b>{!st.etaInSeason && <span className="text-[#F43F5E]"> — fuori stagione</span>}</>
                        : <span className="text-[#F43F5E]"> · fermo, non ci arrivi</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2 leading-snug">{st.nextChapter.meaning}</div>
                  </>
                ) : <div className="text-[13px] font-black text-[#C0FF00]">Stagione completata.</div>}
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
                <div className="text-[9px] font-black tracking-[0.25em] uppercase text-gray-500 mb-1">Se tieni questo ritmo</div>
                <div className="text-[14px] font-black uppercase" style={{ color: "#C0FF00" }}>
                  {st.projectedChapter ? `${st.projectedChapter.n}. ${st.projectedChapter.name}` : "sotto il primo capitolo"}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  chiudi a <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{st.projectedSp}</b> SP
                </div>
                <div className="text-[11px] text-gray-500 mt-2 leading-snug">{st.projectedChapter?.reward ?? "Serve alzare la frequenza delle uscite."}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── LA GRIGLIA ─────────────────────────────────────────────────── */}
        <Card className="mo-rise mt-5 overflow-hidden">
          <Head icon={CalendarClock} title="Quando conviene farla" hint="stessa seduta, giorni diversi: quanto vale" />
          <div className="px-4 pb-4 overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "104px repeat(7, 1fr)" }}>
                <span />
                {st.days.map((d) => (
                  <div key={d.offset} className="text-center pb-1">
                    <div className={`text-[10px] font-black uppercase tracking-wider ${d.offset === 0 ? "text-white" : "text-gray-500"}`}>{d.label}</div>
                    <div className="text-[8.5px] text-gray-600" style={{ fontFamily: MONO }}>mom {d.momentum}</div>
                  </div>
                ))}

                {st.sessions.map((s) => (
                  <FragmentRow key={s.id}>
                    <div className="flex items-center gap-2 pr-2">
                      <span className="w-1.5 h-7 rounded-full shrink-0" style={{ background: s.zone.color }} />
                      <div className="min-w-0">
                        <div className="text-[11.5px] font-bold text-white/90 truncate">{s.label}</div>
                        <div className="text-[9px] text-gray-500 truncate">{s.detail}</div>
                      </div>
                    </div>
                    {st.days.map((d) => {
                      const cell = st.grid.find((g) => g.sessionId === s.id && g.dayOffset === d.offset)!;
                      const heat = cell.sp / maxSp;
                      const isBest = st.best?.sessionId === s.id && st.best?.dayOffset === d.offset;
                      const isPick = shown?.sessionId === s.id && shown?.dayOffset === d.offset;
                      return (
                        <button key={d.offset} type="button" onClick={() => setPick(cell)}
                          aria-label={`${s.label} fra ${d.offset} giorni: ${cell.sp} SP, moltiplicatore ${cell.mult}`}
                          className="mo-slot rounded-lg py-2 text-center transition-transform hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-white/40"
                          style={{
                            background: `rgba(249,115,22,${0.08 + heat * 0.42})`,
                            border: isPick ? "1px solid rgba(255,255,255,0.55)" : isBest ? `1px solid ${HOT}` : "1px solid rgba(255,255,255,0.06)",
                          }}>
                          <div className="text-[14px] font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: heat > 0.75 ? "#fff" : "#E5E7EB" }}>{cell.sp}</div>
                          <div className="text-[9px] tabular-nums text-gray-400" style={{ fontFamily: MONO }}>×{cell.mult.toFixed(2)}</div>
                        </button>
                      );
                    })}
                  </FragmentRow>
                ))}
              </div>
            </div>
          </div>

          {shown && shownSession && shownDay && (
            <div className="mx-4 mb-4 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12.5px]">
                <Flame className="w-4 h-4 self-center" style={{ color: HOT }} />
                <b className="text-white">{shownSession.label}</b>
                <span className="text-gray-400">{shownDay.label === "oggi" ? "oggi" : shownDay.label === "domani" ? "domani" : `${shownDay.label} ${shownDay.iso.slice(5)}`}</span>
                <span className="text-gray-500">→</span>
                <b className="tabular-nums" style={{ fontFamily: MONO, color: HOT }}>{shown.sp} SP</b>
                <span className="text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>(×{shown.mult.toFixed(2)})</span>
              </div>
              <p className="text-[11.5px] text-gray-400 mt-1.5 leading-relaxed">
                {todaySlot && shown.dayOffset > 0 && shown.sp !== todaySlot.sp && (
                  shown.sp > todaySlot.sp
                    ? <>Aspettare conviene: la stessa seduta oggi vale <b className="text-white">{todaySlot.sp} SP</b>, spostata vale <b style={{ color: "#22C55E" }}>+{shown.sp - todaySlot.sp}</b>.</>
                    : <>Aspettare costa: oggi vale <b className="text-white">{todaySlot.sp} SP</b>, spostata perde <b style={{ color: "#F43F5E" }}>{shown.sp - todaySlot.sp}</b> — il momentum cala più di quanto la finestra ti restituisca.</>
                )}
                {shown.dayOffset === 0 && <>È il giorno stesso: nessun calo di momentum, la finestra è quella che è.</>}
                {" "}Il momentum quel giorno sarà <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{shown.momentum}</b> se non esci prima.
              </p>
            </div>
          )}
        </Card>

        {/* ── STORICO + BANCO ────────────────────────────────────────────── */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] items-start">
          <Card className="mo-rise">
            <Head icon={Battery} title="Il momentum negli ultimi 90 giorni" hint="barra piena = giorno con corsa" />
            <div className="px-4 pb-4"><MomentumStrip st={st} /></div>
            <div className="px-5 pb-5 text-[11.5px] text-gray-400 leading-relaxed">
              Ogni giorno di stop toglie <b className="text-white">{MOM_DECAY_PER_REST_DAY.toString().replace(".", ",")}</b> punti.
              Una seduta di ripetute ne rimette <b className="text-white">{Math.round(chargeOf(55, "vo2"))}</b>,
              un lento da un'ora <b className="text-white">{Math.round(chargeOf(60, "easy"))}</b>,
              un recupero <b className="text-white">{Math.round(chargeOf(35, "recovery"))}</b>. È per questo che
              due uscite corte a metà settimana tengono su il momentum meglio di un lungo solo la domenica.
            </div>
          </Card>

          <Card className="mo-rise">
            <Head icon={Flame} title="Cosa hanno reso le tue ultime uscite" hint="il giudizio è sul quando, non sul quanto" />
            <div className="divide-y divide-white/5 max-h-[460px] overflow-y-auto">
              {st.banked.map((b) => (
                <div key={b.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-1 w-1.5 h-10 rounded-full shrink-0" style={{ background: b.zone.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-white/90 truncate">{b.name}</div>
                    <div className="text-[10px] text-gray-500" style={{ fontFamily: MONO }}>
                      {b.date} · {b.km} km · carica {b.charge} · finestra ×{b.win.toFixed(2)} · {b.gap === 0 ? "stesso giorno" : `${b.gap} gg dopo`}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">{b.timing}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: HOT }}>{b.sp}</div>
                    <div className="text-[9px] text-gray-500 tabular-nums" style={{ fontFamily: MONO }}>×{b.mult.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

/** I figli finiscono dritti nella griglia del genitore: niente wrapper che rompa le colonne. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Stat({ label, value, col }: { label: string; value: string; col?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
      <div className="text-[8.5px] font-black tracking-[0.2em] uppercase text-gray-500">{label}</div>
      <div className="text-[17px] font-black tabular-nums leading-tight" style={{ fontFamily: MONO, color: col ?? "#fff" }}>{value}</div>
    </div>
  );
}

function ChapterTrack({ st }: { st: MomentumState }) {
  const max = CHAPTERS[CHAPTERS.length - 1].sp;
  const pct = Math.min(100, (st.sp / max) * 100);
  const projPct = Math.min(100, (st.projectedSp / max) * 100);
  return (
    <div>
      <div className="relative h-3 rounded-full bg-white/8 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full opacity-30"
          style={{ width: `${projPct}%`, background: "repeating-linear-gradient(115deg, #C0FF0055 0 6px, transparent 6px 12px)" }} />
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${HOT}, #C0FF00)` }} />
      </div>
      <div className="relative mt-2 h-[54px]">
        {CHAPTERS.map((c) => {
          const left = (c.sp / max) * 100;
          const done = st.sp >= c.sp;
          return (
            <div key={c.n} className="absolute -translate-x-1/2 text-center" style={{ left: `${left}%`, width: 86 }}>
              <span className="grid place-items-center w-5 h-5 rounded-full mx-auto mb-1"
                style={{ background: done ? "#C0FF001f" : "#ffffff0a", border: `1px solid ${done ? "#C0FF00" : "#ffffff1a"}` }}>
                {done ? <Check className="w-3 h-3 text-[#C0FF00]" /> : <Lock className="w-2.5 h-2.5 text-gray-600" />}
              </span>
              <div className={`text-[9px] font-black uppercase leading-tight ${done ? "text-white" : "text-gray-600"}`}>{c.name}</div>
              <div className="text-[8.5px] text-gray-600 tabular-nums" style={{ fontFamily: MONO }}>{c.sp}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
