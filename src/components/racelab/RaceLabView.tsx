import { useEffect, useMemo, useRef, useState } from "react";
import { Target, FlaskConical, TrendingDown, Users, Beaker, Gauge } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi, invalidateCache } from "../../hooks/useApi";
import { getRuns, patchRaceLab } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { Run, RunsResponse } from "../../types/api";
import { fmtClock } from "../gamification/gamiCore";
import { usePhysio, fmtDate } from "../gamification/usePhysio";
import { humanDays } from "../gamification/physioEngine";
import {
  CLASS_LABEL, REFERENCE, currentPlan, defaultSetup, fastEfforts, fmtPaceSec, planGoal, whatIf,
  type Conditions, type Effort, type Factor, type RaceSetup,
} from "./raceLabEngine";
import { DEFAULT_SHOE_ID, SHOES, SURFACE, TAPERS, shoeById, type SurfaceId, type TaperKind } from "./shoeLab";

const MONO = "'JetBrains Mono', monospace";
const LIT = "#C0FF00";

/**
 * IL BANCO DI PROVA
 * ════════════════════════════════════════════════════════════════════════════
 * Due domande che ogni atleta si fa e a cui nessuna pagina rispondeva.
 *
 *   "Quando arrivo al mio obiettivo, e cosa devo fare per arrivarci?"
 *   "Quella prova, con altre scarpe e dieci gradi in meno, quanto valeva?"
 *
 * E soprattutto la terza, che nasce dalle prime due messe insieme: il tempo che
 * mi manca è forma che devo costruire, o è una giornata che non ho avuto?
 * Perché fra le due c'è una differenza di sei mesi.
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

// ══ SEZIONE 1 · L'OBIETTIVO ═══════════════════════════════════════════════════
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
      physio.climate[new Date(physio.model.today * 86400000).getUTCMonth()],
    );
    return planGoal(physio.model, dist.m, targetSec, {
      deadlineDays, easyPaceSec: easyPace, setup, vdot: physio.vdot, current: now,
      plan: { ...now, km, qualitySessions: quality, qualityMinutes: 26, longRunMinutes: longRun },
    });
  }, [physio, targetSec, dist.m, deadlineDays, easyPace, km, quality, longRun, setup]);

  const pct = result ? Math.round(result.probability * 100) : 0;
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
                  {deadlineDays ? "Probabilità il giorno della gara" : "Probabilità alla data affidabile"}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: probCol }}>{pct}</span>
                  <span className="text-lg font-black text-gray-600">%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: probCol }} />
                </div>
                <p className="mt-2 text-[10.5px] text-gray-500 leading-relaxed">
                  {result.gapSec == null || Math.abs(result.gapSec) < 3
                    ? <>Arriveresti giusto sul tempo. </>
                    : result.gapSec > 0
                      ? <>Ti mancherebbero <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(result.gapSec)}</b>. </>
                      : <>Avresti <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(-result.gapSec)}</b> di margine. </>}
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
          </>
        )}
      </div>
    </Card>
  );
}

// ══ SEZIONE 2 · IL CALCOLATORE ════════════════════════════════════════════════
function CalculatorSection({ efforts, base, onSelect, onAnnotate }: {
  efforts: Effort[];
  base: Effort | null;
  onSelect: (id: string) => void;
  onAnnotate: (id: string, patch: { shoe_id?: string; taper?: TaperKind; rpe?: number | null }) => void;
}) {
  const [shoeId, setShoeId] = useState("alphafly3");
  const [tempC, setTempC] = useState(10);
  const [taper, setTaper] = useState<TaperKind>("full");
  const [nitrate, setNitrate] = useState(true);
  const [surface, setSurface] = useState<SurfaceId>("road");
  const [pack, setPack] = useState(true);
  const [elev, setElev] = useState(0);
  const [distId, setDistId] = useState("5k");

  const dist = DISTANCES.find((d) => d.id === distId)!;

  const result = useMemo(() => {
    if (!base) return null;
    const target: Conditions = {
      ...REFERENCE, shoeId, taper, tempC, humidity: 55, nitrate, surface, pack, elevationGain: elev,
    };
    return whatIf(base, target, dist.m);
  }, [base, shoeId, taper, tempC, nitrate, surface, pack, elev, dist.m]);

  const asIs = useMemo(
    () => (base ? whatIf(base, {
      ...REFERENCE, shoeId: base.shoeId, taper: base.taper,
      tempC: base.tempC ?? 12, humidity: base.humidity, elevationGain: base.elevationGain,
    }, dist.m) : null),
    [base, dist.m],
  );

  if (!base) {
    return (
      <Card className="rl-rise">
        <Head icon={FlaskConical} title="E se invece…" />
        <p className="px-5 pb-5 text-[12px] text-gray-500">
          Nessuna prova veloce abbastanza recente da usare come base. Sincronizza le corse, o corri qualcosa di forte.
        </p>
      </Card>
    );
  }

  const shoe = shoeById(shoeId)!;
  const delta = asIs && result ? asIs.sec - result.sec : 0;

  return (
    <Card className="rl-rise overflow-hidden">
      <Head icon={FlaskConical} title="E se invece…" hint="una tua prova reale, in condizioni che non hai avuto" />
      <div className="px-5 pb-5">
        {/* la prova di partenza, con le sue annotazioni */}
        <div className="rounded-xl border border-white/8 bg-black/25 p-3.5">
          <Field label="Prova di riferimento">
            <Select value={base.id} onChange={onSelect}>
              {efforts.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.date} · {e.km} km a {fmtPaceSec(e.paceSec)}/km{e.tempC != null ? ` · ${Math.round(e.tempC)}°` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            <Select value={base.shoeId} onChange={(v) => onAnnotate(base.id, { shoe_id: v })}>
              {SHOES.map((s) => (
                <option key={s.id} value={s.id}>{s.brand === "—" ? s.name : `${s.brand} ${s.name}`}</option>
              ))}
            </Select>
            <Select value={base.taper} onChange={(v) => onAnnotate(base.id, { taper: v as TaperKind })}>
              {TAPERS.map((t) => <option key={t.id} value={t.id}>Taper: {t.label.toLowerCase()}</option>)}
            </Select>
            <Select value={base.rpe == null ? "" : String(base.rpe)}
              onChange={(v) => onAnnotate(base.id, { rpe: v === "" ? null : +v })}>
              <option value="">RPE: non indicato</option>
              {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6].map((r) => (
                <option key={r} value={r}>RPE {r}{r >= 9.5 ? " · a tutta" : r >= 8 ? " · quasi gara" : " · controllata"}</option>
              ))}
            </Select>
          </div>
          <p className="mt-2 text-[10.5px] text-gray-500">
            Al netto di scarpa, caldo, pendenza e margine: <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>
              {fmtPaceSec(base.refPaceSec)}/km</b>. È il numero con cui questa prova si confronta con qualunque altra.
          </p>
        </div>

        {/* le condizioni ipotetiche */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Distanza"><Select value={distId} onChange={setDistId}>
            {DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select></Field>
          <Field label="Scarpa"><Select value={shoeId} onChange={setShoeId}>
            {SHOES.map((s) => (
              <option key={s.id} value={s.id}>{s.brand === "—" ? s.name : `${s.brand} ${s.name}`}</option>
            ))}
          </Select></Field>
          <Field label="Taper"><Select value={taper} onChange={(v) => setTaper(v as TaperKind)}>
            {TAPERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select></Field>
          <Field label="Superficie"><Select value={surface} onChange={(v) => setSurface(v as SurfaceId)}>
            {SURFACE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select></Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Slider label="Temperatura" value={tempC} min={-2} max={38} step={1} onChange={setTempC} unit="°C" />
          <Slider label="Dislivello del percorso" value={elev} min={0} max={600} step={20} onChange={setElev} unit="m" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Toggle on={nitrate} onClick={() => setNitrate(!nitrate)} icon={Beaker} label="Succo di barbabietola" />
          <Toggle on={pack} onClick={() => setPack(!pack)} icon={Users} label="In gara / in gruppo" />
        </div>

        {result && asIs && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr] items-start">
            <div className="rounded-xl border p-4" style={{ borderColor: `${LIT}33`, background: `${LIT}0d` }}>
              <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1">Avresti corso</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tabular-nums leading-none" style={{ fontFamily: MONO, color: LIT }}>
                  {fmtClock(result.sec)}
                </span>
                <span className="text-[11px] text-gray-500">sui {dist.label}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1.5" style={{ fontFamily: MONO }}>
                {fmtPaceSec(result.paceSec)}/km · ± {Math.round(result.bandSec)}s
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 text-[11.5px] text-gray-400 leading-relaxed">
                Nelle condizioni della prova originale ({shoeById(base.shoeId)?.name}
                {base.tempC != null && `, ${Math.round(base.tempC)}°`}) sulla stessa distanza faresti{" "}
                <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(asIs.sec)}</b>.
              </div>
              {delta !== 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[13px] font-black"
                  style={{ color: delta > 0 ? "#22C55E" : "#F43F5E" }}>
                  <TrendingDown className="w-4 h-4" style={{ transform: delta > 0 ? "none" : "scaleY(-1)" }} />
                  <span className="tabular-nums" style={{ fontFamily: MONO }}>
                    {delta > 0 ? "−" : "+"}{fmtClock(Math.abs(delta))}
                  </span>
                  <span className="text-[10px] font-normal text-gray-500">
                    ({(Math.abs(delta) / dist.m * 1000).toFixed(1)} s/km)
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/8 bg-black/25 p-4">
              <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-1">Da dove arrivano i secondi</div>
              <p className="text-[10px] text-gray-600 mb-2">Rispetto alla flat da gara a 12 °C, senza taper e da solo.</p>
              <div className="divide-y divide-white/5">
                {result.factors.map((f) => <FactorRow key={f.id} f={f} />)}
              </div>
              <p className="mt-3 pt-3 border-t border-white/10 text-[10.5px] text-gray-500 leading-relaxed">
                <b className="text-gray-400">{shoe.brand} {shoe.name}</b> — {CLASS_LABEL[shoe.cls]}, {shoe.grams} g,
                risparmio metabolico stimato {shoe.economyPct.toFixed(1)}% ± {shoe.uncertaintyPct.toFixed(1)}.
                Il risparmio di ossigeno non è guadagno di cronometro: se ne traduce circa tre quarti.
              </p>
            </div>
          </div>
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Annotazioni appena salvate: la lista corse è in cache, l'ottimistico evita l'attesa. */
  const [local, setLocal] = useState<Record<string, Run["race_lab"]>>({});

  const annotated = useMemo(
    () => runs.map((r) => (local[r.id] ? { ...r, race_lab: local[r.id] } : r)),
    [runs, local],
  );
  const efforts = useMemo(
    () => fastEfforts(annotated, { maxPaceSec: 285, days: 180, defaultShoe: DEFAULT_SHOE_ID }),
    [annotated],
  );

  useEffect(() => {
    if (!selectedId && efforts.length) setSelectedId(efforts[0].id);
  }, [efforts, selectedId]);

  useEffect(() => {
    const c = gsap.context(() => {
      gsap.from(".rl-rise", { opacity: 0, y: 14, duration: 0.45, stagger: 0.06, ease: "power3.out" });
    }, root);
    return () => c.revert();
  }, [physio.ok]);

  const onAnnotate = (id: string, patch: { shoe_id?: string; taper?: TaperKind; rpe?: number | null }) => {
    const run = annotated.find((r) => r.id === id);
    const next = { ...(run?.race_lab ?? {}), ...patch };
    setLocal((prev) => ({ ...prev, [id]: next }));
    patchRaceLab(id, patch)
      .then(() => invalidateCache(API_CACHE.RUNS))
      .catch(() => { /* l'ottimistico resta: si risincronizza al prossimo caricamento */ });
  };

  const base = efforts.find((e) => e.id === selectedId) ?? efforts[0] ?? null;

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

        <div className="mt-5">
          <CalculatorSection efforts={efforts} base={base} onSelect={setSelectedId} onAnnotate={onAnnotate} />
        </div>

        <Card className="rl-rise mt-5">
          <Head icon={Gauge} title="Su cosa poggiano questi numeri" />
          <div className="px-5 pb-5 grid gap-2.5 text-[11.5px] text-gray-400 leading-relaxed">
            <p>
              <b className="text-white">Scarpe.</b> Gli studi misurano il costo metabolico a velocità fissa, non
              il tempo di gara: il "4%" del nome commerciale vale circa il 3% di cronometro. Un confronto diretto
              in laboratorio fra tutti i modelli di punta non esiste — le stime vengono da studi diversi, e ogni
              voce porta scritta la sua incertezza. Le differenze fra le super scarpe di vertice sono dentro il
              rumore: sceglierne una per mezzo decimo di percentuale non ha senso, sceglierla contro un super
              trainer sì.
            </p>
            <p>
              <b className="text-white">Doppio conteggio, evitato.</b> Nell'obiettivo il guadagno di una scarpa è
              calcolato rispetto a quella con cui hai corso le prove da cui viene la stima, non rispetto a una
              flat: quel vantaggio è già dentro il tuo VDOT, e contarlo di nuovo gonfierebbe tutto.
            </p>
            <p>
              <b className="text-white">Temperatura.</b> Stesso modello del resto dell'app, con l'umidità che pesa
              solo sopra i 20 °C e il costo che cresce con la distanza. Se non scegli una temperatura, la
              previsione usa il clima tipico del mese in cui cade la data — letto dalle tue corse, non da una tabella.
            </p>
            <p>
              <b className="text-white">Taper e nitrati.</b> Meta-analisi, non singoli studi. Il nitrato rende molto
              meno a chi è già molto allenato, e il modello lo scala sul tuo VDOT.
            </p>
            <p>
              <b className="text-white">RPE.</b> Serve solo a stimare quanto margine era rimasto in una prova non
              massimale. Non entra nel VDOT né nella soglia: un numero soggettivo non può correggere una misura.
            </p>
            <p>
              <b className="text-white">I vantaggi si compongono, non si sommano.</b> Tre miglioramenti del 2% non
              fanno il 6%, e più ipotesi si impilano più la banda di errore si allarga.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
