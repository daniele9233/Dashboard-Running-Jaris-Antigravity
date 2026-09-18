import { useEffect, useMemo, useRef, useState } from "react";
import { Target, FlaskConical, Users, Beaker } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi } from "../../hooks/useApi";
import { getRuns } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { RunsResponse } from "../../types/api";
import { fmtClock } from "../gamification/gamiCore";
import { usePhysio, fmtDate } from "../gamification/usePhysio";
import { climateAt, humanDays } from "../gamification/physioEngine";
import {
  currentPlan, defaultSetup, planGoal,
  type Factor, type RaceSetup,
} from "./raceLabEngine";
import { DEFAULT_SHOE_ID, SHOES, TAPERS, shoeById, type TaperKind } from "./shoeLab";
import { GoalTrajectory } from "./GoalTrajectory";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";

/**
 * IL BANCO DI PROVA
 * ════════════════════════════════════════════════════════════════════════════
 * La domanda che ogni atleta si fa e a cui nessuna pagina rispondeva:
 *
 *   "Quando arrivo al mio obiettivo, e cosa devo fare per arrivarci?"
 *
 * E dentro quella, la sua gemella: il tempo che mi manca è forma che devo
 * costruire, o è una giornata che non ho avuto? Perché fra le due c'è una
 * differenza di sei mesi.
 */

// ── pezzi di interfaccia ──────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}

function Head({ icon: Icon, title, hint }: { icon: typeof Target; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
      <Icon className="w-4 h-4 self-center text-white/70" />
      <h2 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">{title}</h2>
      {hint && <span className="ml-auto text-[10px] text-gray-500 truncate">{hint}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[13px] text-white outline-none " +
  "focus:border-[#C0FF00]/50 transition-colors";

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} style={{ fontFamily: MONO }}>
      {children}
    </select>
  );
}

function Slider({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] text-gray-400">{label}</span>
        <span className="text-[13px] font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
          {value}{unit && <span className="text-[10px] text-gray-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} className="w-full accent-[#C0FF00] cursor-pointer" />
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Beaker; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors border"
      style={{
        borderColor: on ? `${LIT}55` : "#ffffff14",
        background: on ? `${LIT}1a` : "transparent",
        color: on ? LIT : "#9CA3AF",
      }}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );
}

function FactorRow({ f }: { f: Factor }) {
  const pos = f.gainPct > 0;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pos ? "#22C55E" : "#F43F5E" }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold text-white/90">{f.label}</div>
        <div className="text-[10px] text-gray-500 leading-snug">{f.detail}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12.5px] font-black tabular-nums" style={{ fontFamily: MONO, color: pos ? "#22C55E" : "#F43F5E" }}>
          {pos ? "−" : "+"}{Math.abs(f.secPerKm).toFixed(1)}
        </div>
        <div className="text-[9px] text-gray-600">s/km</div>
      </div>
    </div>
  );
}

function parseClock(s: string): number | null {
  const parts = s.trim().split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const n = parts.map(Number);
  const sec = n.length === 3 ? n[0] * 3600 + n[1] * 60 + n[2] : n.length === 2 ? n[0] * 60 + n[1] : n[0];
  return sec > 0 ? sec : null;
}

const DISTANCES = [
  { id: "5k", label: "5 km", m: 5000 },
  { id: "10k", label: "10 km", m: 10000 },
  { id: "hm", label: "Mezza maratona", m: 21097 },
  { id: "fm", label: "Maratona", m: 42195 },
] as const;

/** La super scarpa più efficiente in rastrelliera: è la leva "scarpe da gara". */
const FASTEST_SHOE_ID = [...SHOES]
  .sort((a, b) => b.economyPct - a.economyPct)[0]?.id ?? DEFAULT_SHOE_ID;

