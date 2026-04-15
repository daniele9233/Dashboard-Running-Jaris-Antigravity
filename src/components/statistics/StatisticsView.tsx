import React, { useState, useRef } from 'react';
import { StatsDrift } from './StatsDrift';
import { BadgesGrid } from '../BadgesGrid';
import { MainChart } from '../MainChart';
import { AnaerobicThreshold } from '../AnaerobicThreshold';
import { VO2MaxChart } from '../VO2MaxChart';
import { FitnessFreshness } from '../FitnessFreshness';
import { AnalyticsV2 } from './AnalyticsV2';
import { useApi } from '../../hooks/useApi';
import { getAnalytics, getVdotPaces, getRuns, getGctAnalysis, getDashboard, type GctAnalysisResponse } from '../../api';
import type { AnalyticsResponse, VdotPacesResponse, RunsResponse, DashboardResponse } from '../../types/api';
import {
  Activity,
  Zap,
  TrendingUp,
  Heart,
  Clock,
  BarChart3,
  Flame,
  Dna,
  FlaskConical,
  Timer,
  Target,
  LayoutGrid,
  LineChart as LineChartIcon,
  Star,
  Briefcase,
  Info,
  TrendingDown,
  Trophy,
  Radar
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  Cell,
  ReferenceLine,
  Label,
  Legend
} from 'recharts';

