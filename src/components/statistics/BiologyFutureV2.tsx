import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Brain,
  Calendar,
  Clock,
  Dna,
  Flame,
  FlaskConical,
  Gauge,
  Heart,
  Layers,
  Rewind,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AdaptationKey,
  Profile,
  Run,
  SupercompensationProjectionPoint,
  SupercompensationResponse,
  SupercompensationRun,
} from '../../types/api';
import {
  buildDetrainingInputs,
  computeDetrainingCurve,
  paceLabel as paceLabelFn,
  projectRaceTime,
  type DetrainingPoint,
} from '../../utils/detrainingModel';

const ACCENT = '#C0FF00';
const PANEL = '#0E0E0E';
const PANEL_SOFT = '#111111';
const BORDER = '#242424';
const GRID = '#1F1F1F';
const TEXT_MUTED = '#7A8599';
const CYAN = '#22D3EE';
const ORANGE = '#F97316';
const PURPLE = '#A78BFA';

type AdaptationMeta = {
  key: AdaptationKey;
  label: string;
  short: string;
  color: string;
  benefit: string;
  why: string;
  window: string;
  distanceLogic: string;
  distances: Record<string, number>;
};

const ADAPTATION_META: Record<AdaptationKey, AdaptationMeta> = {
  neuromuscular: {
    key: 'neuromuscular',
    label: 'Neuromuscolare',
    short: 'Velocita e gesto',
    color: ACCENT,
    benefit: 'Aumenta reattivita, frequenza di passo, reclutamento e capacita di cambiare ritmo.',
    why: 'Stimoli brevi e intensi insegnano al sistema nervoso a usare meglio la forza gia disponibile.',
    window: '3-7 giorni',
    distanceLogic: 'Aiuta soprattutto 5K, sprint finali, salite brevi e cambi ritmo.',
    distances: { '5K': 92, '10K': 74, Mezza: 46, Maratona: 34, Ultra: 24 },
  },
  metabolic: {
    key: 'metabolic',
    label: 'Metabolico',
    short: 'Soglia e motore',
    color: ORANGE,
    benefit: 'Migliora soglia, VO2 utile, mitocondri e capacita di tenere ritmi sostenuti.',
    why: 'Quando il carico e abbastanza lungo o intenso, il corpo impara a produrre energia con meno costo.',
    window: '7-14 giorni',
    distanceLogic: 'Molto utile su 5K, 10K e mezza, dove serve sostenere un passo alto.',
    distances: { '5K': 78, '10K': 94, Mezza: 88, Maratona: 68, Ultra: 48 },
  },
  structural: {
    key: 'structural',
    label: 'Strutturale',
    short: 'Durata e tessuti',
    color: CYAN,
    benefit: 'Costruisce tendini, capillari, tolleranza muscolare e resistenza alla fatica.',
    why: 'Lunghi, colline e volume creano adattamenti lenti ma molto solidi nel tempo.',
    window: '14-21 giorni',
    distanceLogic: 'Fondamentale per mezza, maratona e ultra, ma stabilizza anche 10K e 5K.',
    distances: { '5K': 45, '10K': 64, Mezza: 86, Maratona: 95, Ultra: 90 },
  },
};

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dateLabel(date?: string | null) {
  if (!date) return 'N/D';
  const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function longDateLabel(date?: string | null) {
  if (!date) return 'N/D';
  const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatValue(value?: number | null, suffix = '') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'N/D';
  return `${round(Number(value), 1)}${suffix}`;
}

function adaptationColor(key: AdaptationKey) {
  return ADAPTATION_META[key]?.color ?? ACCENT;
}

function getRunDistanceTargets(run: SupercompensationRun) {
  const meta = ADAPTATION_META[run.adaptation_key];
  const distance = Number(run.distance_km ?? 0);
  const weights = { ...meta.distances };

  if (distance >= 18) {
    weights.Maratona += 10;
    weights.Mezza += 8;
  } else if (distance >= 10) {
    weights['10K'] += 10;
    weights.Mezza += 6;
  } else if (distance >= 5) {
    weights['5K'] += 8;
    weights['10K'] += 6;
  }

  return Object.entries(weights)
    .map(([name, score]) => ({ name, score: clamp(score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function getRunBenefit(run: SupercompensationRun) {
  const meta = ADAPTATION_META[run.adaptation_key];
  const targets = getRunDistanceTargets(run).map((d) => d.name).join(' e ');
  const ready = clamp(Number(run.benefit_progress_pct ?? 0));

  let timing = 'beneficio in maturazione';
  if (run.days_remaining <= 0 || ready >= 95) timing = 'beneficio disponibile ora';
  else if (run.days_remaining <= 3) timing = 'beneficio quasi pronto';

  return {
    title: meta.benefit,
    why: run.reason || meta.why,
    timing,
    target: targets || 'profilo generale',
  };
}

function buildDistanceImpact(runs: SupercompensationRun[]) {
  const totals: Record<string, number> = { '5K': 0, '10K': 0, Mezza: 0, Maratona: 0, Ultra: 0 };

  runs.forEach((run) => {
    const meta = ADAPTATION_META[run.adaptation_key];
    const load = Math.max(1, Number(run.load ?? 1));
    const progressBoost = 0.65 + clamp(Number(run.benefit_progress_pct ?? 0)) / 200;
    Object.entries(meta.distances).forEach(([distance, weight]) => {
      totals[distance] += load * (weight / 100) * progressBoost;
    });
  });

  const max = Math.max(...Object.values(totals), 1);
  return Object.entries(totals)
    .map(([distance, raw]) => ({
      distance,
      score: Math.round((raw / max) * 100),
      raw,
    }))
    .sort((a, b) => b.score - a.score);
}

function buildStimulusFlow(data: SupercompensationResponse) {
  const runs = data.recent_runs ?? [];
  const load = runs.reduce((sum, run) => sum + Number(run.load ?? 0), 0);
  const ready = data.golden_day_score ?? data.projection?.[0]?.readiness ?? 0;
  const missing = runs.length
    ? runs.reduce((sum, run) => sum + Number(run.missing_pct ?? 0), 0) / runs.length
    : 0;

  return [
    { label: 'Stimolo', value: round(load, 1), detail: `${runs.length} corse analizzate`, color: ORANGE },
    { label: 'Riparazione', value: Math.round(missing), detail: 'quota ancora da maturare', color: PURPLE },
    { label: 'Beneficio', value: Math.round(clamp(ready)), detail: 'readiness prevista', color: ACCENT },
  ];
}

function RingGauge({
  value,
  label,
  sublabel,
  color = ACCENT,
}: {
  value: number | null | undefined;
  label: string;
  sublabel: string;
  color?: string;
}) {
  const safeValue = clamp(Number(value ?? 0));
  const circumference = 2 * Math.PI * 70;

  return (
    <div className="relative h-48 w-48 shrink-0">
      <svg className="h-full w-full -rotate-90">
        <circle cx="96" cy="96" r="70" stroke="#1A1A1A" strokeWidth="12" fill="none" />
        <circle
          cx="96"
          cy="96"
          r="70"
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - safeValue / 100)}
          style={{ filter: `drop-shadow(0 0 12px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-5xl font-black leading-none text-white">{Math.round(safeValue)}</div>
        <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>
          {label}
        </div>
        <div className="mt-1 max-w-28 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          {sublabel}
        </div>
      </div>
    </div>
  );
}

function Panel({
  children,
  className = '',
  accent = ACCENT,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <section
      className={`rounded-[8px] border p-5 sm:p-6 ${className}`}
      style={{
        background: PANEL,
        borderColor: BORDER,
        borderTop: `2px solid ${accent}`,
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
  text,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
          <Icon className="h-4 w-4 shrink-0" />
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">{title}</h2>
      </div>
      {text && <p className="max-w-xl text-sm font-semibold leading-relaxed text-gray-500">{text}</p>}
    </div>
  );
}

function SmallStat({
  label,
  value,
  detail,
  color = ACCENT,
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
}) {
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.025] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-3 break-words text-xl font-black leading-tight text-white sm:text-2xl" style={{ color }}>
        {value}
      </div>
      <div className="mt-2 text-xs font-semibold leading-relaxed text-gray-600">{detail}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] border border-white/10 bg-[#101010] p-3 shadow-2xl">
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: ACCENT }}>
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.dataKey}`} className="flex items-center justify-between gap-5 text-xs font-bold">
            <span style={{ color: item.color }}>{item.name}</span>
            <span className="text-white">{round(Number(item.value), 1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function projectionToChart(projection: SupercompensationProjectionPoint[]) {
  return projection.map((point) => ({
    ...point,
    label: point.label || dateLabel(point.date),
    neuromuscular: round(point.neuromuscular, 1),
    metabolic: round(point.metabolic, 1),
    structural: round(point.structural, 1),
    readiness: round(point.readiness, 1),
  }));
}

export function BiologyFutureV2({
  data,
  profile,
  runs: allRuns,
  vdot,
}: {
  data: SupercompensationResponse;
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
}) {
  const projectionData = React.useMemo(() => projectionToChart(data.projection ?? []), [data.projection]);
  const runs = data.recent_runs ?? [];
  const flow = React.useMemo(() => buildStimulusFlow(data), [data]);
  const distanceImpact = React.useMemo(() => buildDistanceImpact(runs), [runs]);
  const goldenPoint = (data.projection ?? []).find((point) => point.date === data.golden_day);
  const readiness = data.golden_day_score ?? goldenPoint?.readiness ?? null;
  const totalLoad = runs.reduce((sum, run) => sum + Number(run.load ?? 0), 0);
  const mostUsefulDistance = distanceImpact[0]?.distance ?? 'N/D';
  const hasRuns = runs.length > 0;

  const adaptationCards = (Object.keys(ADAPTATION_META) as AdaptationKey[]).map((key) => {
    const meta = ADAPTATION_META[key];
    const total = data.adaptation_totals?.[key];
    return {
      ...meta,
      total,
      ready: clamp(Number(total?.ready_pct ?? 0)),
      missing: clamp(Number(total?.missing_pct ?? 0)),
      load: Number(total?.load ?? 0),
      runs: Number(total?.runs ?? 0),
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Panel accent={ACCENT} className="overflow-hidden">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C0FF00]/25 bg-[#C0FF00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
              <FlaskConical className="h-3.5 w-3.5" />
              BIOLOGIA & FUTURO V2
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[0.95] text-white sm:text-5xl">
              Ogni allenamento diventa un beneficio misurabile.
            </h1>
            <p className="mt-5 max-w-3xl text-base font-semibold leading-relaxed text-gray-500">
              Questa vista legge gli stessi dati reali della Biologia & Futuro attuale, ma mostra meglio quando
              maturano gli adattamenti, perche stanno maturando e su quale distanza possono trasformarsi in performance.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SmallStat
                label="Golden day"
                value={longDateLabel(data.golden_day)}
                detail={`${data.days_to_golden ?? 'N/D'} giorni al picco previsto`}
                color={ACCENT}
              />
              <SmallStat
                label="Carico letto"
                value={formatValue(totalLoad)}
                detail={`${runs.length} allenamenti recenti nel modello`}
                color={ORANGE}
              />
              <SmallStat
                label="Distanza favorita"
                value={mostUsefulDistance}
                detail="dove i benefici recenti pesano di piu"
                color={CYAN}
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-5 rounded-[8px] border border-white/10 bg-black/30 p-5 sm:flex-row">
            <RingGauge value={readiness} label="Readiness" sublabel="picco previsto" />
            <div className="w-full min-w-0 space-y-3">
              {flow.map((step, index) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{step.label}</span>
                      <span className="text-xl font-black leading-none" style={{ color: step.color }}>
                        {step.value}
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-semibold text-gray-600">{step.detail}</div>
                  </div>
                  {index < flow.length - 1 && <ArrowRight className="hidden h-5 w-5 shrink-0 text-gray-700 sm:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Panel accent={ACCENT} className="xl:col-span-8">
          <SectionTitle
            icon={TrendingUp}
            eyebrow="Curva futura"
            title="Quando arrivano i benefici"
            text="La linea verde e la readiness prevista. Le aree colorate mostrano quali famiglie di adattamento stanno maturando nei prossimi giorni."
          />
          {hasRuns && projectionData.length ? (
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projectionData} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="bio-v2-neuro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.36} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="bio-v2-metabolic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORANGE} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="bio-v2-structural" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYAN} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: TEXT_MUTED, fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="structural" name="Strutturale" stroke={CYAN} fill="url(#bio-v2-structural)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="metabolic" name="Metabolico" stroke={ORANGE} fill="url(#bio-v2-metabolic)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="neuromuscular" name="Neuromuscolare" stroke={ACCENT} fill="url(#bio-v2-neuro)" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="readiness" name="Readiness" stroke={ACCENT} strokeWidth={3} dot={{ r: 3, fill: ACCENT, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-center">
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-white">Dati reali insufficienti</div>
                <div className="mt-2 text-xs font-semibold text-gray-600">Servono corse Strava recenti per stimare la curva futura.</div>
              </div>
            </div>
          )}
        </Panel>

        <Panel accent={CYAN} className="xl:col-span-4">
          <SectionTitle
            icon={Target}
            eyebrow="Distanze"
            title="Dove ti aiuta"
            text="Il grafico aggrega il tipo di stimolo recente e lo pesa sulle distanze."
          />
          {hasRuns ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distanceImpact} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="distance" tick={{ fill: '#CBD5E1', fontSize: 12, fontWeight: 900 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                    {distanceImpact.map((entry, index) => (
                      <Cell key={entry.distance} fill={index === 0 ? ACCENT : index === 1 ? CYAN : '#64748B'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex min-h-[220px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-center text-xs font-bold uppercase tracking-widest text-gray-600">
              Nessun impatto calcolabile
            </div>
          )}
          <div className="mt-4 rounded-[8px] border border-[#C0FF00]/20 bg-[#C0FF00]/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: ACCENT }}>Lettura coach</div>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-300">
              I benefici recenti sembrano piu spendibili su <span className="font-black text-white">{mostUsefulDistance}</span>.
              Non significa che le altre distanze non migliorino: indica dove il carico recente ha il trasferimento piu diretto.
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {adaptationCards.map((card) => (
          <Panel key={card.key} accent={card.color}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: card.color }}>{card.label}</div>
                <h3 className="mt-2 text-xl font-black leading-tight text-white">{card.short}</h3>
              </div>
              <div className="rounded-[8px] border border-white/10 bg-white/[0.025] px-3 py-2 text-right">
                <div className="text-lg font-black leading-none" style={{ color: card.color }}>{Math.round(card.ready)}%</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">pronto</div>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#1A1A1A]">
              <div className="h-full rounded-full" style={{ width: `${card.ready}%`, backgroundColor: card.color }} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <SmallStat label="corse" value={String(card.runs)} detail="campioni" color={card.color} />
              <SmallStat label="carico" value={formatValue(card.load)} detail="stimolo" color={card.color} />
              <SmallStat label="finestra" value={card.window} detail="maturazione" color={card.color} />
            </div>
            <div className="mt-5 space-y-3 text-sm font-semibold leading-relaxed text-gray-500">
              <p><span className="font-black text-white">Beneficio:</span> {card.benefit}</p>
              <p><span className="font-black text-white">Perche:</span> {card.why}</p>
              <p><span className="font-black text-white">Distanze:</span> {card.distanceLogic}</p>
            </div>
          </Panel>
        ))}
      </div>

      <Panel accent={PURPLE}>
        <SectionTitle
          icon={Layers}
          eyebrow="Allenamento per allenamento"
          title="Cosa produce ogni corsa"
          text="Qui ogni sessione diventa una piccola scheda biologica: beneficio atteso, perche accade, quando lo sentirai e quale distanza migliora."
        />

        {hasRuns ? (
          <div className="space-y-4">
            {runs.slice(0, 12).map((run) => {
              const meta = ADAPTATION_META[run.adaptation_key];
              const benefit = getRunBenefit(run);
              const progress = clamp(Number(run.benefit_progress_pct ?? 0));
              const targets = getRunDistanceTargets(run);

              return (
                <article key={`${run.id}-${run.date}`} className="grid grid-cols-1 gap-4 rounded-[8px] border border-white/10 bg-white/[0.025] p-4 xl:grid-cols-12">
                  <div className="xl:col-span-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ color: meta.color, backgroundColor: meta.color }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: meta.color }}>{meta.label}</span>
                    </div>
                    <h3 className="mt-2 truncate text-lg font-black text-white">{run.name || 'Corsa'}</h3>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-gray-500">
                      <span>{dateLabel(run.date)}</span>
                      <span>{round(run.distance_km, 2)} km</span>
                      <span>{run.avg_pace ?? 'N/D'}/km</span>
                      <span>{run.avg_hr ? `${run.avg_hr} bpm` : 'FC N/D'}</span>
                    </div>
                  </div>

                  <div className="xl:col-span-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Beneficio atteso
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-300">{benefit.title}</p>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-600">
                      <span className="font-black text-gray-400">Perche:</span> {benefit.why}
                    </p>
                  </div>

                  <div className="xl:col-span-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                      <Route className="h-3.5 w-3.5" />
                      Distanza
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {targets.map((target) => (
                        <span
                          key={target.name}
                          className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                          style={{ color: meta.color, borderColor: `${meta.color}44`, backgroundColor: `${meta.color}12` }}
                        >
                          {target.name} {target.score}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-600">{benefit.target}</p>
                  </div>

                  <div className="xl:col-span-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                        <Timer className="h-3.5 w-3.5" />
                        Quando
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: meta.color }}>{benefit.timing}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#1A1A1A]">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: meta.color }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <SmallStat label="maturato" value={`${Math.round(progress)}%`} detail="oggi" color={meta.color} />
                      <SmallStat label="manca" value={`${run.missing_pct}%`} detail="residuo" color={meta.color} />
                      <SmallStat label="data" value={dateLabel(run.benefit_date)} detail={`${run.days_remaining} gg`} color={meta.color} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-[8px] border border-dashed border-white/10 text-center">
            <div>
              <Clock className="mx-auto h-8 w-8 text-gray-700" />
              <div className="mt-4 text-sm font-black uppercase tracking-widest text-white">Nessun allenamento analizzabile</div>
              <p className="mt-2 max-w-md text-xs font-semibold leading-relaxed text-gray-600">
                Quando arrivano corse Strava valide, questa tabella spiega cosa produce ogni allenamento.
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel accent={ORANGE}>
        <SectionTitle
          icon={Gauge}
          eyebrow="Metodo"
          title="Come leggere questa schermata"
          text="Il modello non dice solo che un allenamento e stato fatto. Lo trasforma in carico biologico, tempo di maturazione e trasferimento sulla distanza."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-[8px] border border-white/10 bg-white/[0.025] p-5">
            <Zap className="h-5 w-5" style={{ color: ACCENT }} />
            <h3 className="mt-4 text-lg font-black text-white">Stress controllato</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
              Distanza, durata, passo, FC e tipo corsa stimano quanto forte e stato lo stimolo.
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-white/[0.025] p-5">
            <Dna className="h-5 w-5" style={{ color: CYAN }} />
            <h3 className="mt-4 text-lg font-black text-white">Adattamento</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
              Ogni stimolo finisce in una famiglia: gesto veloce, metabolismo o struttura resistente.
            </p>
          </div>
          <div className="rounded-[8px] border border-white/10 bg-white/[0.025] p-5">
            <Activity className="h-5 w-5" style={{ color: ORANGE }} />
            <h3 className="mt-4 text-lg font-black text-white">Performance</h3>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-gray-500">
              Il beneficio viene tradotto sulle distanze piu sensibili: 5K, 10K, mezza, maratona e ultra.
            </p>
          </div>
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          PREDITTORE DETRAINING — Coyle / Mujika / Bosquet / Bruusgaard
      ═══════════════════════════════════════════════════════════════════ */}
      <DetrainingPredictor profile={profile} runs={allRuns} vdot={vdot} />
    </div>
  );
}

// ─── DETRAINING PREDICTOR ────────────────────────────────────────────────────

const PRED_RED = '#F43F5E';
const PRED_GREEN = '#22C55E';
const PRED_PINK = '#EC4899';
const PRED_BLUE = '#6366F1';

const TIMELINE_EVENTS: { day: number; title: string; body: string; color: string; icon: React.ElementType }[] = [
  { day: 1, title: '"Mi sento ancora forte"', body: 'Il glicogeno e ancora pieno. Sensazioni intatte. Plasma cala leggermente ma hematocrit compensa: nessuna perdita reale (Mujika 2010).', color: CYAN, icon: Heart },
  { day: 3, title: 'Taper attivo', body: 'PV -8%, fatica residua dissipata, glicogeno super-compensa. La performance puo essere uguale o leggermente superiore al baseline. Questo e il principio del taper pre-gara.', color: PRED_GREEN, icon: Brain },
  { day: 7, title: 'Picco taper', body: 'Bosquet 2007 (meta-analisi 27 studi): 8-14gg di taper migliorano la performance del +1.96% in media. Il sistema nervoso e riposato, soglia ancora intatta.', color: PRED_GREEN, icon: TrendingUp },
  { day: 14, title: 'Inizia il vero detraining', body: 'Coyle 1984: -2.6% VO2max gia documentato a 12 giorni di stop completo. Soglia LT inizia a calare (-3/-5%). FC riposo +3-5 bpm.', color: ORANGE, icon: TrendingDown },
  { day: 30, title: 'Identita atletica fragile', body: 'Mitocondri -25%. Capillari iniziano a regredire. Psicologicamente: irritabilita, perdita identita "runner". La memoria muscolare resta intatta nei nuclei mionucleari (Bruusgaard 2010, Murach 2020).', color: PRED_RED, icon: Flame },
  { day: 60, title: 'Ricostruzione lunga', body: 'VO2 -14/-16%, capacita ossidativa -40%. Servono 4-5 mesi di richiamo strutturato. La memoria epigenetica (Seaborne 2018) accelera il ritorno: chi ha corso anni torna piu in fretta.', color: ACCENT, icon: Sparkles },
];

function GaugeChart({
  value,
  max = 100,
  label,
  sublabel,
  color,
  size = 240,
}: {
  value: number;
  max?: number;
  label: string;
  sublabel: string;
  color: string;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(1, value / max));
  const cx = size / 2;
  const cy = size / 2 + 20;
  const radius = size * 0.38;

  const startAngle = -210;
  const endAngle = 30;
  const polar = (a: number) => {
    const r = (a * Math.PI) / 180;
    return { x: cx + radius * Math.cos(r), y: cy + radius * Math.sin(r) };
  };
  const start = polar(startAngle);
  const end = polar(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const arcPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  const activeEnd = polar(startAngle + 240 * pct);
  const activeLargeArc = 240 * pct > 180 ? 1 : 0;
  const activePath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${activeLargeArc} 1 ${activeEnd.x} ${activeEnd.y}`;

  const needleAngleDeg = startAngle + 240 * pct;
  const needleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLen = radius * 0.85;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={arcPath} stroke="#1A1A1A" strokeWidth={14} fill="none" strokeLinecap="round" />
        <motion.path
          d={activePath}
          stroke={color}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 18px ${color}88)` }}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />
        <motion.line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ x2: cx + needleLen * Math.cos((startAngle * Math.PI) / 180), y2: cy + needleLen * Math.sin((startAngle * Math.PI) / 180) }}
          animate={{ x2: nx, y2: ny }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <circle cx={cx} cy={cy} r={9} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        <text x={polar(startAngle).x - 6} y={polar(startAngle).y + 18} fill="#666" fontSize={10} fontWeight={700} textAnchor="end">AMATEUR</text>
        <text x={polar(endAngle).x + 6} y={polar(endAngle).y + 18} fill="#666" fontSize={10} fontWeight={700} textAnchor="start">ELITE</text>
      </svg>
      <div className="absolute left-0 right-0 text-center" style={{ top: cy + 24 }}>
        <div className="text-3xl font-black text-white leading-none">{Math.round(value)}<span className="text-base text-gray-500">/{max}</span></div>
        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>{label}</div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">{sublabel}</div>
      </div>
    </div>
  );
}

function TimelineEvent({
  day,
  active,
  onClick,
  color,
  label,
}: {
  day: number;
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center group" style={{ minWidth: 72 }}>
      <div
        className="w-3 h-3 rounded-full mb-2 transition-all"
        style={{
          background: active ? color : '#2A2A2A',
          boxShadow: active ? `0 0 14px ${color}` : 'none',
          transform: active ? 'scale(1.4)' : 'scale(1)',
        }}
      />
      <div className={`text-[10px] font-black tracking-widest ${active ? 'text-white' : 'text-gray-600'}`}>D{day}</div>
      <div className={`text-[9px] mt-0.5 ${active ? 'text-gray-400' : 'text-gray-700'}`}>{label}</div>
    </button>
  );
}

function SnapshotStat({ label, value, color, hint }: { label: string; value: string; color: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-black leading-none" style={{ color }}>{value}</div>
      {hint && <div className="mt-2 text-[10px] font-semibold leading-relaxed text-gray-600">{hint}</div>}
    </div>
  );
}

function predict10k(vdot: number): number {
  if (vdot >= 60) return 1958 + (60 - vdot) * 38;
  if (vdot >= 50) return 2335 + (50 - vdot) * 54;
  if (vdot >= 40) return 2873 + (40 - vdot) * 70;
  if (vdot >= 30) return 3573 + (30 - vdot) * 90;
  return 4473;
}

function estimateEasyPaceFromVdot(vdot: number): number {
  const sec = 590 - 5.7 * vdot;
  return Math.round(Math.max(180, sec));
}

function formatSec(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function DetrainingPredictor({
  profile,
  runs,
  vdot,
}: {
  profile: Profile | null | undefined;
  runs: Run[];
  vdot: number | null;
}) {
  const inputs = React.useMemo(() => buildDetrainingInputs(profile, runs, vdot), [profile, runs, vdot]);
  const summary = React.useMemo(() => computeDetrainingCurve(inputs, 90, 'taper'), [inputs]);
  const summaryFull = React.useMemo(() => computeDetrainingCurve(inputs, 90, 'fullStop'), [inputs]);
  const [day, setDay] = React.useState(14);

  const point: DetrainingPoint = summary.curve[day] ?? summary.curve[0];
  const pointFull: DetrainingPoint = summaryFull.curve[day] ?? summaryFull.curve[0];
  const vo2Loss = (1 - point.vo2Pct) * 100;
  const ltLoss = (1 - point.ltPct) * 100;
  const plasmaLoss = (1 - point.plasmaPct) * 100;
  const mitoLoss = (1 - point.mitochondriaPct) * 100;
  const perfDelta = (point.performancePct - 1) * 100; // positive in taper window

  // Atrofia gauge: 0 in taper, scales with VO2/Mito loss in detraining.
  const atrophyScore = day <= summary.taperDays
    ? 0
    : Math.max(0, Math.min(100, Math.round(vo2Loss * 4 + mitoLoss * 2)));

  const base10kSec = vdot ? Math.round(predict10k(vdot)) : 50 * 60;
  const whatIfRows = [3, 7, 14, 21, 30, 45, 60].map((d) => {
    const proj = projectRaceTime(base10kSec, summary.curve, d);
    return { day: d, label: proj.label, deltaSec: proj.deltaSec };
  });

  const userBasePaceSec = vdot ? estimateEasyPaceFromVdot(vdot) : 300;
  const userPaceRow = [3, 7, 14, 21, 30, 45, 60].map((d) => {
    const perf = summary.curve[d].performancePct;
    const sec = userBasePaceSec / perf;
    return { day: d, paceSec: sec, paceLabel: paceLabelFn(sec), deltaPct: (1 - perf) * 100 };
  });

  const ageActiveYears = inputs.yearsRunning;
  const memoryBonus = Math.round(inputs.yearsRunning * 4);
  const memoryBonusCapped = Math.min(40, memoryBonus);

  const ratio = summary.backToFit[0].ratio;
  const recoveryDays = day <= summary.taperDays
    ? Math.max(2, Math.round(day * 0.5))
    : Math.round((day - summary.taperDays) * ratio + summary.taperDays * 0.5);

  const isTaper = day <= summary.taperDays;

  return (
    <div className="space-y-6 mt-2">
      {/* Hero */}
      <Panel accent={ACCENT}>
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C0FF00]/25 bg-[#C0FF00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
              <Dna className="w-3.5 h-3.5" />
              PREDITTORE DETRAINING — Coyle / Mujika / Bosquet
            </div>
            <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-[1.0] text-white">
              Cosa accade tra <span style={{ color: isTaper ? PRED_GREEN : ACCENT }}>{day} giorni</span> di stop.
            </h2>
            <p className="mt-4 text-sm font-semibold text-gray-500 leading-relaxed max-w-2xl">
              Sposta la timeline. Personalizzato su <span className="text-white font-black">{inputs.age} anni</span>,
              {' '}<span className="text-white font-black">{inputs.weightKg} kg</span>,
              {' '}<span className="text-white font-black">{ageActiveYears.toFixed(1)} anni di corsa</span>.
            </p>
            {isTaper && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest" style={{ color: PRED_GREEN }}>
                <Sparkles className="w-3.5 h-3.5" />
                FINESTRA TAPER — performance {perfDelta >= 0 ? `+${perfDelta.toFixed(1)}` : perfDelta.toFixed(1)}%
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4">
            <GaugeChart
              value={atrophyScore}
              label={isTaper ? 'TAPER' : 'ATROFIA'}
              sublabel={`a ${day} gg di stop`}
              color={isTaper ? PRED_GREEN : atrophyScore > 60 ? PRED_RED : atrophyScore > 30 ? ORANGE : ACCENT}
              size={260}
            />
          </div>
        </div>
      </Panel>

      {/* Timeline */}
      <Panel accent={CYAN}>
        <div className="flex items-center gap-3 mb-5">
          <Calendar className="w-4 h-4" style={{ color: CYAN }} />
          <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Timeline Personale del Detraining</h2>
        </div>

        <div className="mb-6">
          <input
            type="range"
            min={0}
            max={60}
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full accent-[#C0FF00]"
          />
          <div className="flex justify-between gap-2 mt-3">
            {TIMELINE_EVENTS.map((ev) => (
              <TimelineEvent
                key={ev.day}
                day={ev.day}
                label={ev.title.length > 14 ? `${ev.title.slice(0, 12)}…` : ev.title}
                active={Math.abs(day - ev.day) <= 1}
                onClick={() => setDay(ev.day)}
                color={ev.color}
              />
            ))}
          </div>
        </div>

        {(() => {
          const ev = [...TIMELINE_EVENTS].reverse().find((e) => e.day <= day) ?? TIMELINE_EVENTS[0];
          return (
            <motion.div
              key={ev.day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-xl border p-5"
              style={{ borderColor: `${ev.color}33`, background: `${ev.color}10` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ev.icon className="w-4 h-4" style={{ color: ev.color }} />
                <div className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: ev.color }}>D{ev.day}</div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">{ev.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-400">{ev.body}</p>
            </motion.div>
          );
        })()}

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <SnapshotStat
            label="VO2max"
            value={vo2Loss < 0.05 ? '~0%' : `-${vo2Loss.toFixed(1)}%`}
            color={vo2Loss < 0.05 ? PRED_GREEN : ORANGE}
            hint={`${(point.vo2Pct * 100).toFixed(1)}% mantenuto`}
          />
          <SnapshotStat
            label="Soglia"
            value={ltLoss < 0.05 ? '~0%' : `-${ltLoss.toFixed(1)}%`}
            color={ltLoss < 0.05 ? PRED_GREEN : CYAN}
            hint="enzimi ossidativi"
          />
          <SnapshotStat label="Plasma" value={`-${plasmaLoss.toFixed(1)}%`} color={PURPLE} hint="compensato hematocrit" />
          <SnapshotStat
            label="Performance"
            value={`${perfDelta >= 0 ? '+' : ''}${perfDelta.toFixed(1)}%`}
            color={perfDelta >= 0 ? PRED_GREEN : ORANGE}
            hint="indice clinico"
          />
        </div>
      </Panel>

      {/* COMPARISON: Taper vs Fermo Totale al giorno selezionato */}
      <Panel accent={PRED_RED}>
        <div className="flex items-center gap-3 mb-5">
          <TrendingDown className="w-4 h-4" style={{ color: PRED_RED }} />
          <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Confronto Taper vs Fermo Totale — D{day}</h2>
        </div>
        <p className="text-sm font-semibold text-gray-500 mb-5 leading-relaxed max-w-3xl">
          Stesso giorno di stop, due scenari diversi. <span className="text-[#22C55E] font-black">Taper</span> = mantenere corsa lenta (50% volume).
          <span className="text-[#F43F5E] font-black"> Fermo Totale</span> = zero training, sedentario (Coyle 1984).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-5" style={{ background: '#22C55E10', borderColor: '#22C55E33' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: '#22C55E' }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: '#22C55E' }}>SCENARIO TAPER</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SnapshotStat label="VO2max" value={(1 - point.vo2Pct) * 100 < 0.05 ? '~0%' : `-${((1 - point.vo2Pct) * 100).toFixed(1)}%`} color={ORANGE} hint={`${(point.vo2Pct * 100).toFixed(1)}% mantenuto`} />
              <SnapshotStat label="Soglia" value={(1 - point.ltPct) * 100 < 0.05 ? '~0%' : `-${((1 - point.ltPct) * 100).toFixed(1)}%`} color={CYAN} />
              <SnapshotStat label="Mitocondri" value={`-${((1 - point.mitochondriaPct) * 100).toFixed(1)}%`} color={ACCENT} />
              <SnapshotStat label="Performance" value={`${(point.performancePct - 1) * 100 >= 0 ? '+' : ''}${((point.performancePct - 1) * 100).toFixed(1)}%`} color="#22C55E" />
            </div>
          </div>
          <div className="rounded-xl border p-5" style={{ background: `${PRED_RED}10`, borderColor: `${PRED_RED}33` }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4" style={{ color: PRED_RED }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: PRED_RED }}>SCENARIO FERMO TOTALE</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SnapshotStat label="VO2max" value={(1 - pointFull.vo2Pct) * 100 < 0.05 ? '~0%' : `-${((1 - pointFull.vo2Pct) * 100).toFixed(1)}%`} color={ORANGE} hint={`${(pointFull.vo2Pct * 100).toFixed(1)}% mantenuto`} />
              <SnapshotStat label="Soglia" value={(1 - pointFull.ltPct) * 100 < 0.05 ? '~0%' : `-${((1 - pointFull.ltPct) * 100).toFixed(1)}%`} color={CYAN} />
              <SnapshotStat label="Mitocondri" value={`-${((1 - pointFull.mitochondriaPct) * 100).toFixed(1)}%`} color={ACCENT} />
              <SnapshotStat label="Performance" value={`${(pointFull.performancePct - 1) * 100 >= 0 ? '+' : ''}${((pointFull.performancePct - 1) * 100).toFixed(1)}%`} color={PRED_RED} />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Differenziale (fermo − taper)</div>
          <div className="mt-2 text-sm font-semibold text-gray-300 leading-relaxed">
            VO2 <span className="font-black text-white">{((point.vo2Pct - pointFull.vo2Pct) * 100).toFixed(1)} pp</span> in piu con il fermo.
            Soglia <span className="font-black text-white">{((point.ltPct - pointFull.ltPct) * 100).toFixed(1)} pp</span>.
            Mitocondri <span className="font-black text-white">{((point.mitochondriaPct - pointFull.mitochondriaPct) * 100).toFixed(1)} pp</span>.
            Performance <span className="font-black text-white">{((point.performancePct - pointFull.performancePct) * 100).toFixed(1)} pp</span>.
          </div>
        </div>
      </Panel>

      {/* What-if 10K */}
      <Panel accent={ORANGE}>
        <div className="flex items-center gap-3 mb-5">
          <Timer className="w-4 h-4" style={{ color: ORANGE }} />
          <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Se ti fermi oggi: 10K previsti</h2>
        </div>
        <p className="text-sm font-semibold text-gray-500 mb-5 max-w-3xl leading-relaxed">
          Tempo base 10K oggi: <span className="text-white font-black">{formatSec(base10kSec)}</span>
          {vdot ? <> (da VDOT {vdot.toFixed(1)})</> : <> (stima default)</>}.
          Verde = scenario taper. Rosso tratteggiato = fermo totale.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {whatIfRows.map((r, i) => {
            const fullProj = projectRaceTime(base10kSec, summaryFull.curve, r.day);
            return (
              <div key={r.day} className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Stop {r.day} gg</div>
                <div className="mt-2 text-xl font-black text-white">{r.label}</div>
                <div
                  className="mt-0.5 text-[10px] font-bold"
                  style={{ color: r.deltaSec < -2 ? PRED_GREEN : r.deltaSec > 60 ? PRED_RED : r.deltaSec > 30 ? ORANGE : '#666' }}
                >
                  taper {r.deltaSec < -2 ? '↓' : '+'}{Math.abs(Math.round(r.deltaSec))}s
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-base font-black" style={{ color: '#FCA5A5' }}>{fullProj.label}</div>
                  <div className="text-[10px] font-bold" style={{ color: PRED_RED }}>fermo +{Math.round(fullProj.deltaSec)}s</div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Pace personale */}
      <Panel accent={ACCENT}>
        <div className="flex items-center gap-3 mb-5">
          <Activity className="w-4 h-4" style={{ color: ACCENT }} />
          <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Il tuo passo nel tempo</h2>
        </div>
        <p className="text-sm font-semibold text-gray-500 mb-5 leading-relaxed max-w-3xl">
          Pace base easy: <span className="text-white font-black">{paceLabelFn(userBasePaceSec)}</span>.
          A pari sforzo aerobico, ecco come evolve. Verde = piu veloce (effetto taper).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="text-gray-500 uppercase tracking-widest font-black text-[10px]">
                {userPaceRow.map((r) => (
                  <th key={r.day} className="py-2 px-3">D{r.day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {userPaceRow.map((r) => (
                  <td key={r.day} className="py-2 px-3">
                    <div className="text-lg font-black text-white">{r.paceLabel}</div>
                    <div
                      className="text-[10px] font-bold"
                      style={{ color: r.deltaPct < -0.05 ? PRED_GREEN : r.deltaPct > 5 ? PRED_RED : '#666' }}
                    >
                      {r.deltaPct < -0.05 ? '↓' : r.deltaPct > 0 ? '+' : ''}{Math.abs(r.deltaPct).toFixed(1)}%
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Memory cell + Ritorno al futuro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel accent={PURPLE}>
          <div className="flex items-center gap-3 mb-5">
            <Dna className="w-4 h-4" style={{ color: PURPLE }} />
            <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Memory Cell — Memoria Muscolare</h2>
          </div>
          <p className="text-sm font-semibold text-gray-400 leading-relaxed">
            I nuclei mionucleari acquisiti negli anni di allenamento <span className="text-white font-black">non muoiono</span>:
            restano dormienti nelle fibre. Quando riprendi, accelerano la sintesi proteica.
            Murach 2020 e Seaborne 2018 (memoria epigenetica) confermano: chi ha corso anni recupera in modo non-lineare e piu rapido.
          </p>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Bonus muscle memory</div>
            <div className="mt-2 text-3xl font-black" style={{ color: PURPLE }}>+{memoryBonusCapped}%</div>
            <p className="mt-1 text-[11px] font-semibold text-gray-600 leading-relaxed">
              Con <span className="text-white font-black">{ageActiveYears.toFixed(1)} anni</span> di corsa, recuperi piu in fretta rispetto a un principiante.
            </p>
          </div>
        </Panel>

        <Panel accent={ACCENT}>
          <div className="flex items-center gap-3 mb-5">
            <Rewind className="w-4 h-4" style={{ color: ACCENT }} />
            <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Ritorno al Futuro</h2>
          </div>
          <p className="text-sm font-semibold text-gray-500 leading-relaxed">
            Ti sei fermato <span className="text-white font-black">{day} giorni</span>?
            {isTaper && <span className="text-[#22C55E] font-black"> (taper window — quasi nessun debito)</span>}
          </p>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-black text-white">{recoveryDays}</span>
            <span className="text-sm font-bold text-gray-500">giorni di richiamo progressivo</span>
          </div>
          <div className="mt-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
            Ratio personale ×{ratio.toFixed(1)} {isTaper && '· taper esente'}
          </div>
          <ol className="mt-5 space-y-3 text-sm font-semibold text-gray-400">
            <li className="flex gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-0.5 shrink-0 w-12">Fase 1</span>
              <span>Corsa lenta, FC sotto 70% max. Ricarico plasmatico in 4-7 giorni.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-0.5 shrink-0 w-12">Fase 2</span>
              <span>Soglia leggera + lunghi controllati. Risveglio enzimi ossidativi.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mt-0.5 shrink-0 w-12">Fase 3</span>
              <span>Ripetute brevi sopra soglia. VO2max torna al valore pre-stop.</span>
            </li>
          </ol>
        </Panel>
      </div>

      {/* Tachimetri sistemici */}
      <Panel accent={CYAN}>
        <div className="flex items-center gap-3 mb-5">
          <Gauge className="w-4 h-4" style={{ color: CYAN }} />
          <h2 className="text-sm text-white font-black tracking-widest uppercase italic leading-none">Tachimetri Sistemici</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 place-items-center">
          <GaugeChart value={point.vo2Pct * 100} label="VO2MAX" sublabel="% mantenuta" color={ORANGE} size={200} />
          <GaugeChart value={point.ltPct * 100} label="SOGLIA" sublabel="% mantenuta" color={CYAN} size={200} />
          <GaugeChart value={point.performancePct * 100} label="PERFORMANCE" sublabel="indice clinico" color={point.performancePct >= 1 ? PRED_GREEN : ACCENT} size={200} />
        </div>
      </Panel>
    </div>
  );
}