/** I controlli delle condizioni di gara: gli stessi due volte in pagina. */
function SetupControls({ setup, onChange }: { setup: RaceSetup; onChange: (s: RaceSetup) => void }) {
  const useClimate = setup.tempC == null;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Scarpa da gara">
          <Select value={setup.shoeId} onChange={(v) => onChange({ ...setup, shoeId: v })}>
            {SHOES.map((s) => (
              <option key={s.id} value={s.id}>{s.brand === "—" ? s.name : `${s.brand} ${s.name}`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Taper">
          <Select value={setup.taper} onChange={(v) => onChange({ ...setup, taper: v as TaperKind })}>
            {TAPERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-gray-400">Temperatura della gara</span>
          <button type="button" onClick={() => onChange({ ...setup, tempC: useClimate ? 10 : null })}
            className="text-[10px] font-bold transition-colors"
            style={{ color: useClimate ? "#9CA3AF" : LIT }}>
            {useClimate ? "clima tipico del mese · scegli tu" : "torna al clima del mese"}
          </button>
        </div>
        {!useClimate && (
          <Slider label="" value={setup.tempC ?? 10} min={-2} max={38} step={1}
            onChange={(v) => onChange({ ...setup, tempC: v })} unit="°C" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Toggle on={setup.nitrate} onClick={() => onChange({ ...setup, nitrate: !setup.nitrate })}
          icon={Beaker} label="Succo di barbabietola" />
        <Toggle on={setup.pack} onClick={() => onChange({ ...setup, pack: !setup.pack })}
          icon={Users} label="In gara, non da solo" />
      </div>
    </div>
  );
}

// ══ L'OBIETTIVO ═══════════════════════════════════════════════════
function GoalSection({ physio }: { physio: ReturnType<typeof usePhysio> }) {
  const [distId, setDistId] = useState<string>("5k");
  const [timeStr, setTimeStr] = useState("19:50");
  const [deadline, setDeadline] = useState("");
  const [km, setKm] = useState(40);
  const [quality, setQuality] = useState(2);
  const [longRun, setLongRun] = useState(100);
  const [setup, setSetup] = useState<RaceSetup>(() => defaultSetup(DEFAULT_SHOE_ID));

  useEffect(() => {
    if (physio.ok && physio.weeklyKm > 0) setKm(Math.max(20, Math.round(physio.weeklyKm)));
  }, [physio.ok, physio.weeklyKm]);

  const dist = DISTANCES.find((d) => d.id === distId)!;
  const targetSec = parseClock(timeStr);
  const easyPace = physio.thresholdPaceSec > 0 ? physio.thresholdPaceSec * 1.22 : 340;

  const deadlineDays = useMemo(() => {
    if (!deadline) return null;
    const d = Math.floor(new Date(deadline + "T00:00:00Z").getTime() / 86400000);
    const diff = d - physio.model.today;
    return diff > 0 ? diff : null;
  }, [deadline, physio.model.today]);

  const result = useMemo(() => {
    if (!physio.ok || !targetSec) return null;
    const now = currentPlan(
      physio.weeklyKm,
      physio.weeklyZone.threshold + physio.weeklyZone.vo2,
      Math.max(60, physio.weeklyMinutes / 4),
      climateAt(physio.climate, physio.model.today),
    );
    return planGoal(physio.model, dist.m, targetSec, {
      deadlineDays, easyPaceSec: easyPace, setup, vdot: physio.vdot, current: now,
      plan: { ...now, km, qualitySessions: quality, qualityMinutes: 26, longRunMinutes: longRun },
      fastestShoeId: FASTEST_SHOE_ID,
    });
  }, [physio, targetSec, dist.m, deadlineDays, easyPace, km, quality, longRun, setup]);

  const pct = result ? Math.round(result.probability * 100) : 0;
  const pctNow = result ? Math.round(result.probabilityNow * 100) : 0;
  const deltaPct = pct - pctNow;
  const probCol = pct >= 80 ? "#22C55E" : pct >= 50 ? "#FBBF24" : "#F43F5E";
  const alreadyThere = result != null && targetSec != null && result.todaySec <= targetSec;

  return (
    <Card className="rl-rise overflow-hidden">
      <Head icon={Target} title="Il tuo obiettivo" hint="quando ci arrivi, con cosa, e cosa serve per arrivarci" />
      <div className="px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Distanza">
            <Select value={distId} onChange={setDistId}>
              {DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </Field>
          <Field label="Tempo obiettivo">
            <input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} placeholder="19:50"
              className={inputCls} style={{ fontFamily: MONO }} inputMode="numeric" />
          </Field>
          <Field label="Data della gara (facoltativa)">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className={inputCls} style={{ fontFamily: MONO }} />
          </Field>
        </div>

        {!targetSec && <p className="mt-3 text-[11px] text-[#FCA5A5]">Scrivi il tempo come mm:ss (o h:mm:ss per la maratona).</p>}

        {result && targetSec && (
          <>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-white/8 bg-black/30 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-2">Verdetto</div>

                {/* il controllo di realtà: forse il tempo ce l'hai già, e ti manca
                    solo la giornata giusta per tirarlo fuori */}
                {alreadyThere ? (
                  <p className="text-[15px] md:text-[17px] font-black leading-snug text-gray-200">
                    In queste condizioni <b style={{ color: LIT }}>{fmtClock(targetSec)}</b> lo faresti{" "}
                    <b style={{ color: LIT }}>oggi</b>: il modello ti dà{" "}
                    <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(result.todaySec)}</b>.
                    Non ti manca forma, ti manca la giornata.
                  </p>
                ) : result.etaPlan ? (
                  <>
                    <p className="text-[15px] md:text-[17px] font-black leading-snug text-gray-200">
                      Con questo piano <b style={{ color: LIT }}>{fmtClock(targetSec)}</b> sui {dist.label} diventa
                      possibile il <b className="text-white">{fmtDate(result.etaPlan.iso)}</b> —{" "}
                      {humanDays(result.etaPlan.days)}.
                    </p>
                    <p className="mt-2 text-[12.5px] text-gray-400 leading-relaxed">
                      {result.etaSafe ? (
                        <>Quella è la data in cui la previsione tocca il tempo: ci vai sopra una volta su due.
                          Perché diventi probabile (4 volte su 5) serve arrivare al{" "}
                          <b className="text-white">{fmtDate(result.etaSafe.iso)}</b> — {humanDays(result.etaSafe.days)}.</>
                      ) : (
                        <>È la data in cui la previsione tocca il tempo: una volta su due va, una no. Con questo
                          carico non arriva mai a essere una cosa su cui contare.</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] font-black leading-snug text-gray-200">{result.blocker}</p>
                )}

                <div className="mt-3 pt-3 border-t border-white/10 grid gap-1.5 text-[11.5px] text-gray-400 leading-relaxed">
                  <div>
                    <b className="text-white">Oggi, in queste condizioni:</b>{" "}
                    <b className="tabular-nums" style={{ fontFamily: MONO, color: LIT }}>{fmtClock(result.todaySec)}</b>
                  </div>
                  <div>
                    Al carico che tieni adesso ({Math.round(physio.weeklyKm)} km a settimana):{" "}
                    {result.etaNow
                      ? <b className="text-white">{fmtDate(result.etaNow.iso)}</b>
                      : <span className="text-[#FCA5A5]">non ci arrivi</span>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/30 p-4 flex flex-col justify-center">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-2">
                  Probabilità {deadlineDays ? "il giorno della gara" : `al ${fmtDate(result.horizon.iso)}`}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: probCol }}>{pct}</span>
                  <span className="text-lg font-black text-gray-600">%</span>
                  {/* il confronto che rende visibile il lavoro dei cursori */}
                  {deltaPct !== 0 && (
                    <span className="ml-1 text-[12px] font-black tabular-nums" style={{
                      fontFamily: MONO, color: deltaPct > 0 ? "#22C55E" : "#F43F5E",
                    }}>
                      {deltaPct > 0 ? "+" : "−"}{Math.abs(deltaPct)}
                    </span>
                  )}
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden relative">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: probCol }} />
                  {/* tacca del carico attuale: da qui parte il guadagno del piano */}
                  <div className="absolute top-0 bottom-0 w-[2px] bg-white/70"
                    style={{ left: `calc(${pctNow}% - 1px)` }} title="col carico di adesso" />
                </div>
                <p className="mt-2 text-[10.5px] text-gray-500 leading-relaxed">
                  Col carico che tieni adesso sarebbe{" "}
                  <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{pctNow}%</b>.{" "}
                  {result.gapSec == null || Math.abs(result.gapSec) < 3
                    ? <>Arriveresti giusto sul tempo. </>
                    : result.gapSec > 0
                      ? <>Al piano simulato ti mancherebbero <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(result.gapSec)}</b>. </>
                      : <>Col piano simulato avresti <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(-result.gapSec)}</b> di margine. </>}
                  {result.horizon.source === "carico-attuale" && !deadlineDays && (
                    <>La data di riferimento è quella in cui ci arriverebbe il carico di adesso: è ferma mentre muovi i cursori, così il numero si muove. </>
                  )}
                  Include la variabilità del giorno di gara: a forma identica due gare non danno lo stesso tempo.
                </p>
              </div>
            </div>

            {/* le condizioni con cui la corri */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-3">Con cosa la corri</div>
                <SetupControls setup={setup} onChange={setSetup} />
                <p className="mt-3 text-[10.5px] text-gray-500 leading-relaxed">
                  Tutto è misurato rispetto alle tue <b className="text-gray-400">{shoeById(setup.baselineShoeId)?.name}</b>{" "}
                  senza taper, perché è così che hai corso le prove da cui viene la stima. Cambiare scarpa qui
                  aggiunge solo la differenza, non il vantaggio pieno: altrimenti si conterebbe due volte.
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1">Cosa cambiano quelle scelte</div>
                {result.factors.length === 0 ? (
                  <p className="mt-2 text-[11.5px] text-gray-500 leading-relaxed">
                    Nessuna: stai chiedendo il tempo alle condizioni di sempre — le tue scarpe abituali, senza
                    taper, con il clima tipico del mese. Cambia qualcosa a sinistra e qui compare quanto vale.
                  </p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {result.factors.map((f) => <FactorRow key={f.id} f={f} />)}
                  </div>
                )}
              </div>
            </div>

            {/* il piano */}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-3">Il piano che stai simulando</div>
                <div className="grid gap-3">
                  <Slider label="Chilometri a settimana" value={km} min={20} max={140} step={5} onChange={setKm} unit="km" />
                  <Slider label="Sedute di qualità a settimana" value={quality} min={0} max={4} step={1} onChange={setQuality} unit="" />
                  <Slider label="Lungo settimanale" value={longRun} min={60} max={180} step={10} onChange={setLongRun} unit="min" />
                </div>
                {/* il numero che traduce i tre cursori in una sola grandezza */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500">
                      Tetto di adattamento
                    </span>
                    <span className="text-[15px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: LIT }}>
                      {result.ceilingPerMonth.toFixed(2).replace(".", ",")}
                      <span className="text-[9.5px] text-gray-500 font-normal ml-1">punti VDOT / mese</span>
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-gray-600 leading-relaxed">
                  È il tetto di adattamento: il corpo non migliora più in fretta di così, per quanto tu lo
                  carichi. Alzare i chilometri alza il tetto — con rendimenti decrescenti — e sposta anche il
                  punto in cui la curva si appiattisce.
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-3">Il minimo che basta</div>
                {result.suggested ? (
                  <>
                    <p className="text-[13px] text-gray-200 leading-relaxed">
                      <b style={{ color: LIT }}>{result.suggested.km} km a settimana</b>,{" "}
                      <b style={{ color: LIT }}>{result.suggested.qualitySessions} {result.suggested.qualitySessions === 1 ? "seduta" : "sedute"} di qualità</b>{" "}
                      da {result.suggested.qualityMinutes}′ di lavoro, e un lungo da{" "}
                      <b style={{ color: LIT }}>{result.suggested.longRunMinutes}′</b>.
                    </p>
                    <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
                      È il carico più leggero che porta all'obiettivo con almeno l'80% di probabilità
                      {deadlineDays ? " entro la data scelta" : ""}, in quelle condizioni di gara.
                    </p>
                    <button type="button" onClick={() => {
                      setKm(result.suggested!.km);
                      setQuality(result.suggested!.qualitySessions);
                      setLongRun(result.suggested!.longRunMinutes);
                    }} className="mt-3 text-[11px] font-black uppercase tracking-wide px-3 py-1.5 rounded-lg text-black transition-transform hover:scale-105"
                      style={{ background: LIT }}>
                      Usa questo piano
                    </button>
                  </>
                ) : (
                  <p className="text-[12.5px] text-gray-400 leading-relaxed">
                    Nessun carico ragionevole ci arriva{deadlineDays ? " entro quella data" : ""}. Serve più tempo,
                    una giornata migliore, o un obiettivo intermedio.
                  </p>
                )}
              </div>
            </div>

            {/* ── LA TRAIETTORIA: la stessa risposta, ma vista ── */}
            <div className="mt-4 rounded-xl border border-white/8 bg-black/25 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500">
                  Come ci arrivi
                </div>
                <div className="text-[10.5px] text-gray-500">
                  {dist.label} · {km} km a settimana · {quality} di qualità · lungo {longRun}′
                  {setup.tempC != null ? ` · ${Math.round(setup.tempC)}°` : " · clima del mese"}
                </div>
              </div>
              <GoalTrajectory
                curve={result.curve}
                targetSec={targetSec}
                deadlineDays={deadlineDays}
                etaPlanDays={result.etaPlan?.days ?? null}
                etaPlanIso={result.etaPlan?.iso ?? null}
                etaSafeDays={result.etaSafe?.days ?? null}
                etaSafeIso={result.etaSafe?.iso ?? null}
                horizonDays={result.horizon.days}
                distLabel={dist.label}
              />
            </div>

            {/* ── LE LEVE: forma contro giornata ── */}
            {result.levers.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1">
                  Cosa sposta la data
                </div>
                <p className="text-[10px] text-gray-600 mb-3">
                  Una leva alla volta, tutto il resto fermo. A sinistra quello che si costruisce in mesi,
                  a destra quello che si sceglie la mattina della gara.
                </p>
                <div className="grid gap-x-6 gap-y-1 lg:grid-cols-2">
                  {(["forma", "giornata"] as const).map((kind) => {
                    const rows = result.levers.filter((l) => l.kind === kind);
                    if (rows.length === 0) return null;
                    const maxGain = Math.max(...result.levers.map((l) => Math.abs(l.gainSec)), 1);
                    return (
                      <div key={kind}>
                        <div className="text-[9px] font-black tracking-[0.2em] uppercase mb-2"
                          style={{ color: kind === "forma" ? LIT : "#22D3EE" }}>
                          {kind === "forma" ? "Forma · mesi" : "Giornata · una scelta"}
                        </div>
                        <div className="divide-y divide-white/5">
                          {rows.map((l) => (
                            <div key={l.id} className="py-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[12px] font-bold text-white/90 flex-1 min-w-0 truncate">{l.label}</span>
                                <span className="text-[12.5px] font-black tabular-nums shrink-0"
                                  style={{
                                    fontFamily: MONO,
                                    color: Math.abs(l.gainSec) < 1 ? "#6B7280" : l.gainSec > 0 ? "#22C55E" : "#F43F5E",
                                  }}>
                                  {Math.abs(l.gainSec) < 1
                                    ? "—"
                                    : `${l.gainSec > 0 ? "−" : "+"}${fmtClock(Math.abs(l.gainSec))}`}
                                </span>
                                {l.probPoints !== 0 && Math.abs(l.gainSec) >= 1 && (
                                  <span className="text-[10px] font-black tabular-nums shrink-0 w-10 text-right"
                                    style={{ fontFamily: MONO, color: l.probPoints > 0 ? "#22C55E" : "#F43F5E" }}>
                                    {l.probPoints > 0 ? "+" : "−"}{Math.abs(l.probPoints)}%
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full transition-[width] duration-500"
                                  style={{
                                    width: `${Math.min(100, (Math.abs(l.gainSec) / maxGain) * 100)}%`,
                                    background: kind === "forma" ? LIT : "#22D3EE",
                                  }} />
                              </div>
                              <div className="mt-1 flex items-baseline justify-between gap-2">
                                <span className="text-[10px] text-gray-600 leading-snug">
                                  {l.detail}
                                  {/* la leva lenta che a questa data non paga ancora: dirlo, non tacerlo */}
                                  {Math.abs(l.gainSec) < 2 && l.gainSecLate >= 2 && (
                                    <> A questa data non paga ancora: sei mesi dopo vale{" "}
                                      <b className="text-gray-400 tabular-nums" style={{ fontFamily: MONO }}>
                                        {fmtClock(l.gainSecLate)}
                                      </b>.
                                    </>
                                  )}
                                </span>
                                {l.daysEarlier != null && l.daysEarlier !== 0 && (
                                  <span className="text-[10px] shrink-0 tabular-nums" style={{ fontFamily: MONO, color: "#9CA3AF" }}>
                                    {l.daysEarlier > 0 ? `${l.daysEarlier} gg prima` : `${-l.daysEarlier} gg dopo`}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

// ══ PAGINA ════════════════════════════════════════════════════════════════════
export function RaceLabView() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const physio = usePhysio(runs);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".rl-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.06, ease: "power3.out" });
    }, root);
    return () => c.revert();
  }, [physio.ok]);

  return (
    <main ref={root} className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-8 text-white">

        <div className="rl-rise mb-5 flex flex-wrap items-baseline gap-3">
          <FlaskConical className="w-6 h-6 text-[#C0FF00] self-center" />
          <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase italic">
            Banco di <span className="text-[#C0FF00]">prova</span>
          </h1>
          <p className="text-[12px] text-gray-500 max-w-2xl">
            Quanto della tua prestazione è forma, e quanto è la giornata che hai avuto. Le due cose si
            comprano in modi diversi: una in sei mesi, l'altra la mattina della gara.
          </p>
        </div>

        <GoalSection physio={physio} />

      </div>
    </main>
  );
}
