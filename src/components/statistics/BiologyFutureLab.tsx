import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Label,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Beaker,
  Droplet,
  FlaskConical,
  HeartPulse,
  Microscope,
  Radiation,
  Repeat,
  Skull,
  Sparkles as Sparkle,
  Wind,
} from 'lucide-react';
import type { Profile, Run } from '../../types/api';
import {
  buildDetrainingInputs,
  computeDetrainingCurve,
  paceLabel,
  type DetrainingSummary,
  type PaceProjection,
} from '../../utils/detrainingModel';

const ACCENT = '#D4FF00';
const PANEL = '#0E0E0E';
const BORDER = '#1E1E1E';
const BORDER_STRONG = '#2A2A2A';
const GRID = '#1E1E1E';
const CYAN = '#22D3EE';
const ORANGE = '#F59E0B';
const PURPLE = '#A78BFA';
const RED = '#F43F5E';
const BLUE = '#6366F1';
const TOOLTIP_STYLE = {
  backgroundColor: '#141414',
  border: `1px solid ${BORDER_STRONG}`,
  borderRadius: '12px',
  fontSize: 11,
};

interface Props {
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
}

function Card({
  children,
  className = '',
  accent = ACCENT,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-2xl p-7 shadow-2xl ${className}`}
      style={{
        background: PANEL,
        border: `1px solid ${BORDER_STRONG}`,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  subtitle,
  accent = ACCENT,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
      <div>
        <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">{title}</h2>
        {subtitle && (
          <p className="text-[10px] text-[#555] font-bold uppercase tracking-widest mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, hint, color = ACCENT }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-black leading-none" style={{ color }}>{value}</div>
      {hint && <div className="mt-2 text-[10px] font-semibold leading-relaxed text-gray-600">{hint}</div>}
    </div>
  );
}

function buildChartData(summary: DetrainingSummary) {
  return summary.curve
    .filter((p) => p.day % 1 === 0 && p.day <= 60)
    .map((p) => ({
      day: p.day,
      vo2: Number((p.vo2Pct * 100).toFixed(2)),
      lt: Number((p.ltPct * 100).toFixed(2)),
      plasma: Number((p.plasmaPct * 100).toFixed(2)),
      mito: Number((p.mitochondriaPct * 100).toFixed(2)),
      cap: Number((p.capillaryPct * 100).toFixed(2)),
      stroke: Number((p.strokeVolumePct * 100).toFixed(2)),
      hr: Number(p.restingHrDelta.toFixed(2)),
      perf: Number((p.performancePct * 100).toFixed(2)),
    }));
}

function PaceTable({ projection }: { projection: PaceProjection[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="text-gray-500 uppercase tracking-widest font-black">
            <th className="py-2 pr-3">Runner</th>
            <th className="py-2 px-3">Base</th>
            <th className="py-2 px-3">D3 <span className="text-[#22C55E]">taper</span></th>
            <th className="py-2 px-3">D7 <span className="text-[#22C55E]">taper</span></th>
            <th className="py-2 px-3">D14</th>
            <th className="py-2 px-3">D30</th>
            <th className="py-2 px-3">D60</th>
          </tr>
        </thead>
        <tbody>
          {projection.map((p) => (
            <tr key={p.basePaceLabel} className="border-t border-white/5">
              <td className="py-2 pr-3 text-white font-black uppercase tracking-widest text-[10px]">{p.level}</td>
              <td className="py-2 px-3 font-black" style={{ color: ACCENT }}>{p.basePaceLabel}</td>
              {p.rows.map((r) => {
                const isBoost = r.lossPct < -0.05;
                return (
                  <td key={r.day} className="py-2 px-3 font-bold text-gray-300">
                    {r.paceLabel}
                    <div
                      className="text-[9px] font-bold"
                      style={{ color: isBoost ? '#22C55E' : r.lossPct > 5 ? '#F43F5E' : '#666' }}
                    >
                      {isBoost ? '↓' : r.lossPct > 0 ? '+' : ''}{Math.abs(r.lossPct).toFixed(1)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowDiagram() {
  const steps = [
    { icon: Skull, label: 'STOP CORSA', color: '#22C55E', detail: 'D0-5: il corpo elimina fatica residua. PV cala ma compensato da hematocrit ↑. Glicogeno super-compensa: la performance puo salire.' },
    { icon: Droplet, label: 'STABILIZZAZIONE PV', color: BLUE, detail: 'D5-10: Plasma -8/-10%, hematocrit +2%. Stroke volume riassesta. VO2max ancora intatto (Mujika 2010).' },
    { icon: HeartPulse, label: 'PRIMI SEGNALI', color: PURPLE, detail: 'D10-14: FC riposo +3-5 bpm, soglia inizia a calare (-2/-4%). VO2max ancora <3% loss.' },
    { icon: Wind, label: 'VO2MAX ↓', color: ORANGE, detail: 'D14-21: Coyle 1984 documenta -7% a 12 giorni, -14% a 21 giorni nei highly trained.' },
    { icon: Microscope, label: 'MITOCONDRI ↓', color: ACCENT, detail: 'D21-45: citrato sintasi -25/-50%. Capacita ossidativa scende.' },
    { icon: Activity, label: 'CAPILLARI & PLATEAU', color: CYAN, detail: 'D45-90: capillary pruning -7/-25%. VO2 plateau verso -16/-22%. Memoria muscolare resta (Bruusgaard 2010).' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className="rounded-xl border border-white/10 bg-white/[0.025] p-4 relative"
          style={{ borderLeft: `3px solid ${step.color}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <step.icon className="w-4 h-4" style={{ color: step.color }} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: step.color }}>
              STEP {i + 1}
            </span>
          </div>
          <div className="text-sm font-black text-white">{step.label}</div>
          <p className="mt-2 text-[11px] font-semibold text-gray-500 leading-relaxed">{step.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function BiologyFutureLab({ profile, runs, vdot }: Props) {
  const inputs = React.useMemo(() => buildDetrainingInputs(profile, runs, vdot), [profile, runs, vdot]);
  const summary = React.useMemo(() => computeDetrainingCurve(inputs, 90, 'taper'), [inputs]);
  const summaryFull = React.useMemo(() => computeDetrainingCurve(inputs, 90, 'fullStop'), [inputs]);
  const chartData = React.useMemo(() => {
    const taper = buildChartData(summary);
    const full = buildChartData(summaryFull);
    return taper.map((p, i) => ({
      ...p,
      perfFull: full[i].perf,
      vo2Full: full[i].vo2,
      ltFull: full[i].lt,
    }));
  }, [summary, summaryFull]);

  const snap = summary.snapshots; // 3,7,14,30,60
  const trainingPct = Math.round(summary.trainingFactor * 100);

  const baselineVo2 = summary.baselineVo2 != null
    ? `${summary.baselineVo2.toFixed(1)} mL/kg/min`
    : 'VDOT non disponibile';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* HERO — PROFILO + DIAGNOSI */}
      <Card accent={ACCENT}>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4FF00]/25 bg-[#D4FF00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
              <FlaskConical className="w-3.5 h-3.5" />
              REFERTO DETRAINING
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black leading-[1.0] text-white">
              Cosa succede al tuo motore biologico se smetti di correre.
            </h1>
            <p className="mt-4 text-sm font-semibold text-gray-500 leading-relaxed max-w-2xl">
              Modello clinico basato su <span className="text-white font-black">Coyle (1984)</span> e
              {' '}<span className="text-white font-black">Mujika & Padilla (2000)</span>. Calcola il decadimento
              di VO2max, soglia anaerobica, volume plasmatico, densita mitocondriale e capillarizzazione,
              personalizzato sul tuo profilo.
            </p>
          </div>
          <div className="xl:col-span-5 grid grid-cols-2 gap-3">
            <StatChip label="Eta" value={`${inputs.age}a`} hint={`fattore eta ×${summary.ageFactor.toFixed(2)}`} color={ACCENT} />
            <StatChip label="Storico" value={`${inputs.yearsRunning.toFixed(1)}a`} hint={`protezione ${(summary.protective * 100).toFixed(0)}%`} color={CYAN} />
            <StatChip label="Volume 12s" value={`${inputs.weeklyKmAvg.toFixed(0)} km/sett`} hint="media ultime 12 settimane" color={ORANGE} />
            <StatChip label="VO2max base" value={baselineVo2} hint={`training factor ${trainingPct}%`} color={PURPLE} />
          </div>
        </div>
      </Card>

      {/* CURVA MULTI-ASSE 60 GIORNI */}
      <Card accent={ACCENT}>
        <CardHeader icon={Beaker} title="Curva Performance — Taper vs Detraining" subtitle={`Finestra taper: D0–D${summary.taperDays}. Picco performance previsto: D${summary.taperPeakDay} (+${(summary.taperPeakBoost * 100).toFixed(1)}%)`} />
        <div className="flex gap-4 mb-4 text-[10px] font-black uppercase tracking-widest">
          <span className="px-3 py-1 rounded-full" style={{ background: '#22C55E22', color: '#22C55E' }}>D0–D{summary.taperDays}: TAPER</span>
          <span className="px-3 py-1 rounded-full" style={{ background: `${ORANGE}22`, color: ORANGE }}>D{summary.taperDays}–D14: PLATEAU</span>
          <span className="px-3 py-1 rounded-full" style={{ background: `${RED}22`, color: RED }}>D14+: DETRAINING</span>
        </div>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dt-vo2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.42} />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dt-mito" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.36} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="dt-perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#444"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `D${v}`}
              />
              <YAxis
                yAxisId="left"
                stroke="#444"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[60, 105]}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#444"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, 12]}
                tickFormatter={(v) => `+${v}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={(v) => `Giorno ${v}`}
                formatter={(value: any, name: string) => {
                  if (name === 'FC riposo Δ') return [`+${Number(value).toFixed(1)} bpm`, name];
                  return [`${Number(value).toFixed(1)}%`, name];
                }}
              />
              {/* Taper background band */}
              <ReferenceLine yAxisId="left" x={summary.taperDays} stroke="#22C55E" strokeDasharray="3 3" strokeOpacity={0.6}>
                <Label value="Fine taper" position="top" fill="#22C55E" fontSize={9} />
              </ReferenceLine>
              <ReferenceLine yAxisId="left" x={14} stroke="#444" strokeDasharray="3 3">
                <Label value="Inizio detraining" position="top" fill="#666" fontSize={9} />
              </ReferenceLine>
              <ReferenceLine yAxisId="left" y={100} stroke="#22C55E" strokeDasharray="2 2" strokeOpacity={0.4} />
              <Area yAxisId="left" type="monotone" dataKey="perf" name="Performance (taper)" stroke="#22C55E" fill="url(#dt-perf)" strokeWidth={3} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="perfFull" name="Performance (fermo totale)" stroke={RED} strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
              <Area yAxisId="left" type="monotone" dataKey="mito" name="Mitocondri" stroke={ACCENT} fill="url(#dt-mito)" strokeWidth={1.5} dot={false} />
              <Area yAxisId="left" type="monotone" dataKey="vo2" name="VO2max" stroke={ORANGE} fill="url(#dt-vo2)" strokeWidth={1.5} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="lt" name="Soglia LT" stroke={CYAN} strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="plasma" name="Volume Plasmatico" stroke={BLUE} strokeWidth={2} dot={false} />
              <Line yAxisId="left" type="monotone" dataKey="cap" name="Capillari" stroke={PURPLE} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="hr" name="FC riposo Δ" stroke={RED} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 text-[11px] font-semibold text-gray-600 leading-relaxed">
          La linea verde <span className="text-[#22C55E] font-black">Performance</span> e l'indice clinico finale: combina VO2max e soglia con
          il taper-bell. Per i primi 5–10 giorni puo salire <span className="text-[#22C55E] font-black">sopra il 100%</span> (effetto pre-gara documentato da Bosquet 2007 / Mujika 2018).
          Plasma cala fisiologicamente ma compensato da hematocrit. La perdita "vera" parte tipicamente da D12-14 (Coyle 1984).
        </p>
      </Card>

      {/* TAPER SCIENCE CARD */}
      <Card accent="#22C55E">
        <CardHeader icon={Sparkle} title="Perche D0-D7 NON e Detraining" subtitle="Tapering science (Bosquet 2007 - Mujika 2018)" accent="#22C55E" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#22C55E' }}>FATICA RESIDUA ↓</div>
            <p className="mt-2 text-[12px] font-semibold text-gray-400 leading-relaxed">
              Lo stop dissipa ATL accumulato. <span className="text-white font-black">TSB sale</span>: muscoli rigenerano,
              cortisol scende, sistema nervoso recupera reattivita. Nessuna perdita strutturale.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#22C55E' }}>GLICOGENO ↑ +4%</div>
            <p className="mt-2 text-[12px] font-semibold text-gray-400 leading-relaxed">
              Senza scarico quotidiano, le riserve di glicogeno muscolare super-compensano.
              Hematocrit sale +2% bilanciando il calo plasmatico (Mujika 2010).
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#22C55E' }}>PERFORMANCE +1/+3%</div>
            <p className="mt-2 text-[12px] font-semibold text-gray-400 leading-relaxed">
              Bosquet 2007 (meta-analisi 27 studi): taper di 8-14gg con riduzione volume 41-60% migliora la performance
              di +1.96% in media. <span className="text-white font-black">Per questo si fa il tapering pre-gara</span>.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Quando inizia il vero detraining</div>
          <p className="mt-2 text-[12px] font-semibold text-gray-400 leading-relaxed">
            Coyle 1984 mostra il primo calo VO2max <span className="text-white font-black">a 12 giorni di stop completo</span> (-2.6%).
            Bosquet 2013 (meta cessation) conferma: VO2max -3.6% medio dopo 4 settimane, ma con varianza ampia in base al
            livello di partenza. Il modello qui sopra applica un <span className="text-white font-black">lag di {summary.taperDays} giorni</span> su VO2/LT
            e di 14 giorni su capillari.
          </p>
        </div>
      </Card>

      {/* TABELLA DATI 3/7/14/30/60 */}
      <Card accent={CYAN}>
        <CardHeader icon={Microscope} title="Tabella Decadimento" subtitle="Confronto Taper (corsa lenta mantenuta) vs Fermo Totale (sedentario)" accent={CYAN} />
        <div className="flex gap-3 mb-4 text-[10px] font-black uppercase tracking-widest">
          <span className="px-3 py-1 rounded-full" style={{ background: '#22C55E22', color: '#22C55E' }}>Riga T = Taper</span>
          <span className="px-3 py-1 rounded-full" style={{ background: `${RED}22`, color: RED }}>Riga F = Fermo Totale</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest font-black text-[10px]">
                <th className="py-2 pr-3">Sistema</th>
                <th className="py-2 px-3">Mode</th>
                <th className="py-2 px-3">D3</th>
                <th className="py-2 px-3">D7</th>
                <th className="py-2 px-3">D14</th>
                <th className="py-2 px-3">D30</th>
                <th className="py-2 px-3">D60</th>
                <th className="py-2 px-3">Plateau</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                { key: 'vo2Pct', label: 'VO2max', color: ORANGE, capT: summary.vo2MaxLossCap, capF: summaryFull.vo2MaxLossCap },
                { key: 'ltPct', label: 'Soglia anaerobica', color: CYAN, capT: summary.ltLossCap, capF: summaryFull.ltLossCap },
                { key: 'mitochondriaPct', label: 'Densita mitocondriale', color: ACCENT, capT: summary.mitochondriaLossCap, capF: summaryFull.mitochondriaLossCap },
                { key: 'capillaryPct', label: 'Densita capillare', color: PURPLE, capT: summary.capillaryLossCap, capF: summaryFull.capillaryLossCap },
              ].flatMap((row) => [
                <tr key={`${row.key}-taper`} className="border-t border-white/5">
                  <td className="py-2 pr-3" rowSpan={2}>
                    <span className="font-black" style={{ color: row.color }}>{row.label}</span>
                  </td>
                  <td className="py-2 px-3 text-[10px] font-black" style={{ color: '#22C55E' }}>T</td>
                  {snap.map((p) => {
                    const val = (1 - (p as any)[row.key]) * 100;
                    return (<td key={p.day} className="py-2 px-3 font-bold">-{val.toFixed(1)}%</td>);
                  })}
                  <td className="py-2 px-3 font-black" style={{ color: row.color }}>-{(row.capT * 100).toFixed(0)}%</td>
                </tr>,
                <tr key={`${row.key}-full`} className="border-t border-white/5 bg-white/[0.015]">
                  <td className="py-2 px-3 text-[10px] font-black" style={{ color: RED }}>F</td>
                  {[3, 7, 14, 30, 60].map((d) => {
                    const val = (1 - (summaryFull.curve[d] as any)[row.key]) * 100;
                    return (<td key={d} className="py-2 px-3 font-bold" style={{ color: '#FCA5A5' }}>-{val.toFixed(1)}%</td>);
                  })}
                  <td className="py-2 px-3 font-black" style={{ color: RED }}>-{(row.capF * 100).toFixed(0)}%</td>
                </tr>,
              ])}
              <tr className="border-t border-white/5">
                <td className="py-2 pr-3"><span className="font-black" style={{ color: BLUE }}>Volume plasmatico</span></td>
                <td className="py-2 px-3 text-[10px] text-gray-500 font-black">=</td>
                {snap.map((p) => (<td key={p.day} className="py-2 px-3 font-bold">-{((1 - p.plasmaPct) * 100).toFixed(1)}%</td>))}
                <td className="py-2 px-3 font-black" style={{ color: BLUE }}>-{(summary.plasmaLossCap * 100).toFixed(0)}%</td>
              </tr>
              <tr className="border-t border-white/5">
                <td className="py-2 pr-3"><span className="font-black" style={{ color: RED }}>FC riposo</span></td>
                <td className="py-2 px-3 text-[10px] font-black" style={{ color: '#22C55E' }}>T</td>
                {snap.map((p) => (<td key={p.day} className="py-2 px-3 font-bold">+{p.restingHrDelta.toFixed(1)} bpm</td>))}
                <td className="py-2 px-3 font-black" style={{ color: RED }}>+{(5 + 5 * summary.trainingFactor).toFixed(0)} bpm</td>
              </tr>
              <tr className="border-t border-white/5 bg-white/[0.015]">
                <td className="py-2 pr-3"></td>
                <td className="py-2 px-3 text-[10px] font-black" style={{ color: RED }}>F</td>
                {[3, 7, 14, 30, 60].map((d) => (<td key={d} className="py-2 px-3 font-bold" style={{ color: '#FCA5A5' }}>+{summaryFull.curve[d].restingHrDelta.toFixed(1)} bpm</td>))}
                <td className="py-2 px-3 font-black" style={{ color: RED }}>+{(5 + 5 * summaryFull.trainingFactor).toFixed(0)} bpm</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] font-semibold text-gray-600 leading-relaxed">
          <span className="text-[#22C55E] font-black">Taper</span> = volume ridotto del 50% mantenendo intensita (Bosquet 2007).
          <span className="text-[#F43F5E] font-black"> Fermo Totale</span> = zero training, sedentario (Coyle 1984).
          Stesso individuo, due scenari: il fermo accelera il decay e alza il plateau di ~18%.
        </p>
      </Card>

      {/* DIAGRAMMA DI FLUSSO */}
      <Card accent={ORANGE}>
        <CardHeader icon={Radiation} title="Reazione a Catena" subtitle="Cosa accade dentro al motore" accent={ORANGE} />
        <FlowDiagram />
      </Card>

      {/* SPIEGAZIONE BIOCHIMICA - FASI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card accent={BLUE}>
          <CardHeader icon={Droplet} title="Fase 1 — Taper + Plasmatico" subtitle="Giorni 0-7 (NON detraining)" accent={BLUE} />
          <p className="text-sm font-semibold text-gray-400 leading-relaxed">
            Il volume plasmatico cala del <span className="text-white font-black">8-10% in 2-7 giorni</span>, ma
            <span className="text-white font-black"> hematocrit aumenta +2%</span> bilanciando l'O2-carrying capacity.
            VO2max e soglia restano intatte. La performance puo addirittura salire (+1/+3%) per fatica residua dissipata.
          </p>
          <p className="mt-3 text-[11px] text-gray-600 italic">
            Bosquet 2007 — Effects of tapering on performance: meta-analysis. · Mujika 2018 — Tapering: Sciences & Practice.
          </p>
        </Card>
        <Card accent={ORANGE}>
          <CardHeader icon={Wind} title="Fase 2 — VO2max & Soglia" subtitle="Giorni 12-28 (vero detraining)" accent={ORANGE} />
          <p className="text-sm font-semibold text-gray-400 leading-relaxed">
            Da D12-14 inizia la perdita misurabile. La <span className="text-white font-black">soglia anaerobica</span>
            cala piu velocemente del VO2max perche dipende da enzimi ossidativi smontati per primi.
            Coyle: <span className="text-white font-black">-2.6% VO2 a 12 giorni, -7% a 21 giorni, -14% a 56 giorni</span>.
            La velocita allo stesso sforzo scende proporzionalmente.
          </p>
          <p className="mt-3 text-[11px] text-gray-600 italic">
            Coyle 1984 — Time course of loss of adaptations. · Bosquet 2013 — Cessation meta-analysis.
          </p>
        </Card>
        <Card accent={ACCENT}>
          <CardHeader icon={Microscope} title="Fase 3 — Mitocondri & Capillari" subtitle="Giorni 28-90" accent={ACCENT} />
          <p className="text-sm font-semibold text-gray-400 leading-relaxed">
            Il corpo e una macchina economica: se non usi i muscoli, smantella le fabbriche di energia.
            Citrato sintasi e SDH cadono del <span className="text-white font-black">25-50%</span>.
            La densita capillare resta stabile fino a 14 giorni, poi cede fino al <span className="text-white font-black">-25%</span> nel lungo termine.
            La <span className="text-white font-black">memoria muscolare</span> (myonuclei + epigenetica) accelera il ritorno.
          </p>
          <p className="mt-3 text-[11px] text-gray-600 italic">
            Henriksson & Reitman 1977 — Capillary density. · Bruusgaard 2010 — Myonuclei retained on detraining (PNAS). · Seaborne 2018 — Epigenetic muscle memory (Sci Rep). · Murach 2020 — Myonuclear accretion (eLife).
          </p>
        </Card>
      </div>

      {/* PACE PROJECTION */}
      <Card accent={PURPLE}>
        <CardHeader icon={Activity} title="Traduzione in Passo" subtitle="Pace al km dopo X giorni di stop" accent={PURPLE} />
        <PaceTable projection={summary.paceProjection} />
        <p className="mt-4 text-[11px] font-semibold text-gray-600 leading-relaxed">
          Approssimazione: pace(t) = pace(0) / (VO2(t)/VO2(0)). Vale per sforzi steady-state aerobici;
          eventi piu brevi (5K) perdono meno, ultra perdono di piu per cedimento strutturale.
        </p>
      </Card>

      {/* BACK-TO-FIT RATIO */}
      <Card accent={ACCENT}>
        <CardHeader icon={Repeat} title="Back-to-Fit Ratio" subtitle="Giorni di richiamo per recuperare" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {summary.backToFit.map((b) => (
            <div key={b.daysOff} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Stop {b.daysOff} giorni</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{b.daysToRecover}</span>
                <span className="text-xs font-bold text-gray-500">giorni di corsa</span>
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                Ratio ×{b.ratio.toFixed(1)}
              </div>
              <p className="mt-3 text-[11px] font-semibold text-gray-600 leading-relaxed">{b.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl border border-[#D4FF00]/20 bg-[#D4FF00]/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ACCENT }} />
          <p className="text-[12px] font-semibold text-gray-300 leading-relaxed">
            Il ratio aumenta con eta sopra 35a e con basso storico. Il tuo ratio personale e
            <span className="font-black text-white"> ×{summary.backToFit[0].ratio.toFixed(1)}</span>:
            ogni giorno di stop richiede mediamente {summary.backToFit[0].ratio.toFixed(1)} giorni di richiamo
            progressivo per tornare al livello pre-stop.
          </p>
        </div>
      </Card>
    </div>
  );
}
