import { Activity, CalendarClock, Flame, Gauge, Target, TrendingDown, TrendingUp } from "lucide-react";
import { fmtClock, predictSec } from "./gamiCore";
import { fmtDate } from "./usePhysio";
import { humanDays, type GoalEta, type PhysioState, type SystemState } from "./physioEngine";

const MONO = "'JetBrains Mono', monospace";

/**
 * IL VERDETTO — quello che si legge per primo su tutte e quattro le pagine.
 *
 * Le quattro gamification hanno ognuna la sua grammatica, e va bene così. Il
 * problema era un altro: nessuna cominciava rispondendo. Si apriva la pagina e
 * si trovava un punteggio, una curva, un albero — tutte cose vere, nessuna che
 * dicesse "sei a quattro mesi dal tuo traguardo, e ti frena la soglia".
 *
 * Questo blocco dice esattamente quello, con lo stesso motore sotto in tutte e
 * quattro, e poi lascia il posto al gioco di ciascuna. Tre riquadri, non dodici:
 * dove sei, cosa ti frena, cosa fare. Il resto della pagina è il dettaglio per
 * chi lo vuole.
 */

// ── pezzi ─────────────────────────────────────────────────────────────────────
function Tile({ label, icon: Icon, children, accent }: {
  label: string; icon: typeof Target; children: React.ReactNode; accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/30 p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 shrink-0" style={{ color: accent }} />
        <span className="text-[9px] font-black tracking-[0.22em] uppercase" style={{ color: accent }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function SystemBar({ s }: { s: SystemState }) {
  const Trend = s.trend28 > 1 ? TrendingUp : s.trend28 < -1 ? TrendingDown : null;
  const trendCol = s.trend28 > 1 ? "#22C55E" : s.trend28 < -1 ? "#F43F5E" : "#64748B";
  return (
    <div className="min-w-0" title={`${s.def.what} — si alimenta con ${s.def.from}.`}>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[10px] font-bold text-white/80 truncate">{s.def.name}</span>
        <span className="ml-auto text-[11px] font-black tabular-nums shrink-0"
          style={{ fontFamily: MONO, color: s.def.color }}>{s.pct}</span>
        {Trend && <Trend className="w-2.5 h-2.5 shrink-0" style={{ color: trendCol }} />}
      </div>
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${s.pct}%`, background: s.def.color }} />
      </div>
      {/* dove si ferma se non cambia niente: il tratto fantasma dietro la barra */}
      {s.settlesAt > s.pct + 3 && (
        <div className="mt-0.5 text-[8.5px] text-gray-600" style={{ fontFamily: MONO }}>
          → {s.settlesAt} se continui così
        </div>
      )}
    </div>
  );
}

/** La frase in cima: il traguardo più vicino, con la sua data. */
function headline(p: PhysioState): { big: React.ReactNode; sub: string } {
  const next = p.goals.find((g) => !g.done && g.iso);
  if (next) {
    return {
      big: <>Sei <b className="text-white">{next.human.replace(/^fra /, "a ")}</b> dal <b style={{ color: "#C0FF00" }}>{next.label}</b>.</>,
      sub: `Previsione per il ${fmtDate(next.iso!)}, quando da te ci saranno circa ${next.etaTempC}°. `
        + `Calcolata sul carico delle ultime sei settimane: se cambi, cambia la data.`,
    };
  }
  const stuck = p.goals.find((g) => !g.done);
  if (stuck) {
    return {
      big: <>Il <b style={{ color: "#C0FF00" }}>{stuck.label}</b> non arriva da solo.</>,
      sub: "Con il carico delle ultime sei settimane i sistemi si stabilizzano prima del traguardo. "
        + "Serve una dose in più, non altro tempo: qui sotto c'è quale.",
    };
  }
  return {
    big: <>Hai già in mano tutti i traguardi in lista.</>,
    sub: "Il motore è più avanti dei tuoi obiettivi dichiarati: è il momento di alzare l'asticella.",
  };
}

// ── il blocco ─────────────────────────────────────────────────────────────────
export function PhysioVerdict({ p }: { p: PhysioState }) {
  if (!p.ok) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-6 text-center">
        <p className="text-[12px] text-gray-500">
          Servono almeno cinque sedute per leggere i tuoi sistemi. Sincronizza le corse e torna qui.
        </p>
      </div>
    );
  }

  const h = headline(p);
  const lim = p.limiter;
  const rx = p.prescriptions[0];
  const sec5k = predictSec(5000, p.vdotToday);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="relative p-5 md:p-6">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(110% 130% at 8% 0%, #C0FF0014, transparent 62%)" }} />

        <div className="relative">
          <div className="text-[9px] font-black tracking-[0.3em] uppercase text-gray-500 mb-2">A che punto sei</div>
          <h2 className="text-xl md:text-[26px] font-black tracking-tight leading-snug text-gray-300 max-w-3xl">{h.big}</h2>
          <p className="mt-2 text-[12px] text-gray-500 leading-relaxed max-w-3xl">{h.sub}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile label="Oggi" icon={Gauge} accent="#22D3EE">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>
                  {fmtClock(sec5k)}
                </span>
                <span className="text-[10px] text-gray-500">sui 5K</span>
              </div>
              <div className="text-[10px] text-gray-500 mt-1" style={{ fontFamily: MONO }}>
                VDOT {p.vdot.toFixed(1)}
                {p.heatCost5kNow > 4 && <span className="text-[#FB923C]"> · −{p.heatCost5kNow}s per il caldo di adesso</span>}
              </div>
            </Tile>

            {lim && (
              <Tile label="Ti frena" icon={Activity} accent={lim.def.color}>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tabular-nums text-white" style={{ fontFamily: MONO }}>{lim.pct}</span>
                  <span className="text-[11px] font-bold truncate" style={{ color: lim.def.color }}>{lim.def.name}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 leading-snug">
                  {lim.weeklyDose < lim.weeklyFull
                    ? <>{Math.round(lim.weeklyDose)}′ a settimana contro i {lim.weeklyFull}′ che lo riempirebbero</>
                    : <>è al massimo che il tuo carico può reggere</>}
                </div>
              </Tile>
            )}

            {rx && (
              <Tile label="Fai questo" icon={Target} accent="#C0FF00">
                <div className="text-[13px] font-bold text-white leading-snug">{rx.title}</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {rx.daysSaved != null && rx.daysSaved > 0
                    ? <><b style={{ color: "#C0FF00" }}>{rx.daysSaved} giorni</b> tolti al traguardo · {rx.system.name} {rx.nowPct}→{rx.in8w}</>
                    : <>+{rx.vdotGain.toFixed(2)} VDOT in due mesi · {rx.system.name} {rx.nowPct}→{rx.in8w}</>}
                </div>
              </Tile>
            )}
          </div>

          {/* I due riquadri possono indicare sistemi diversi senza contraddirsi:
              uno guarda il tetto, l'altro le prossime settimane. Detto, smette
              di sembrare un errore e diventa l'informazione più utile della
              pagina. */}
          {lim && rx && lim.def.id !== rx.system.id && (
            <p className="mt-3 text-[11.5px] text-gray-500 leading-relaxed max-w-3xl">
              Sul lungo periodo il tetto è <b style={{ color: lim.def.color }}>{lim.def.name.toLowerCase()}</b> —
              si costruisce in mesi e va tenuto d'occhio tutto l'anno. Nelle prossime settimane però rende
              di più <b style={{ color: rx.system.color }}>{rx.system.name.toLowerCase()}</b>, che risponde in fretta:
              per questo il consiglio parte da lì.
            </p>
          )}
        </div>
      </div>

      {/* i cinque sistemi, in una striscia sola */}
      <div className="border-t border-white/8 px-5 md:px-6 py-4">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-[9px] font-black tracking-[0.22em] uppercase text-gray-500">I tuoi sistemi</span>
          <span className="text-[10px] text-gray-600">
            0-100 · quanto è pieno ciascun serbatoio, e dove va nei prossimi 28 giorni
          </span>
        </div>
        <div className="grid gap-x-5 gap-y-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {p.systems.map((s) => <SystemBar key={s.def.id} s={s} />)}
        </div>
        {p.heatCreditCool >= 0.2 && (
          <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-400">
            <Flame className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#FB923C]" />
            <span>
              Il lavoro fatto sotto il sole vale <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>+{p.heatCreditCool.toFixed(1)}</b> punti
              di VDOT quando rinfresca — circa {Math.round(predictSec(5000, p.vdot) - predictSec(5000, p.vdot + p.heatCreditCool))} secondi sui 5K. Si scarica in tre settimane di clima mite.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// ── i traguardi, in ordine di data ────────────────────────────────────────────
function GoalRow({ g }: { g: GoalEta }) {
  const col = g.done ? "#22C55E" : g.iso ? "#C0FF00" : "#64748B";
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
      <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: col }} />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-white/90 truncate">{g.label}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 truncate">
          {g.done
            ? "il motore c'è già: manca solo la gara"
            : g.iso
              ? <>{fmtDate(g.iso)} · circa {g.etaTempC}° in quel periodo</>
              : g.blocker}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] font-black tabular-nums" style={{ fontFamily: MONO, color: col }}>
          {g.done ? "fatto" : g.days != null ? humanDays(g.days).replace(/^fra /, "") : "—"}
        </div>
        <div className="text-[9px] text-gray-600" style={{ fontFamily: MONO }}>{fmtClock(g.targetSec)}</div>
      </div>
    </div>
  );
}

export function GoalTimeline({ p, limit = 8 }: { p: PhysioState; limit?: number }) {
  if (!p.ok || !p.goals.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
        <CalendarClock className="w-4 h-4 self-center text-white/70" />
        <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">Quando ci arrivi</h3>
        <span className="ml-auto text-[10px] text-gray-500 truncate">clima del mese incluso nel calcolo</span>
      </div>
      <div>{p.goals.slice(0, limit).map((g) => <GoalRow key={g.id} g={g} />)}</div>
    </section>
  );
}

// ── il peso di ogni corsa ─────────────────────────────────────────────────────
/**
 * La prova che nessuna corsa è arredamento.
 *
 * Ogni riga è una seduta letta chilometro per chilometro: i minuti finiti in
 * ciascuna zona sono quelli veri, non quelli dedotti dal passo medio, e la
 * temperatura di quel giorno è già dentro il conto. Chi guarda vede subito la
 * differenza fra un lungo che ha costruito tenuta e una seduta corta che ha
 * tenuto solo l'abitudine.
 */
export function SessionImpactList({ p, limit = 12 }: { p: PhysioState; limit?: number }) {
  if (!p.ok || !p.impacts.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
        <Activity className="w-4 h-4 self-center text-white/70" />
        <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">Cosa ha costruito ogni corsa</h3>
        <span className="ml-auto text-[10px] text-gray-500 truncate">letta split per split, temperatura inclusa</span>
      </div>
      <div className="divide-y divide-white/5 max-h-[460px] overflow-y-auto">
        {p.impacts.slice(0, limit).map((i) => {
          const quality = Math.round(i.zm.threshold + i.zm.vo2);
          const aerobic = Math.round(i.zm.easy + i.zm.medium + i.zm.recovery);
          return (
            <div key={i.id} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-1 w-1.5 h-10 rounded-full shrink-0"
                style={{ background: i.mainSystem?.color ?? "#475569" }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-white/90 truncate">{i.name}</span>
                  {i.tempC != null && i.tempC >= 24 && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: "#FB923C1f", color: "#FB923C" }}>{Math.round(i.tempC)}°</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5" style={{ fontFamily: MONO }}>
                  {i.date} · {i.km} km · {aerobic}′ aerobici{quality > 0 && ` · ${quality}′ di qualità`}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 leading-snug">{i.what}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-black tabular-nums"
                  style={{ fontFamily: MONO, color: i.mainSystem?.color ?? "#94A3B8" }}>
                  +{i.vdotGain.toFixed(3)}
                </div>
                <div className="text-[9px] text-gray-600">VDOT</div>
                <div className="text-[9px] text-gray-600 max-w-[86px] truncate">{i.mainSystem?.name ?? "—"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── le ricette ────────────────────────────────────────────────────────────────
export function PrescriptionList({ p }: { p: PhysioState }) {
  if (!p.ok || !p.prescriptions.length) return null;
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
        <Target className="w-4 h-4 self-center text-white/70" />
        <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/90">Cosa aggiungere</h3>
        <span className="ml-auto text-[10px] text-gray-500 truncate">ordinato per giorni tolti al traguardo</span>
      </div>
      <div className="divide-y divide-white/5">
        {p.prescriptions.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-1 w-1.5 h-10 rounded-full shrink-0" style={{ background: r.system.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-white/90">{r.title}</div>
              <div className="text-[10.5px] text-gray-500 mt-0.5 leading-relaxed">{r.detail}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 max-w-[140px] rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.in8w}%`, background: r.system.color }} />
                </div>
                <span className="text-[9.5px] text-gray-500" style={{ fontFamily: MONO }}>
                  {r.system.name} {r.nowPct}→{r.in8w}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              {r.daysSaved != null && r.daysSaved > 0 ? (
                <>
                  <div className="text-[15px] font-black tabular-nums" style={{ fontFamily: MONO, color: "#C0FF00" }}>
                    −{r.daysSaved}
                  </div>
                  <div className="text-[9px] text-gray-600">giorni</div>
                </>
              ) : (
                <>
                  <div className="text-[15px] font-black tabular-nums" style={{ fontFamily: MONO, color: r.system.color }}>
                    +{r.vdotGain.toFixed(2)}
                  </div>
                  <div className="text-[9px] text-gray-600">VDOT / 2 mesi</div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
