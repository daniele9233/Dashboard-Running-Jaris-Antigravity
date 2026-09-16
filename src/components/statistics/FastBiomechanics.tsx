import React, { useState } from 'react';
import { ChevronDown, Gauge } from 'lucide-react';
import type { ProAnalyticsChart } from '../../types/api';
import { CHART_SERIES, CHART_TEXT } from './chartTheme';

/**
 * IL GESTO A RITMO GARA.
 *
 * La media di tutte le uscite descrive l'appoggio del lento, perché il lento è
 * la maggior parte dei chilometri: 265 ms di contatto e 172 passi al minuto non
 * sono un difetto, sono il passo a 6:00. Quello che decide una gara è il gesto
 * sotto i 4:45, e qui si legge solo quello — corse veloci intere, giri delle
 * ripetute con la cadenza presa dentro il giro, chilometri veloci delle corse
 * continue — messo accanto al lento, così la differenza si vede.
 */

const LIME = CHART_SERIES.primary;
const MONO = "'JetBrains Mono', monospace";

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pace = (sec: number | null) => (sec == null ? '—' : `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`);
const it = (v: number, digits = 0) => v.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const dateShort = (iso: unknown) => {
  const s = String(iso ?? '');
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};

interface MetricDef {
  label: string;
  unit: string;
  digits: number;
  fast: number | null;
  easy: number | null;
  best: number | null;
  /** true se un valore più basso è migliore (contatto, rapporto verticale). */
  lowerIsBetter: boolean;
  hint: string;
}

