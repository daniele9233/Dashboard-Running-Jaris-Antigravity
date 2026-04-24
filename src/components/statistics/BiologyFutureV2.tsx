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
  Clock,
  Dna,
  FlaskConical,
  Gauge,
  Layers,
  Route,
  ShieldCheck,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type {
  AdaptationKey,
  SupercompensationProjectionPoint,
  SupercompensationResponse,
  SupercompensationRun,
} from '../../types/api';

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

export function BiologyFutureV2({ data }: { data: SupercompensationResponse }) {
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
    </div>
  );
}
