import { useEffect, useMemo, useRef, useState } from "react";
import { Target, FlaskConical, TrendingDown, Timer, Users, Beaker, Gauge } from "lucide-react";
import { gsap } from "../celebrations/gsapSetup";
import { useApi, invalidateCache } from "../../hooks/useApi";
import { getRuns, patchRaceLab } from "../../api";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import type { Run, RunsResponse } from "../../types/api";
import { fmtClock, predictSec } from "../gamification/gamiCore";
import { usePhysio, fmtDate } from "../gamification/usePhysio";
import { humanDays } from "../gamification/physioEngine";
import {
  CLASS_LABEL, REFERENCE, currentPlan, fastEfforts, fmtPaceSec, planGoal, whatIf,
  type Conditions, type Effort, type Factor,
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
 * La seconda sembra un gioco e non lo è: fra correre col super trainer a 28 °C
 * senza aver scaricato e correre con una piastra di carbonio a 10 °C con il
 * taper fatto ci sono più secondi al chilometro di quanti ne separino due mesi
 * di allenamento. Sapere quali di quei secondi si comprano la mattina della
 * gara e quali si guadagnano in sei mesi è la differenza fra programmare e
 * sperare.
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

// ── tempo mm:ss / h:mm:ss ─────────────────────────────────────────────────────
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

// ══ SEZIONE 1 · L'OBIETTIVO ═══════════════════════════════════════════════════
function GoalSection({ physio }: { physio: ReturnType<typeof usePhysio> }) {
  const [distId, setDistId] = useState<string>("5k");
  const [timeStr, setTimeStr] = useState("20:00");
  const [deadline, setDeadline] = useState("");
  const [km, setKm] = useState(() => Math.max(20, Math.round(physio.weeklyKm || 40)));
  const [quality, setQuality] = useState(2);
  const [longRun, setLongRun] = useState(100);

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
      deadlineDays, easyPaceSec: easyPace, current: now,
      plan: { ...now, km, qualitySessions: quality, qualityMinutes: 26, longRunMinutes: longRun },
    });
  }, [physio, targetSec, dist.m, deadlineDays, easyPace, km, quality, longRun]);

  const todaySec = physio.ok ? predictSec(dist.m, physio.vdotToday) : 0;
  const pct = result ? Math.round(result.probability * 100) : 0;
  const probCol = pct >= 80 ? "#22C55E" : pct >= 50 ? "#FBBF24" : "#F43F5E";

  return (
    <Card className="rl-rise overflow-hidden">
      <Head icon={Target} title="Il tuo obiettivo" hint="quando ci arrivi, e cosa serve per arrivarci" />
      <div className="px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Distanza">
            <Select value={distId} onChange={setDistId}>
              {DISTANCES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
          </Field>
          <Field label="Tempo obiettivo">
            <input value={timeStr} onChange={(e) => setTimeStr(e.target.value)} placeholder="20:00"
              className={inputCls} style={{ fontFamily: MONO }} inputMode="numeric" />
          </Field>
          <Field label="Data della gara (facoltativa)">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className={inputCls} style={{ fontFamily: MONO }} />
          </Field>
        </div>

        {!targetSec && (
          <p className="mt-3 text-[11px] text-[#FCA5A5]">Scrivi il tempo come mm:ss (o h:mm:ss per la maratona).</p>
        )}

        {result && targetSec && (
          <>
            {/* il verdetto */}
            <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-xl border border-white/8 bg-black/30 p-4">
                <div className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500 mb-2">Verdetto</div>
                {result.etaPlan ? (
                  <>
                    <p className="text-[15px] md:text-[17px] font-black leading-snug text-gray-200">
                      Con questo piano <b style={{ color: LIT }}>{fmtClock(targetSec)}</b> sui {dist.label} diventa
                      possibile il <b className="text-white">{fmtDate(result.etaPlan.iso)}</b> —{" "}
                      {humanDays(result.etaPlan.days)}, con circa {result.etaPlan.tempC}° in quel periodo.
                    </p>
                    <p className="mt-2 text-[12.5px] text-gray-400 leading-relaxed">
                      {result.etaSafe ? (
                        <>Quella è la data in cui la previsione tocca il tempo: ci vai sopra una volta su due.
                          Perché diventi probabile (4 volte su 5) serve arrivare al{" "}
                          <b className="text-white">{fmtDate(result.etaSafe.iso)}</b> — {humanDays(result.etaSafe.days)}.
                          È su quella che si prenota un pettorale.</>
                      ) : (
                        <>È la data in cui la previsione tocca il tempo: una volta su due va, una no. Con questo
                          carico non arriva mai a essere una cosa su cui contare.</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-[15px] font-black leading-snug text-gray-200">{result.blocker}</p>
                )}
                <div className="mt-3 grid gap-2 text-[11.5px] text-gray-400 leading-relaxed">
                  <div>
                    Oggi, con la temperatura di adesso, faresti{" "}
                    <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{fmtClock(todaySec)}</b>.
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
                      {deadlineDays ? " entro la data scelta" : ""}. Più di così non serve; meno non basta.
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
                    Nessun carico ragionevole ci arriva{deadlineDays ? " entro quella data" : ""}. Serve più tempo, o un
                    obiettivo intermedio: il modello si ferma a 140 km a settimana perché oltre non è più allenamento.
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
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-[#C0FF00] cursor-pointer" />
    </div>
  );
}

// ══ SEZIONE 2 · LE PROVE VELOCI ═══════════════════════════════════════════════
function EffortsSection({
  efforts, maxPace, setMaxPace, days, setDays, onAnnotate, selectedId, onSelect,
}: {
  efforts: Effort[];
  maxPace: number; setMaxPace: (v: number) => void;
  days: number; setDays: (v: number) => void;
  onAnnotate: (id: string, patch: { shoe_id?: string; taper?: TaperKind; rpe?: number | null }) => void;
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  return (
    <Card className="rl-rise overflow-hidden">
      <Head icon={Timer} title="Le tue prove veloci"
        hint="clicca una riga per usarla come base del calcolatore" />
      <div className="px-5 pb-3 flex flex-wrap gap-3">
        <Field label="Più veloci di">
          <Select value={String(maxPace)} onChange={(v) => setMaxPace(+v)}>
            {[240, 255, 270, 285, 300].map((p) => (
              <option key={p} value={p}>{fmtPaceSec(p)}/km</option>
            ))}
          </Select>
        </Field>
        <Field label="Negli ultimi">
          <Select value={String(days)} onChange={(v) => setDays(+v)}>
            <option value="30">30 giorni</option>
            <option value="90">3 mesi</option>
            <option value="180">6 mesi</option>
            <option value="365">12 mesi</option>
          </Select>
        </Field>
      </div>

      {efforts.length === 0 ? (
        <p className="px-5 pb-5 text-[12px] text-gray-500">
          Nessuna corsa sotto {fmtPaceSec(maxPace)}/km in questa finestra. Allarga il passo o il periodo.
        </p>
      ) : (
        <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
          {efforts.map((e) => (
            <EffortRow key={e.id} e={e} selected={e.id === selectedId}
              onSelect={() => onSelect(e.id)} onAnnotate={(p) => onAnnotate(e.id, p)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function EffortRow({ e, selected, onSelect, onAnnotate }: {
  e: Effort; selected: boolean; onSelect: () => void;
  onAnnotate: (patch: { shoe_id?: string; taper?: TaperKind; rpe?: number | null }) => void;
}) {
  const gain = e.paceSec - e.refPaceSec;
  return (
    <div className={`px-5 py-3 transition-colors ${selected ? "bg-[#C0FF00]/[0.06]" : "hover:bg-white/[0.02]"}`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-white/90 truncate">{e.name}</span>
            {selected && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0"
                style={{ background: `${LIT}22`, color: LIT }}>base</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
            {e.date} · {e.km} km · {fmtPaceSec(e.paceSec)}/km · {fmtClock(e.timeSec)}
            {e.tempC != null && ` · ${Math.round(e.tempC)}°`}
            {e.elevationGain > 20 && ` · ${Math.round(e.elevationGain)} m D+`}
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-black tabular-nums" style={{ fontFamily: MONO, color: LIT }}>
            {fmtPaceSec(e.refPaceSec)}
          </div>
          <div className="text-[9px] text-gray-600">al netto di tutto</div>
          {gain > 0.5 && (
            <div className="text-[9px] tabular-nums text-gray-500" style={{ fontFamily: MONO }}>
              −{Math.round(gain)}s/km
            </div>
          )}
        </div>
      </div>

      {/* le annotazioni: con cosa l'hai corsa */}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Select value={e.shoeId} onChange={(v) => onAnnotate({ shoe_id: v })}>
          {SHOES.map((s) => (
            <option key={s.id} value={s.id}>{s.brand === "—" ? s.name : `${s.brand} ${s.name}`}</option>
          ))}
        </Select>
        <Select value={e.taper} onChange={(v) => onAnnotate({ taper: v as TaperKind })}>
          {TAPERS.map((t) => <option key={t.id} value={t.id}>Taper: {t.label.toLowerCase()}</option>)}
        </Select>
        <Select value={e.rpe == null ? "" : String(e.rpe)} onChange={(v) => onAnnotate({ rpe: v === "" ? null : +v })}>
          <option value="">RPE: non indicato</option>
          {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6].map((r) => (
            <option key={r} value={r}>RPE {r}{r >= 9.5 ? " · a tutta" : r >= 8 ? " · quasi gara" : " · controllata"}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}

// ══ SEZIONE 3 · IL CALCOLATORE ════════════════════════════════════════════════
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

function CalculatorSection({ base }: { base: Effort | null }) {
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
          Scegli una prova qui a fianco e questa sezione ti dice quanto valeva in qualunque altra condizione.
        </p>
      </Card>
    );
  }

  const shoe = shoeById(shoeId)!;
  const delta = asIs && result ? asIs.sec - result.sec : 0;

  return (
    <Card className="rl-rise overflow-hidden">
      <Head icon={FlaskConical} title="E se invece…"
        hint={`base: ${base.name} del ${base.date}`} />
      <div className="px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
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
              <p className="text-[10px] text-gray-600 mb-2">
                Rispetto alla flat da gara a 12 °C, senza taper e da solo.
              </p>
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

// ══ PAGINA ════════════════════════════════════════════════════════════════════
export function RaceLabView() {
  const { data } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const runs = useMemo(() => data?.runs ?? [], [data]);
  const physio = usePhysio(runs);
  const root = useRef<HTMLDivElement>(null);

  const [maxPace, setMaxPace] = useState(270);
  const [days, setDays] = useState(90);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Annotazioni appena salvate: la lista corse è in cache, l'ottimistico evita l'attesa. */
  const [local, setLocal] = useState<Record<string, Run["race_lab"]>>({});

  const annotated = useMemo(
    () => runs.map((r) => (local[r.id] ? { ...r, race_lab: local[r.id] } : r)),
    [runs, local],
  );
  const efforts = useMemo(
    () => fastEfforts(annotated, { maxPaceSec: maxPace, days, defaultShoe: DEFAULT_SHOE_ID }),
    [annotated, maxPace, days],
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

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] items-start">
          <EffortsSection
            efforts={efforts} maxPace={maxPace} setMaxPace={setMaxPace}
            days={days} setDays={setDays} onAnnotate={onAnnotate}
            selectedId={base?.id ?? null} onSelect={setSelectedId}
          />
          <CalculatorSection base={base} />
        </div>

        {/* la nota che rende il resto leggibile invece che oracolare */}
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
              <b className="text-white">Temperatura.</b> Stesso modello usato dal resto dell'app, con l'umidità che
              pesa solo sopra i 20 °C e il costo che cresce con la distanza.
            </p>
            <p>
              <b className="text-white">Taper e nitrati.</b> Meta-analisi, non singoli studi. Il nitrato rende molto
              meno a chi è già molto allenato, e il modello lo scala sul tuo VDOT invece di promettere a tutti
              la stessa cosa.
            </p>
            <p>
              <b className="text-white">RPE.</b> Serve solo a stimare quanto margine era rimasto in una prova non
              massimale. Non entra nel VDOT né nella soglia: quella strada era già stata scartata perché un numero
              soggettivo non può correggere una misura.
            </p>
            <p>
              <b className="text-white">I vantaggi si compongono, non si sommano.</b> Tre miglioramenti del 2% non
              fanno il 6%, e più ipotesi si impilano più la banda di errore si allarga. Quando la previsione dice
              ± venti secondi, quei venti secondi sono parte della risposta.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