// ─────────────────────────────────────────────────────────────
// INFO TOOLTIP
// ─────────────────────────────────────────────────────────────
function InfoTooltip({ title, lines }: { title: string; lines: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative inline-flex ml-auto shrink-0" ref={ref}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-[#444] hover:text-[#888] transition-colors focus:outline-none"
      >
        <Info size={14} />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-2 w-72 bg-[#0D0D0D] border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-none">
          <div className="text-[#C0FF00] text-[10px] font-black tracking-widest mb-2">{title}</div>
          <ul className="space-y-1.5">
            {lines.map((l, i) => (
              <li key={i} className="text-[#888] text-[10px] leading-relaxed flex gap-1.5">
                <span className="text-[#444] shrink-0">·</span>{l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────
const volumeData = [
  { week: 'W1', distance: 42, duration: 4.1 },
  { week: 'W2', distance: 48, duration: 4.8 },
  { week: 'W3', distance: 55, duration: 5.5 },
  { week: 'W4', distance: 35, duration: 3.2 },
  { week: 'W5', distance: 60, duration: 6.1 },
  { week: 'W6', distance: 65, duration: 6.5 },
  { week: 'W7', distance: 70, duration: 7.2 },
  { week: 'W8', distance: 40, duration: 4.0 },
];

const zoneData = [
  { name: 'Z1 (Recovery)', time: 120, fill: '#64748B' },
  { name: 'Z2 (Aerobic)', time: 450, fill: '#3B82F6' },
  { name: 'Z3 (Tempo)', time: 180, fill: '#10B981' },
  { name: 'Z4 (Threshold)', time: 90, fill: '#EAB308' },
  { name: 'Z5 (Anaerobic)', time: 30, fill: '#F43F5E' },
];

const pacesTrendData = [
  { date: '17/11', easy: 5.40, tempo: 4.50, fast: 4.10 },
  { date: '26/01', easy: 5.50, tempo: 5.00, fast: 4.30 },
  { date: '09/02', easy: 5.30, tempo: 4.45, fast: 4.15 },
  { date: '02/03', easy: 5.20, tempo: 4.35, fast: 4.05 },
  { date: '16/03', easy: 5.15, tempo: 4.30, fast: 4.00 },
];

const cadenceMonthlyData = [
  { month: '04/25', value: 165 },
  { month: '06/25', value: 170 },
  { month: '08/25', value: 174 },
  { month: '10/25', value: 176 },
  { month: '01/26', value: 174 },
  { month: '03/26', value: 173 },
];

const futureTrendData = [
  { date: '25/3', condizione: 40, affaticamento: 60, forma: -20 },
  { date: '29/3', condizione: 42, affaticamento: 75, forma: -33 },
  { date: '1/4', condizione: 45, affaticamento: 40, forma: 5 },
  { date: '4/4', condizione: 44, affaticamento: 30, forma: 14 },
  { date: '7/4', condizione: 42, affaticamento: 25, forma: 17 },
  { date: '9/4', condizione: 40, affaticamento: 20, forma: 20 },
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function vdotLevel(v: number): { label: string; color: string } {
  if (v >= 52) return { label: 'Elite', color: '#C0FF00' };
  if (v >= 47) return { label: 'Avanzato', color: '#10B981' };
  if (v >= 40) return { label: 'Buono', color: '#3B82F6' };
  if (v >= 32) return { label: 'Intermedio', color: '#EAB308' };
  return { label: 'Principiante', color: '#F43F5E' };
}

// ─────────────────────────────────────────────────────────────
// CARD WRAPPER
// ─────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#111111] border border-[#1E1E1E] rounded-3xl p-8 ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD HEADER
// ─────────────────────────────────────────────────────────────
function CardHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  tooltip,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  tooltip?: { title: string; lines: string[] };
}) {
  return (
    <div className="flex items-start justify-between mb-8 gap-3">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 shrink-0" style={{ color: iconColor }} />
        <div>
          <h2 className="text-base font-black tracking-widest uppercase italic leading-none">{title}</h2>
          {subtitle && (
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {tooltip && <InfoTooltip title={tooltip.title} lines={tooltip.lines} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION LABEL
// ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#333] font-black tracking-[0.3em] uppercase pt-2">{children}</div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export function StatisticsView() {
  const [activeTab, setActiveTab] = useState('analytics');
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics);
  const { data: vdotData } = useApi<VdotPacesResponse>(getVdotPaces);
  const { data: runsData } = useApi<RunsResponse>(getRuns);
  const { data: gctData } = useApi<GctAnalysisResponse>(getGctAnalysis);
  const { data: dashData } = useApi<DashboardResponse>(getDashboard);

  const runs = runsData?.runs ?? [];
  const vdot = vdotData?.vdot ?? null;
  const level = vdot ? vdotLevel(vdot) : null;
  const paces = vdotData?.paces ?? {};
  const racePredictions = vdotData?.race_predictions ?? analyticsData?.race_predictions ?? {};
  const zoneDistribution = analyticsData?.zone_distribution ?? [];
  const ffHistory = dashData?.fitness_freshness ?? [];
  const prevCtl = ffHistory.length >= 2 ? ffHistory[ffHistory.length - 2].ctl : null;

  // ── Monthly elevation from runs ───────────────────────────
  const elevationData = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const elevation = runs
        .filter((r) => {
          const rd = new Date(r.date);
          return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
        })
        .reduce((sum, r) => sum + (r.elevation_gain ?? 0), 0);
      return {
        name: d.toLocaleString('it', { month: 'short' }).toUpperCase(),
        dislivello: Math.round(elevation),
      };
    });
  }, [runs]);


  const tabs = [
    { id: 'analytics', label: 'Analytics Pro', icon: LayoutGrid },
    { id: 'analyticsv2', label: 'Analytics Pro V2', icon: Radar },
    { id: 'biology',   label: 'Biologia & Futuro', icon: FlaskConical },
    { id: 'badges',    label: 'Badge', icon: Star },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-6 lg:p-10">
      <div className="max-w-[1800px] mx-auto space-y-8">

        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Elite <span className="text-[#C0FF00]">Analytics</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Engineered for peak human performance
            </p>
          </div>

          <div className="flex items-center bg-[#0D0D0D] p-1.5 rounded-2xl border border-[#1E1E1E] shadow-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black transition-all tracking-widest ${
                  activeTab === tab.id
                    ? 'bg-[#1A1A1A] text-white shadow-lg border border-[#2A2A2A]'
                    : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 ${activeTab === tab.id ? 'text-[#C0FF00]' : ''}`}
                />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            ANALYTICS PRO TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <SectionLabel>CARICO — FITNESS · FATICA · FORMA</SectionLabel>

            {/* ── KPI Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {
                  label: 'Fitness (CTL)',
                  value: '54.2',
                  trend: '+2.1',
                  trendUp: true,
                  icon: TrendingUp,
                  color: '#3B82F6',
                  desc: 'Chronic Training Load',
                },
                {
                  label: 'Fatigue (ATL)',
                  value: '68.5',
                  trend: '+5.4',
                  trendUp: true,
                  icon: Zap,
                  color: '#F43F5E',
                  desc: 'Acute Training Load',
                },
                {
                  label: 'Form (TSB)',
                  value: '-14.3',
                  trend: '-3.3',
                  trendUp: false,
                  icon: Activity,
                  color: '#EAB308',
                  desc: 'Training Stress Balance',
                },
                {
                  label: 'Efficiency Factor',
                  value: '1.42',
                  trend: '+0.05',
                  trendUp: true,
                  icon: Flame,
                  color: '#10B981',
                  desc: 'Pace vs Heart Rate',
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className="bg-[#111111] border border-[#1E1E1E] rounded-2xl p-6 relative overflow-hidden hover:border-[#2A2A2A] transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">
                        {kpi.label}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black italic">{kpi.value}</span>
                        <span
                          className={`text-xs font-bold flex items-center ${
                            kpi.trendUp ? 'text-[#10B981]' : 'text-[#F43F5E]'
                          }`}
                        >
                          {kpi.trendUp ? '↑' : '↓'} {kpi.trend}
                        </span>
                      </div>
                    </div>
                    <div
                      className="p-3 rounded-xl bg-[#0D0D0D] border border-[#1E1E1E]"
                      style={{ color: kpi.color }}
                    >
                      <kpi.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    {kpi.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Fitness & Freshness (real data) ── */}
            <div className="relative">
              <FitnessFreshness
                fitnessFreshness={ffHistory}
                currentFf={dashData?.current_ff ?? null}
                prevCtl={prevCtl}
              />
            </div>

            {/* ── Volume + Time in Zones ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="xl:col-span-2">
                <CardHeader
                  icon={BarChart3}
                  iconColor="#3B82F6"
                  title="Volume Settimanale"
                  subtitle="Distanza (km) e durata (ore) — ultime 8 settimane"
                  tooltip={{
                    title: 'VOLUME TREND',
                    lines: [
                      'Barre: km percorsi per settimana.',
                      'Linea: ore totali di allenamento.',
                      'Oscillazioni fisiologiche o settimane di scarico = cali volontari.',
                      'Target: aumento ≤ 10% settimana/settimana.',
                    ],
                  }}
                />
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={volumeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="week"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        hide
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="distance"
                        name="Distanza (km)"
                        fill="#3B82F6"
                        opacity={0.8}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="duration"
                        name="Durata (ore)"
                        stroke="#C0FF00"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#C0FF00' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader
                  icon={Heart}
                  iconColor="#F43F5E"
                  title="Time in Zones"
                  subtitle="Distribuzione FC"
                  tooltip={{
                    title: 'ZONE FREQUENZA CARDIACA',
                    lines: [
                      'Z1 Recovery: < 68% FC max. Recupero attivo.',
                      'Z2 Aerobic: 68–83%. Base aerobica, brucia grassi.',
                      'Z3 Tempo: 84–94%. Soglia lattato.',
                      'Z4 Threshold: 94–99%. Ritmo gara 10k/HM.',
                      'Z5 Anaerobic: > 99%. Potenza massima.',
                      'Regola 80/20: 80% Z1-Z2, 20% Z3-Z5.',
                    ],
                  }}
                />
                {zoneDistribution.length > 0 ? (
                  <div className="space-y-4">
                    {zoneDistribution.map((zone, i) => {
                      const colors = ['#64748B', '#3B82F6', '#10B981', '#EAB308', '#F43F5E'];
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                            <span className="text-gray-400">
                              {zone.zone} {zone.name}
                            </span>
                            <span className="text-white">{zone.pct}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#0D0D0D] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${zone.pct}%`, backgroundColor: colors[i] }}
                            />
                          </div>
                          <div className="text-[9px] text-[#333] mt-0.5">{zone.minutes} min</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {zoneData.map((zone, i) => {
                      const total = zoneData.reduce((acc, curr) => acc + curr.time, 0);
                      const percentage = Math.round((zone.time / total) * 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
                            <span className="text-gray-400">{zone.name}</span>
                            <span className="text-white">{percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#0D0D0D] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%`, backgroundColor: zone.fill }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <SectionLabel>PERFORMANCE — VDOT · PACES · PREVISIONI</SectionLabel>

            {/* ── VDOT + Race Predictions ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* VDOT Dinamico */}
              <Card className="lg:col-span-4 flex flex-col justify-center">
                <CardHeader
                  icon={Activity}
                  iconColor="#3B82F6"
                  title="VDOT Dinamico"
                  tooltip={{
                    title: 'VDOT — JACK DANIELS',
                    lines: [
                      'VO₂max equivalente calcolato dal passo di gara.',
                      'Formula iterativa Jack Daniels (Running Formula 2014).',
                      'Solo corse ≥ 5K con HR ≥ 85% FC max incluse.',
                      'Aggiornato ad ogni sync Strava.',
                      '< 32: Principiante · 32–40: Intermedio · 40–47: Buono · 47–52: Avanzato · ≥ 52: Elite',
                    ],
                  }}
                />
                {vdot ? (
                  <>
                    <div className="flex items-center gap-8 mb-6">
                      <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke="#1A1A1A" strokeWidth="8" />
                          <circle
                            cx="50"
                            cy="50"
                            r="44"
                            fill="transparent"
                            stroke={level!.color}
                            strokeWidth="8"
                            strokeDasharray="276.46"
                            strokeDashoffset={276.46 * (1 - vdot / 60)}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-black italic text-white">{vdot}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div
                          className="text-sm font-black uppercase tracking-widest"
                          style={{ color: level!.color }}
                        >
                          {level!.label}
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          ml/kg/min
                        </div>
                        <div className="text-[10px] text-gray-600 font-medium italic">
                          Jack Daniels formula
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[9px] text-gray-600 font-bold mb-1">
                        <span>Princ.</span>
                        <span>Interm.</span>
                        <span>Buono</span>
                        <span>Avanz.</span>
                        <span>Elite</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden flex">
                        {([['#F43F5E', 20], ['#EAB308', 15], ['#3B82F6', 15], ['#10B981', 15], ['#C0FF00', 35]] as [string, number][]).map(
                          ([c, w], i) => (
                            <div key={i} className="h-full" style={{ width: `${w}%`, backgroundColor: c }} />
                          )
                        )}
                      </div>
                      <div className="mt-1 relative h-3">
                        <div
                          className="absolute top-0 w-0.5 h-3 bg-white rounded-full"
                          style={{ left: `${Math.min((vdot / 60) * 100, 98)}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-600 text-sm font-bold">—</div>
                    <div className="text-gray-500 text-xs mt-2">
                      Sincronizza corse per calcolare il VDOT
                    </div>
                  </div>
                )}
              </Card>

              {/* Race Predictions */}
              <Card className="lg:col-span-8">
                <CardHeader
                  icon={Target}
                  iconColor="#F43F5E"
                  title="Previsioni Gara"
                  subtitle={`da VDOT ${vdot ?? '—'}`}
                  tooltip={{
                    title: 'PREVISIONI GARA',
                    lines: [
                      'Tempi predetti dalla formula Jack Daniels basata sul VDOT attuale.',
                      'Presuppongono allenamento adeguato alla distanza.',
                      '5K e 10K: previsioni più accurate (distanze di riferimento VDOT).',
                      'Mezza e Maratona: aggiungere +3–5% per margine energetico.',
                    ],
                  }}
                />
                {Object.keys(racePredictions).length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                    {[
                      { key: '5K', label: '5 km', color: '#3B82F6', sub: 'Base' },
                      { key: '10K', label: '10 km', color: '#10B981', sub: 'Test' },
                      { key: 'Half Marathon', label: 'Mezza', color: '#8B5CF6', sub: '21.1 km' },
                      { key: 'Marathon', label: 'Maratona', color: '#F43F5E', sub: '42.2 km' },
                    ].map(({ key, label, color, sub }) => (
                      <div
                        key={key}
                        className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-5 text-center"
                      >
                        <div
                          className="text-[10px] font-black uppercase tracking-widest mb-1"
                          style={{ color }}
                        >
                          {label}
                        </div>
                        <div className="text-[9px] text-gray-600 font-bold mb-3">{sub}</div>
                        <div className="text-2xl font-black italic text-white">
                          {(racePredictions as Record<string, string>)[key] ?? '—'}
                        </div>
                        <div className="text-[9px] text-gray-500 font-bold mt-1">Daniels</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-600 text-sm py-8">
                    Sincronizza corse validate (≥ 5K, HR ≥ 85% FC Max) per calcolare le previsioni
                  </p>
                )}
              </Card>
            </div>

            {/* ── Daniels Training Zones ── */}
            <Card>
              <CardHeader
                icon={Zap}
                iconColor="#C0FF00"
                title="Zone di Allenamento Daniels"
                subtitle="5 zone fisiologiche da VDOT"
                tooltip={{
                  title: 'ZONE DANIELS',
                  lines: [
                    'E (Easy): 59–74% VO₂max. Recupero + volume base. Può durare ore.',
                    'M (Marathon): 75–84%. Ritmo maratona, sviluppa la resistenza specifica.',
                    'T (Threshold): 83–88%. Soglia lattato, max 20–40 min continuati.',
                    'I (Interval): 95–100%. VO₂max, ripetute 3–5 min con recupero uguale.',
                    'R (Repetition): 105–120%. Neuromuscolare, < 2 min con recupero lungo.',
                  ],
                }}
              />
              {Object.keys(paces).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[
                    { key: 'easy',       zone: 'E', name: 'Easy',       desc: 'Recupero / volume lento',       pct: '59–74%',   color: '#3B82F6' },
                    { key: 'marathon',   zone: 'M', name: 'Marathon',   desc: 'Ritmo maratona',                pct: '75–84%',   color: '#10B981' },
                    { key: 'threshold',  zone: 'T', name: 'Threshold',  desc: 'Soglia lattato (20–40 min)',    pct: '83–88%',   color: '#EAB308' },
                    { key: 'interval',   zone: 'I', name: 'Interval',   desc: 'Ripetute VO₂max (3–5 min)',    pct: '95–100%',  color: '#F59E0B' },
                    { key: 'repetition', zone: 'R', name: 'Repetition', desc: 'Velocità neuromuscolare',       pct: '105–120%', color: '#F43F5E' },
                  ].map(({ key, zone, name, desc, pct, color }) => (
                    <div
                      key={key}
                      className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl p-5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black italic" style={{ color }}>
                          {zone}
                        </span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                          {pct}
                        </span>
                      </div>
                      <div className="text-xs font-black text-white uppercase tracking-wider">
                        {name}
                      </div>
                      <div className="text-xl font-black text-white">
                        {(paces as Record<string, string | null>)[key] ?? '—'}
                        <span className="text-xs text-gray-500 font-normal ml-1">/km</span>
                      </div>
                      <div className="text-[10px] text-gray-500 italic leading-tight">{desc}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm py-4">
                  VDOT non disponibile — sincronizza corse validate per calcolare i passi
                </p>
              )}
            </Card>

            <SectionLabel>TREND — KM · VO2MAX · PACES · CADENZA</SectionLabel>

            {/* ── MainChart + VO2MaxChart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="min-h-[400px]">
                <MainChart runs={runs} />
              </div>
              <div className="min-h-[400px]">
                <VO2MaxChart runs={runs} vdot={vdot} />
              </div>
            </div>

            {/* ── Paces Trend + Cadenza ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader
                  icon={TrendingUp}
                  iconColor="#10B981"
                  title="Andamento Paces"
                  subtitle="Easy · Tempo · Rapido — trend storico"
                  tooltip={{
                    title: 'ANDAMENTO PACES',
                    lines: [
                      'Easy (giallo): passo delle corse lente. Deve scendere nel tempo.',
                      'Tempo (blu): passo soglia lattato. Indica progressi fitness.',
                      'Fast (rosso): passo delle ripetute veloci.',
                      'Scala Y invertita: valore più basso = passo più veloce.',
                    ],
                  }}
                />
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pacesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide domain={[3.5, 6]} reversed />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '10px', fontWeight: 700 }}
                        formatter={(v) =>
                          v === 'easy' ? 'Easy' : v === 'tempo' ? 'Tempo' : 'Fast'
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="easy"
                        stroke="#EAB308"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#EAB308' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="tempo"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#3B82F6' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fast"
                        stroke="#F43F5E"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#F43F5E' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader
                  icon={Timer}
                  iconColor="#3B82F6"
                  title="Cadenza Mensile"
                  subtitle="Passi/minuto — media mensile"
                  tooltip={{
                    title: 'CADENZA (SPM)',
                    lines: [
                      'Cadenza = passi al minuto (strides per minute).',
                      'Ottimale: 170–185 spm per la maggior parte dei runner.',
                      '< 160 spm: over-striding, rischio infortuni al ginocchio.',
                      '> 185 spm: molto efficiente, tipico dei runner elite.',
                      'Linea tratteggiata = 180 spm (target ideale Daniels).',
                    ],
                  }}
                />
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cadenceMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#333"
                        fontSize={10}
                        domain={[160, 185]}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                      />
                      <ReferenceLine y={180} stroke="#333" strokeDasharray="5 5" />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 5, fill: '#3B82F6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <SectionLabel>FISIOLOGIA — SOGLIA · DERIVA · GCT · DISLIVELLO</SectionLabel>

            {/* ── Anaerobic Threshold ── */}
            <div>
              <AnaerobicThreshold
                runs={runs}
                maxHr={dashData?.profile?.max_hr ?? 180}
                vdot={vdot}
              />
            </div>

            {/* ── Cardiac Drift ── */}
            <StatsDrift runs={runs} />

            {/* ── GCT Analysis ── */}
            {gctData && gctData.monthly.length > 0 && (
              <Card>
                <CardHeader
                  icon={Zap}
                  iconColor="#8B5CF6"
                  title="Tempo Contatto Suolo (GCT)"
                  subtitle={`Media mensile per fascia di pace · ${gctData.summary.total_runs} corse${gctData.summary.avg_gct ? ` · GCT medio: ${gctData.summary.avg_gct} ms` : ''}`}
                  tooltip={{
                    title: 'GROUND CONTACT TIME',
                    lines: [
                      'Tempo (ms) in cui il piede è a contatto col suolo per passo.',
                      'Elite: < 200 ms. Amatori avanzati: 220–260 ms. Principianti: > 270 ms.',
                      'GCT ridotto = corsa più elastica e reattiva.',
                      'Migliora con pliometria (box jump, pogo), forza reattiva.',
                      'Analizzato per fascia di passo: lento, medio, veloce.',
                    ],
                  }}
                />
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gctData.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="month"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => {
                          const [y, m] = v.split('-');
                          const months = [
                            'Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
                            'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic',
                          ];
                          return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
                        }}
                      />
                      <YAxis
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 10', 'dataMax + 10']}
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                        formatter={(value: any, name: string) => {
                          if (value === null || value === undefined) return ['N/D', ''];
                          const zoneLabels: Record<string, string> = {
                            pace_530: '≥ 5:30/km',
                            pace_500: '5:00-5:29/km',
                            pace_445: '< 4:45/km',
                          };
                          return [`${value} ms`, zoneLabels[name] || name];
                        }}
                        labelFormatter={(label) => {
                          const [y, m] = label.split('-');
                          const months = [
                            'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                            'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
                          ];
                          return `${months[parseInt(m) - 1]} ${y}`;
                        }}
                      />
                      <Legend
                        formatter={(value: string) => {
                          const labels: Record<string, string> = {
                            pace_530: '≥ 5:30/km',
                            pace_500: '5:00-5:29/km',
                            pace_445: '< 4:45/km',
                          };
                          return labels[value] || value;
                        }}
                        wrapperStyle={{ fontSize: '11px', fontWeight: 700 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pace_530"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#3B82F6' }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pace_500"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#10B981' }}
                        connectNulls={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="pace_445"
                        stroke="#F43F5E"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#F43F5E' }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {[
                    { key: 'pace_530', label: '≥ 5:30/km', color: '#3B82F6' },
                    { key: 'pace_500', label: '5:00–5:29/km', color: '#10B981' },
                    { key: 'pace_445', label: '< 4:45/km', color: '#F43F5E' },
                  ].map(({ key, label, color }) => {
                    const values = gctData.monthly
                      .map((m) => m[key as keyof typeof m])
                      .filter((v): v is number => v !== null);
                    const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
                    const min = values.length > 0 ? Math.min(...values) : null;
                    const max = values.length > 0 ? Math.max(...values) : null;
                    return (
                      <div
                        key={key}
                        className="bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-4 text-center"
                      >
                        <div
                          className="text-[9px] font-black uppercase tracking-widest mb-2"
                          style={{ color }}
                        >
                          {label}
                        </div>
                        {avg !== null ? (
                          <>
                            <div className="text-2xl font-black italic text-white">
                              {avg}
                              <span className="text-xs text-gray-500 font-normal ml-1">ms</span>
                            </div>
                            <div className="text-[9px] text-gray-500 mt-1">
                              min {min}ms · max {max}ms
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600 font-bold">N/D</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* ── Elevation Gain ── */}
            <Card>
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-[#F59E0B]" />
                  <div>
                    <h2 className="text-base font-black tracking-widest uppercase italic leading-none">
                      Dislivello Mensile
                    </h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                      Guadagno altimetrico (m) — ultimi 12 mesi
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xl font-black italic" style={{ color: '#F59E0B' }}>
                      {elevationData.reduce((s, d) => s + d.dislivello, 0).toLocaleString('it')} m
                    </div>
                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                      Totale anno
                    </div>
                  </div>
                  <InfoTooltip
                    title="DISLIVELLO MENSILE"
                    lines={[
                      'Guadagno altimetrico totale per mese da Strava.',
                      'Indicatore di volume di lavoro muscolare eccentrico.',
                      'Utile per pianificare il recupero dopo settimane con molto salita.',
                      'Più dislivello = maggiore stress muscolare su quadricipiti e tendini.',
                    ]}
                  />
                </div>
              </div>
              {elevationData.some((d) => d.dislivello > 0) ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={elevationData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#D97706" stopOpacity={0.5} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1A1A1A" />
                      <XAxis
                        dataKey="name"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}m`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                        formatter={(v: any) => [`${v.toLocaleString('it')} m`, 'Dislivello']}
                        labelStyle={{ color: '#F59E0B', fontWeight: 700, fontSize: 11 }}
                      />
                      <Bar
                        dataKey="dislivello"
                        fill="url(#elevGrad)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                  Nessun dato di dislivello disponibile
                </div>
              )}
            </Card>

          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ANALYTICS PRO V2 TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'analyticsv2' && (
          <AnalyticsV2
            vdot={vdot}
            zoneDistribution={zoneDistribution}
            gctData={gctData}
            runs={runs}
            ffHistory={ffHistory}
            maxHr={dashData?.profile?.max_hr}
            thresholdPace={vdotData?.paces?.threshold}
          />
        )}

        {/* ════════════════════════════════════════════════════
            BIOLOGIA & FUTURO TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'biology' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Grafico del Futuro */}
              <Card className="lg:col-span-8">
                <CardHeader
                  icon={LineChartIcon}
                  iconColor="#3B82F6"
                  title="Grafico del Futuro"
                  subtitle="Proiezione CTL · ATL · TSB nei prossimi giorni"
                  tooltip={{
                    title: 'PROIEZIONE FORMA',
                    lines: [
                      'Condizione (giallo): livello di fitness corrente (CTL).',
                      'Affaticamento (rosso): accumulo di fatica (ATL).',
                      'Forma (verde): TSB = CTL − ATL. Positivo = fresco.',
                      'Il "Golden Day" è il giorno in cui TSB raggiunge il picco.',
                      'Modello Banister-Coggan con decadimento esponenziale.',
                    ],
                  }}
                />
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={futureTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#333"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide domain={[-50, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111',
                          border: '1px solid #1E1E1E',
                          borderRadius: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="condizione"
                        stroke="#EAB308"
                        strokeWidth={2}
                        dot={false}
                        name="Condizione"
                      />
                      <Line
                        type="monotone"
                        dataKey="affaticamento"
                        stroke="#F43F5E"
                        strokeWidth={2}
                        dot={false}
                        name="Affaticamento"
                      />
                      <Line
                        type="monotone"
                        dataKey="forma"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#10B981' }}
                        name="Forma"
                      />
                      <ReferenceLine x="1/4" stroke="#EAB308" strokeDasharray="3 3">
                        <Label value="PICCO 1 Apr" position="top" fill="#EAB308" fontSize={10} fontWeight="black" />
                      </ReferenceLine>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Golden Day */}
              <Card className="lg:col-span-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-6 self-stretch">
                  <Star className="w-5 h-5 text-[#EAB308]" />
                  <span className="text-base font-black tracking-widest uppercase italic">
                    Golden Day
                  </span>
                  <InfoTooltip
                    title="GOLDEN DAY"
                    lines={[
                      'Giorno di picco di TSB (Training Stress Balance) previsto.',
                      'Con TSB > +10 il rischio infortuni è basso e la performance è massima.',
                      'Pianifica la gara principale attorno a questa data.',
                      'Il taper (riduzione volume) deve iniziare 10–14 giorni prima.',
                    ]}
                  />
                </div>
                <div className="relative w-44 h-44 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="88" cy="88" r="80" stroke="#1A1A1A" strokeWidth="4" fill="none" />
                    <circle
                      cx="88"
                      cy="88"
                      r="80"
                      stroke="#EAB308"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={502.65}
                      strokeDashoffset={502.65 * (1 - 0.7)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-black text-white italic">6</span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                      Giorni
                    </span>
                  </div>
                </div>
                <h3 className="text-sm font-black text-white uppercase italic">Il tuo Golden Day</h3>
                <div className="text-2xl font-black text-[#EAB308] italic mt-1 uppercase tracking-widest">
                  Mer 1 Apr
                </div>
              </Card>
            </div>

            {/* Portafoglio Biologico + Spiegazione */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <Card className="lg:col-span-7">
                <CardHeader
                  icon={Briefcase}
                  iconColor="#3B82F6"
                  title="Portafoglio Biologico"
                  subtitle="Adattamenti in corso per tipo di stimolo"
                  tooltip={{
                    title: 'PORTAFOGLIO BIOLOGICO',
                    lines: [
                      'Neuromuscolare: forza, reattività, potenza. Adattamento rapido (3–7 gg).',
                      'Metabolico: efficienza mitocondriale, soglia lattato (7–14 gg).',
                      'Strutturale: capillarizzazione, densità ossea, tendini (14–21 gg).',
                      'Concentra stimoli diversi nelle fasi corrette del piano.',
                    ],
                  }}
                />
                <div className="space-y-4">
                  {[
                    {
                      name: 'Neuromuscolare',
                      km: '0 km',
                      time: '3–7 giorni',
                      effect: 'Reattività e Potenza',
                      color: '#EAB308',
                      icon: Zap,
                    },
                    {
                      name: 'Metabolico',
                      km: '43.4 km',
                      time: '7–14 giorni',
                      effect: 'Efficienza e Soglia',
                      color: '#F43F5E',
                      icon: Activity,
                    },
                    {
                      name: 'Strutturale',
                      km: '0 km',
                      time: '14–21 giorni',
                      effect: 'Capillari e Mitocondri',
                      color: '#3B82F6',
                      icon: Dna,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-xl bg-[#111] border border-[#1E1E1E]">
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white uppercase">{item.name}</div>
                          <div className="text-[10px] font-bold text-gray-500">{item.km}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{ color: item.color }}
                        >
                          {item.time}
                        </div>
                        <div className="text-[10px] text-gray-600 font-bold italic">{item.effect}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="lg:col-span-5">
                <CardHeader
                  icon={FlaskConical}
                  iconColor="#10B981"
                  title="Come funziona?"
                  tooltip={{
                    title: 'SUPERCOMPENSAZIONE',
                    lines: [
                      'Allenamento = stress controllato sul corpo.',
                      'Nelle 24–72h post-sforzo il corpo si ripara e diventa più forte.',
                      'Se il prossimo allenamento avviene nel momento giusto, la performance sale.',
                      'Troppo presto: accumulo fatica. Troppo tardi: perdita adattamento.',
                    ],
                  }}
                />
                <div className="space-y-4 text-xs text-gray-500 font-medium italic leading-relaxed">
                  <p>
                    Quando ti alleni, il tuo corpo subisce uno{' '}
                    <span className="text-[#F43F5E] font-black">stress controllato</span>. Nelle ore
                    e giorni successivi, si ricostruisce{' '}
                    <span className="text-[#10B981] font-black">più forte di prima</span>.
                  </p>
                  <p>
                    Questo fenomeno si chiama{' '}
                    <span className="text-white font-black">supercompensazione</span>. I cambiamenti
                    strutturali richiedono dai{' '}
                    <span className="text-[#3B82F6] font-black">10 ai 21 giorni</span> per
                    manifestarsi come performance misurabile in gara.
                  </p>
                  <p>
                    Il <span className="text-[#EAB308] font-black">Golden Day</span> è calcolato
                    proiettando il modello Banister-Coggan in avanti, identificando il giorno in cui
                    TSB raggiunge il suo valore più alto.
                  </p>
                </div>
              </Card>
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════
            BADGES TAB
        ════════════════════════════════════════════════════ */}
        {activeTab === 'badges' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <BadgesGrid
              runs={runs}
              vdot={vdot ?? 0}
              vdotPeak={vdot ? vdot + 2 : 0}
              vdotDelta={0}
            />
          </div>
        )}

      </div>
    </div>
  );
}