export function FastBiomechanics({ chart }: { chart?: ProAnalyticsChart }) {
  const [openSession, setOpenSession] = useState<number | null>(0);
  const k = chart?.kpis ?? {};
  const ok = chart?.quality?.status === 'ok';
  const sessions: Array<Record<string, any>> = chart?.summary?.sessions ?? [];
  const bestRuns: Array<Record<string, any>> = chart?.summary?.best_runs ?? [];

  const metrics: MetricDef[] = [
    { label: 'Contatto col suolo', unit: 'ms', digits: 0, fast: num(k.gct), easy: num(k.gct_easy), best: num(k.gct_best), lowerIsBetter: true, hint: 'meno tempo a terra, più spinta elastica' },
    { label: 'Cadenza', unit: 'spm', digits: 0, fast: num(k.cadence), easy: num(k.cadence_easy), best: num(k.cadence_best), lowerIsBetter: false, hint: 'passi al minuto: a ritmo 180-190' },
    { label: 'Falcata', unit: 'm', digits: 2, fast: num(k.stride), easy: num(k.stride_easy), best: num(k.stride_best), lowerIsBetter: false, hint: 'la velocità in più arriva quasi tutta da qui' },
    { label: 'Rapporto verticale', unit: '%', digits: 1, fast: num(k.vertical_ratio), easy: num(k.vertical_ratio_easy), best: num(k.vertical_ratio_best), lowerIsBetter: true, hint: 'rimbalzo per metro di avanzamento' },
  ];

  return (
    <section
      className="rounded-3xl p-6 sm:p-8 backdrop-blur-2xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50"
      style={{ borderLeft: `3px solid ${LIME}` }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Gauge className="w-5 h-5 mt-0.5 shrink-0" style={{ color: LIME }} />
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-black italic tracking-wide text-white uppercase">Il gesto a ritmo gara</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-400 max-w-2xl">
              Solo corse sotto i <b className="text-white">4:45/km</b> e giri delle ripetute, messi accanto al lento.
              {num(k.pace_fast_sec) != null && num(k.pace_easy_sec) != null && (
                <> Mediana <b className="text-white">{pace(num(k.pace_fast_sec))}/km</b> contro {pace(num(k.pace_easy_sec))} del lento.</>
              )}
            </p>
          </div>
        </div>
        {ok && (
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <Count value={num(k.fast_runs)} label="corse veloci" />
            <Count value={num(k.reps)} label="ripetute" />
            <Count value={num(k.segments) != null && num(k.reps) != null ? (num(k.segments)! - num(k.reps)!) : null} label="km veloci" />
          </div>
        )}
      </div>

      {!ok ? (
        <div className="mt-6 py-10 text-center text-[11px] font-black uppercase tracking-widest text-gray-600">
          {chart?.quality?.message ?? 'Nessuna corsa sotto i 4:45/km con telemetria'}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-x-8 gap-y-5 lg:grid-cols-2">
            {metrics.map((m) => <Dumbbell key={m.label} m={m} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-500" />al lento (oltre 5:30/km)</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: LIME }} />a ritmo (sotto 4:45/km)</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-0.5 h-3 bg-white/80" />il tuo migliore</span>
          </div>

          {sessions.length > 0 && (
            <div className="mt-8">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400 mb-3">Le ripetute, giro per giro</div>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full text-[12px]" style={{ fontFamily: MONO }}>
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                      <th className="px-4 py-2.5 font-black">Seduta</th>
                      <th className="px-3 py-2.5 font-black text-right">Lavoro</th>
                      <th className="px-3 py-2.5 font-black text-right">Passo</th>
                      <th className="px-3 py-2.5 font-black text-right">Cadenza</th>
                      <th className="px-3 py-2.5 font-black text-right">Falcata</th>
                      <th className="px-3 py-2.5 font-black text-right">FC</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => {
                      const open = openSession === i;
                      const reps: Array<Record<string, any>> = s.reps ?? [];
                      return (
                        <React.Fragment key={`${s.date}-${i}`}>
                          <tr className="border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.03]" onClick={() => setOpenSession(open ? null : i)}>
                            <td className="px-4 py-2.5 min-w-[180px]">
                              <div className="text-white font-bold truncate max-w-[260px]" style={{ fontFamily: 'inherit' }}>{String(s.name ?? 'Ripetute')}</div>
                              <div className="text-[10px] text-gray-500">{dateShort(s.date)}</div>
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{s.n_work} × {it(Number(s.avg_rep_m ?? 0))} m</td>
                            <td className="px-3 py-2.5 text-right text-white font-black whitespace-nowrap">{pace(num(s.work_pace_sec))}</td>
                            <td className="px-3 py-2.5 text-right text-white whitespace-nowrap">{num(s.cadence) ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right text-white whitespace-nowrap">{num(s.stride_m) != null ? `${it(s.stride_m, 2)} m` : '—'}</td>
                            <td className="px-3 py-2.5 text-right text-gray-300 whitespace-nowrap">{num(s.hr) ?? '—'}</td>
                            <td className="px-2 py-2.5 text-right"><ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} /></td>
                          </tr>
                          {open && (
                            <tr className="border-b border-white/[0.05]">
                              <td colSpan={7} className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                  {reps.map((r, j) => (
                                    <div key={j} className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] leading-tight">
                                      <div className="text-gray-500">#{j + 1} · {it(Number(r.distance_m ?? 0))} m</div>
                                      <div className="text-white font-black">{pace(num(r.pace_sec))}<span className="text-gray-500 font-normal">/km</span></div>
                                      <div className="text-gray-300">{num(r.cadence) ?? '—'} spm · {num(r.stride_m) != null ? `${it(r.stride_m, 2)} m` : '—'}</div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bestRuns.length > 0 && (
            <div className="mt-8">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400 mb-3">Le corse veloci con la telemetria migliore</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {bestRuns.map((r, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5" style={{ fontFamily: MONO }}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] text-gray-500">{dateShort(r.date)} · {it(Number(r.distance_km ?? 0), 1)} km</span>
                      <span className="text-[13px] font-black text-white">{pace(num(r.pace_sec))}<span className="text-[10px] text-gray-500 font-normal">/km</span></span>
                    </div>
                    <div className="mt-1 grid grid-cols-4 gap-1 text-[10px]">
                      <Mini label="GCT" value={num(r.gct) != null ? `${r.gct}` : '—'} />
                      <Mini label="SPM" value={num(r.cadence) != null ? `${r.cadence}` : '—'} />
                      <Mini label="VR%" value={num(r.vertical_ratio) != null ? it(r.vertical_ratio, 1) : '—'} />
                      <Mini label="PASSO" value={num(r.stride) != null ? it(r.stride, 2) : '—'} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Count({ value, label }: { value: number | null; label: string }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-baseline gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-gray-400">
      <b className="text-white" style={{ fontFamily: MONO }}>{value}</b>{label}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-wider text-gray-600">{label}</div>
      <div className="text-white font-black">{value}</div>
    </div>
  );
}

/**
 * Lento e ritmo sulla stessa riga: due punti su una scala, il migliore come
 * tacca. La distanza fra i due punti è la risposta alla domanda "quanto cambia
 * il mio gesto quando vado forte".
 */
function Dumbbell({ m }: { m: MetricDef }) {
  const vals = [m.fast, m.easy, m.best].filter((v): v is number => v != null);
  if (m.fast == null || vals.length === 0) {
    return (
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{m.label}</div>
        <div className="mt-2 text-[11px] text-gray-600">Dato non disponibile</div>
      </div>
    );
  }
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.18, Math.abs(hi) * 0.01, 0.01);
  // il meglio sta sempre a destra: dove conta il valore basso, l'asse si gira
  const x = (v: number) => {
    const t = ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
    return `${m.lowerIsBetter ? 100 - t : t}%`;
  };
  const delta = m.easy != null ? m.fast - m.easy : null;
  const better = delta != null && (m.lowerIsBetter ? delta < 0 : delta > 0);
  const fmt = (v: number) => it(v, m.digits);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{m.label}</span>
        <span className="text-[10px] text-gray-500 truncate">{m.hint}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2" style={{ fontFamily: MONO }}>
        <span className="text-3xl font-black text-white">{fmt(m.fast)}</span>
        <span className="text-[12px] text-gray-500">{m.unit}</span>
        {delta != null && (
          <span className="text-[12px] font-black" style={{ color: better ? LIME : CHART_TEXT.muted }}>
            {delta > 0 ? '+' : '−'}{fmt(Math.abs(delta))} {m.unit === '%' ? 'pt' : m.unit} sul lento
          </span>
        )}
      </div>
      <div className="relative mt-3 h-6" aria-hidden>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
        {m.easy != null && (
          <div className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
            style={{ left: `min(${x(m.easy)}, ${x(m.fast)})`, width: `calc(${Math.abs(parseFloat(x(m.fast)) - parseFloat(x(m.easy)))}%)`, background: `linear-gradient(90deg, ${parseFloat(x(m.easy)) < parseFloat(x(m.fast)) ? '#6B7280' : LIME}, ${parseFloat(x(m.easy)) < parseFloat(x(m.fast)) ? LIME : '#6B7280'})`, opacity: 0.7 }} />
        )}
        {m.best != null && (
          <div className="absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white/80" style={{ left: x(m.best) }} />
        )}
        {m.easy != null && (
          <div className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-500 ring-2 ring-[#0a0a0a]" style={{ left: x(m.easy) }} />
        )}
        <div className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0a0a0a]" style={{ left: x(m.fast), background: LIME, boxShadow: `0 0 12px ${LIME}88` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-500" style={{ fontFamily: MONO }}>
        <span>{m.easy != null ? `lento ${fmt(m.easy)}` : ''}</span>
        <span>{m.best != null ? `migliore ${fmt(m.best)}` : ''}</span>
      </div>
    </div>
  );
}
