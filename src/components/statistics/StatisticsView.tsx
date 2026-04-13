import React, { useState } from 'react';
import { StatsDrift } from './StatsDrift';
import { BadgesGrid } from '../BadgesGrid';
import { MainChart } from '../MainChart';
import { AnaerobicThreshold } from '../AnaerobicThreshold';
import { VO2MaxChart } from '../VO2MaxChart';
import { FitnessFreshness } from '../FitnessFreshness';
import { useApi } from '../../hooks/useApi';
import { getAnalytics, getVdotPaces, getRuns, getGctAnalysis, getDashboard, type GctAnalysisResponse } from '../../api';
import type { AnalyticsResponse, VdotPacesResponse, RunsResponse, DashboardResponse } from '../../types/api';
import { 
  Activity, 
  Zap, 
  TrendingUp, 
  Heart, 
  Calendar, 
  Clock, 
  BarChart3,
  Flame,
  ShieldAlert,
  Dna,
  FlaskConical,
  Timer,
  Target,
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Star,
  Briefcase,
  Info,
  Shield,
  ArrowDown,
  TrendingDown,
  Trophy
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

// --- MOCK DATA ---

// V2 PMC Data
const pmcData = Array.from({ length: 30 }).map((_, i) => {
  const baseFitness = 40 + (i * 0.5);
  const fatigue = baseFitness + (Math.sin(i / 3) * 15) + (Math.random() * 10);
  const form = baseFitness - fatigue;
  return {
    day: `Day ${i + 1}`,
    fitness: Math.round(baseFitness),
    fatigue: Math.round(fatigue),
    form: Math.round(form),
  };
});

// V2 Volume Data
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

// V2 Zone Data
const zoneData = [
  { name: 'Z1 (Recovery)', time: 120, fill: '#64748B' },
  { name: 'Z2 (Aerobic)', time: 450, fill: '#3B82F6' },
  { name: 'Z3 (Tempo)', time: 180, fill: '#10B981' },
  { name: 'Z4 (Threshold)', time: 90, fill: '#EAB308' },
  { name: 'Z5 (Anaerobic)', time: 30, fill: '#F43F5E' },
];

// V3 Performance Data
const thresholdProgressData = [
  { date: '01 Nov', pace: '4:43', value: 4.71, color: '#3B82F6' },
  { date: '16 Nov', pace: '4:28', value: 4.46, color: '#10B981' },
  { date: '30 Jan', pace: '5:31', value: 5.51, color: '#065F46' },
  { date: '14 Feb', pace: '5:19', value: 5.31, color: '#10B981' },
  { date: '01 Mar', pace: '5:15', value: 5.25, color: '#10B981' },
  { date: '16 Mar', pace: '6:37', value: 6.61, color: '#F59E0B' },
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

// V3 Biology Data
const futureTrendData = [
  { date: '25/3', condizione: 40, affaticamento: 60, forma: -20 },
  { date: '29/3', condizione: 42, affaticamento: 75, forma: -33 },
  { date: '1/4', condizione: 45, affaticamento: 40, forma: 5 },
  { date: '4/4', condizione: 44, affaticamento: 30, forma: 14 },
  { date: '7/4', condizione: 42, affaticamento: 25, forma: 17 },
  { date: '9/4', condizione: 40, affaticamento: 20, forma: 20 },
];

// V3 Load Data
const acwrData = [
  { date: '1 Mar', value: 0.8 },
  { date: '8 Mar', value: 1.1 },
  { date: '15 Mar', value: 1.3 },
  { date: '22 Mar', value: 1.5 },
  { date: '29 Mar', value: 1.2 },
  { date: '5 Apr', value: 1.0 },
  { date: '12 Apr', value: 0.9 },
];

// VO2 Max Data (V1)
const vo2Data = [
  { date: '30/10', value: 43.2 }, { date: '14/11', value: 44.7 }, { date: '26/11', value: 45.8 },
  { date: '12/02', value: 31.4 }, { date: '05/03', value: 40.6 }, { date: '22/03', value: 29.0 },
  { date: 'Oggi', value: 30.3 },
];

// --- COMPONENTS ---

const CircularGauge = ({ value, label, status, color, size = "small" }: any) => {
  const radius = size === "large" ? 40 : 30;
  const stroke = size === "large" ? 6 : 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="#2A2A2A"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${size === "large" ? 'text-2xl' : 'text-lg'} font-bold text-white`}>{value}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</div>
        <div className="text-xs font-bold" style={{ color }}>{status}</div>
      </div>
    </div>
  );
};

function vdotLevel(v: number): { label: string; color: string } {
  if (v >= 52) return { label: "Elite", color: "#C0FF00" };
  if (v >= 47) return { label: "Avanzato", color: "#10B981" };
  if (v >= 40) return { label: "Buono", color: "#3B82F6" };
  if (v >= 32) return { label: "Intermedio", color: "#EAB308" };
  return { label: "Principiante", color: "#F43F5E" };
}

export function StatisticsView() {
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // ── Monthly elevation gain from runs ─────────────────────────────────────
  const elevationData = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      });
      const elevation = monthRuns.reduce((sum, r) => sum + (r.elevation_gain ?? 0), 0);
      return {
        name: d.toLocaleString("it", { month: "short" }).toUpperCase(),
        dislivello: Math.round(elevation),
      };
    });
  }, [runs]);

  // ── Avg Pace stats ────────────────────────────────────────────────────────
  const { avgPaceStr, paceMonthData, pacePct, paceMin, paceMax } = React.useMemo(() => {
    const now = new Date();
    function parsePaceToSecs(pace: string): number {
      if (!pace) return 0;
      const parts = pace.split(":");
      if (parts.length !== 2) return 0;
      const m = parseInt(parts[0]);
      const s = parseInt(parts[1]);
      if (isNaN(m) || isNaN(s)) return 0;
      return m * 60 + s;
    }
    function secsToPaceStr(secs: number): string {
      if (secs <= 0) return "--";
      const m = Math.floor(secs / 60);
      const s = Math.round(secs % 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    const monthData: { name: string; value: number }[] = [];
    let currSecs = 0;
    let prevSecs = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthRuns = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth() && r.avg_pace && parsePaceToSecs(r.avg_pace) > 100;
      });
      const avgSecs = monthRuns.length > 0 ? monthRuns.reduce((sum, r) => sum + parsePaceToSecs(r.avg_pace), 0) / monthRuns.length : 0;
      const decimalMins = avgSecs > 0 ? parseFloat((avgSecs / 60).toFixed(3)) : 0;
      monthData.push({ name: d.toLocaleString("it", { month: "short" }).toUpperCase(), value: decimalMins });
      if (i === 0) currSecs = avgSecs;
      if (i === 1) prevSecs = avgSecs;
    }
    const pct = prevSecs > 0 && currSecs > 0 ? Math.round(((currSecs - prevSecs) / prevSecs) * 100) : null;
    const values = monthData.map((m) => m.value).filter((v) => v > 0);
    const minV = values.length > 0 ? Math.min(...values) - 0.3 : 4;
    const maxV = values.length > 0 ? Math.max(...values) + 0.3 : 7;
    return { avgPaceStr: secsToPaceStr(currSecs), paceMonthData: monthData, pacePct: pct, paceMin: minV, paceMax: maxV };
  }, [runs]);

  // ── Elevation gain stats ──────────────────────────────────────────────────
  const { thisYearElev, elevPct, elevMonthData, elevMax } = React.useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const monthData: { name: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(thisYear, now.getMonth() - i, 1);
      const elev = runs.filter((r) => {
        const rd = new Date(r.date);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      }).reduce((sum, r) => sum + (r.elevation_gain || 0), 0);
      monthData.push({ name: d.toLocaleString("it", { month: "short" }).toUpperCase(), value: Math.round(elev) });
    }
    const thisTotal = runs.filter((r) => new Date(r.date).getFullYear() === thisYear).reduce((sum, r) => sum + (r.elevation_gain || 0), 0);
    const lastTotal = runs.filter((r) => new Date(r.date).getFullYear() === lastYear).reduce((sum, r) => sum + (r.elevation_gain || 0), 0);
    const pct = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;
    const maxV = Math.max(...monthData.map((m) => m.value), 200);
    return { thisYearElev: Math.round(thisTotal), elevPct: pct, elevMonthData: monthData, elevMax: maxV };
  }, [runs]);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'biology', label: 'Biologia & Futuro', icon: FlaskConical },
    { id: 'load', label: 'Carico & Rischio', icon: ShieldAlert },
    { id: 'badges', label: 'Badge', icon: Star },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-6 lg:p-10">
      <div className="max-w-[1600px] mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Elite <span className="text-[#3B82F6]">Analytics</span>
            </h1>
            <p className="text-gray-500 text-sm font-medium tracking-widest uppercase mt-2">Engineered for peak human performance</p>
          </div>

          <div className="flex items-center bg-[#141414] p-1.5 rounded-2xl border border-[#2A2A2A] shadow-2xl">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black transition-all tracking-widest ${
                  activeTab === tab.id
                    ? 'bg-[#2A2A2A] text-white shadow-lg border border-[#3A3A3A]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-[#3B82F6]' : ''}`} />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Avg Pace + Elevation Gain stat cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Avg Pace */}
          <div className="bg-[#111111] border border-[#222] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xs text-gray-500 font-semibold tracking-wider mb-1 uppercase">Avg Pace</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {avgPaceStr !== "--" ? `${avgPaceStr} /km` : "--"}
                  </span>
                  {pacePct !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${pacePct <= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                      {pacePct >= 0 ? "+" : ""}{pacePct}%
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500">QUEST'ANNO</span>
            </div>
            <div className="h-20 w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={paceMonthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statsPaceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <YAxis domain={[paceMin, paceMax]} hide />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const { name, value } = payload[0].payload as { name: string; value: number };
                      if (!value) return null;
                      const secs = value * 60;
                      const m = Math.floor(secs / 60);
                      const s = Math.round(secs % 60);
                      return (
                        <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg text-xs">
                          <p className="text-gray-400 mb-1">{name}</p>
                          <p className="text-white font-bold">{m}:{s.toString().padStart(2, "0")} /km</p>
                        </div>
                      );
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#F43F5E" strokeWidth={2} fillOpacity={1} fill="url(#statsPaceGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-600">
              {paceMonthData.map((d) => <span key={d.name}>{d.name}</span>)}
            </div>
          </div>

          {/* Elevation Gain */}
          <div className="bg-[#111111] border border-[#222] rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xs text-gray-500 font-semibold tracking-wider mb-1 uppercase">Elevation Gain</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">
                    {thisYearElev > 0 ? `${thisYearElev.toLocaleString("it")} m` : "0 m"}
                  </span>
                  {elevPct !== null && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${elevPct >= 0 ? "text-[#14B8A6] bg-[#14B8A6]/10" : "text-[#F43F5E] bg-[#F43F5E]/10"}`}>
                      {elevPct >= 0 ? "+" : ""}{elevPct}%
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-500">QUEST'ANNO</span>
            </div>
            <div className="h-20 w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={elevMonthData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="statsElevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <YAxis domain={[0, elevMax + 50]} hide />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const { name, value } = payload[0].payload as { name: string; value: number };
                      return (
                        <div className="bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg text-xs">
                          <p className="text-gray-400 mb-1">{name}</p>
                          <p className="text-white font-bold">{value.toLocaleString("it")} m</p>
                        </div>
                      );
                    }}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#14B8A6" strokeWidth={2} fillOpacity={1} fill="url(#statsElevGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-600">
              {elevMonthData.map((d) => <span key={d.name}>{d.name}</span>)}
            </div>
          </div>
        </div>

        {/* DASHBOARD TAB (V2 Content) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Fitness (CTL)', value: '54.2', trend: '+2.1', trendUp: true, icon: TrendingUp, color: 'text-blue-500', desc: 'Chronic Training Load' },
                { label: 'Fatigue (ATL)', value: '68.5', trend: '+5.4', trendUp: true, icon: Zap, color: 'text-rose-500', desc: 'Acute Training Load' },
                { label: 'Form (TSB)', value: '-14.3', trend: '-3.3', trendUp: false, icon: Activity, color: 'text-yellow-500', desc: 'Training Stress Balance' },
                { label: 'Efficiency Factor', value: '1.42', trend: '+0.05', trendUp: true, icon: Flame, color: 'text-emerald-500', desc: 'Pace vs Heart Rate' },
              ].map((kpi, i) => (
                <div key={i} className="bg-[#111111] border border-[#222] rounded-2xl p-6 relative overflow-hidden group hover:border-[#333] transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black italic">{kpi.value}</span>
                        <span className={`text-xs font-bold flex items-center ${kpi.trendUp ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                          {kpi.trendUp ? '↑' : '↓'} {kpi.trend}
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl bg-[#181818] border border-[#2A2A2A] ${kpi.color}`}>
                      <kpi.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{kpi.desc}</p>
                </div>
              ))}
            </div>

            {/* PMC Chart */}
            <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Performance Management Chart</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Fitness (CTL) vs Fatigue (ATL) vs Form (TSB)</p>
                </div>
                <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Fitness</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Fatigue</span>
                  <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Form</span>
                </div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pmcData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis dataKey="day" stroke="#444" fontSize={10} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis yAxisId="left" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px' }}
                    />
                    <Bar yAxisId="right" dataKey="form" fill="#EAB308" opacity={0.2} radius={[2, 2, 0, 0]} />
                    <Area yAxisId="left" type="monotone" dataKey="fitness" stroke="#3B82F6" fill="url(#colorFitness)" strokeWidth={3} />
                    <Line yAxisId="left" type="monotone" dataKey="fatigue" stroke="#F43F5E" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    <defs>
                      <linearGradient id="colorFitness" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Volume & Zones */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-[#3B82F6]" />
                    <h2 className="text-xl font-black tracking-widest uppercase italic">Volume Trend</h2>
                  </div>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={volumeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="week" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={10} tickLine={false} axisLine={false} hide />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                      <Bar yAxisId="left" dataKey="distance" name="Distance (km)" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Line yAxisId="right" type="monotone" dataKey="duration" name="Duration (hrs)" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Heart className="w-6 h-6 text-[#F43F5E]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Time in Zones</h2>
                </div>
                {zoneDistribution.length > 0 ? (
                  <div className="space-y-5">
                    {zoneDistribution.map((zone, i) => {
                      const colors = ["#64748B","#3B82F6","#10B981","#EAB308","#F43F5E"];
                      return (
                        <div key={i} className="group">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                            <span className="text-gray-400">{zone.zone} {zone.name}</span>
                            <span className="text-white">{zone.pct}%</span>
                          </div>
                          <div className="h-2 w-full bg-[#181818] rounded-full overflow-hidden border border-[#2A2A2A]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${zone.pct}%`, backgroundColor: colors[i] }}
                            />
                          </div>
                          <div className="text-[9px] text-gray-600 mt-1">{zone.minutes} min</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {zoneData.map((zone, i) => {
                      const total = zoneData.reduce((acc, curr) => acc + curr.time, 0);
                      const percentage = Math.round((zone.time / total) * 100);
                      return (
                        <div key={i} className="group">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                            <span className="text-gray-400">{zone.name}</span>
                            <span className="text-white">{percentage}%</span>
                          </div>
                          <div className="h-2 w-full bg-[#181818] rounded-full overflow-hidden border border-[#2A2A2A]">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: zone.fill }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Elevation Gain */}
            <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-[#F59E0B]" />
                  <div>
                    <h2 className="text-xl font-black tracking-widest uppercase italic">Dislivello Mensile</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Guadagno altimetrico (m) — ultimi 12 mesi</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black italic" style={{ color: "#F59E0B" }}>
                    {elevationData.reduce((s, d) => s + d.dislivello, 0).toLocaleString("it")} m
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Totale anno</div>
                </div>
              </div>
              {elevationData.some((d) => d.dislivello > 0) ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={elevationData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#D97706" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                      <XAxis dataKey="name" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}m`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px' }}
                        formatter={(v: any) => [`${v.toLocaleString("it")} m`, "Dislivello"]}
                        labelStyle={{ color: "#F59E0B", fontWeight: 700, fontSize: 11 }}
                      />
                      <Bar dataKey="dislivello" fill="url(#elevGrad)" radius={[4, 4, 0, 0]} maxBarSize={36} name="Dislivello" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
                  Nessun dato di dislivello disponibile
                </div>
              )}
            </div>

            {/* ── Grafici spostati dalla Dashboard ── */}
            <div className="space-y-8 mt-4">
              <div className="text-[10px] text-gray-600 font-black tracking-[0.3em] uppercase mb-2">ANALISI AVANZATA</div>

              {/* Volume + VO2Max */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="min-h-[400px]">
                  <MainChart runs={runs} />
                </div>
                <div className="min-h-[400px]">
                  <VO2MaxChart runs={runs} vdot={vdot} />
                </div>
              </div>

              {/* Soglia Anaerobica */}
              <div>
                <AnaerobicThreshold
                  runs={runs}
                  maxHr={dashData?.profile?.max_hr ?? 180}
                  vdot={vdot}
                />
              </div>

              {/* Fitness & Freshness */}
              <div>
                <FitnessFreshness
                  fitnessFreshness={ffHistory}
                  currentFf={dashData?.current_ff ?? null}
                  prevCtl={prevCtl}
                />
              </div>
            </div>
          </div>
        )}

        {/* PERFORMANCE TAB (V3 Performance Engine + VO2 Max) */}
        {activeTab === 'performance' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* VO2 Max & Goal */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* VDOT Dinamico */}
              <div className="lg:col-span-4 bg-[#111111] border border-[#222] rounded-3xl p-8 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="w-6 h-6 text-[#3B82F6]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">VDOT Dinamico</h2>
                </div>
                {vdot ? (
                  <>
                    <div className="flex items-center gap-8 mb-6">
                      <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke="#1E1E1E" strokeWidth="8" />
                          <circle cx="50" cy="50" r="44" fill="transparent" stroke={level!.color} strokeWidth="8"
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
                        <div className="text-sm font-black uppercase tracking-widest" style={{ color: level!.color }}>{level!.label}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ml/kg/min</div>
                        <div className="text-[10px] text-gray-600 font-medium italic">Jack Daniels formula</div>
                      </div>
                    </div>
                    {/* VDOT scale */}
                    <div className="mt-2">
                      <div className="flex justify-between text-[9px] text-gray-600 font-bold mb-1">
                        <span>Princ.</span><span>Interm.</span><span>Buono</span><span>Avanz.</span><span>Elite</span>
                      </div>
                      <div className="h-2 w-full rounded-full overflow-hidden flex">
                        {[["#F43F5E",20],["#EAB308",15],["#3B82F6",15],["#10B981",15],["#C0FF00",35]].map(([c,w],i) => (
                          <div key={i} className="h-full" style={{ width: `${w}%`, backgroundColor: c as string }} />
                        ))}
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
                    <div className="text-gray-500 text-xs mt-2">Sincronizza corse per calcolare il VDOT</div>
                  </div>
                )}
              </div>

              {/* Soglia Anaerobica */}
              <div className="lg:col-span-8 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="w-6 h-6 text-[#10B981]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Soglia Anaerobica</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6">
                      <div className="text-[10px] font-black text-[#3B82F6] uppercase mb-4 tracking-widest">Attuale</div>
                      <div className="flex items-center gap-6">
                        <div className="text-3xl font-black italic">152 <span className="text-xs font-medium text-gray-500 uppercase">bpm</span></div>
                        <div className="text-3xl font-black italic text-[#10B981]">5:16 <span className="text-xs font-medium text-gray-500 uppercase">/km</span></div>
                      </div>
                    </div>
                    <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 opacity-60">
                      <div className="text-[10px] font-black text-[#EAB308] uppercase mb-4 tracking-widest">Pre-Infortunio</div>
                      <div className="flex items-center gap-6">
                        <div className="text-2xl font-black italic">149 <span className="text-xs font-medium text-gray-500 uppercase">bpm</span></div>
                        <div className="text-2xl font-black italic text-[#EAB308]">4:28 <span className="text-xs font-medium text-gray-500 uppercase">/km</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={thresholdProgressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis hide domain={[4, 7]} reversed />
                        <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {thresholdProgressData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Paces & Cadence */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <TrendingUp className="w-6 h-6 text-[#10B981]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Andamento Paces</h2>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pacesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis hide domain={[3.5, 6]} reversed />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                      <Line type="monotone" dataKey="easy" stroke="#EAB308" strokeWidth={3} dot={{ r: 4, fill: '#EAB308' }} />
                      <Line type="monotone" dataKey="tempo" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, fill: '#3B82F6' }} />
                      <Line type="monotone" dataKey="fast" stroke="#F43F5E" strokeWidth={3} dot={{ r: 4, fill: '#F43F5E' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Timer className="w-6 h-6 text-[#3B82F6]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Cadenza Mensile</h2>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cadenceMonthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="month" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#444" fontSize={10} domain={[160, 185]} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                      <ReferenceLine y={180} stroke="#444" strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={3} dot={{ r: 5, fill: '#3B82F6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Race Predictions from VDOT */}
            <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <Target className="w-6 h-6 text-[#F43F5E]" />
                <h2 className="text-xl font-black tracking-widest uppercase italic">Previsioni Gara</h2>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">da VDOT {vdot ?? '—'}</span>
              </div>
              {Object.keys(racePredictions).length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { key: "5K", label: "5 km", color: "#3B82F6", icon: "🏃" },
                    { key: "10K", label: "10 km", color: "#10B981", icon: "🏃" },
                    { key: "Half Marathon", label: "Mezza", color: "#8B5CF6", icon: "🏅" },
                    { key: "Marathon", label: "Maratona", color: "#F43F5E", icon: "🏆" },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-5 text-center">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color }}>{label}</div>
                      <div className="text-2xl font-black italic text-white">{racePredictions[key] ?? "—"}</div>
                      <div className="text-[10px] text-gray-500 font-bold mt-1">Daniels formula</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm py-4">Sincronizza corse validate (4–21 km, HR ≥ 85% FC Max) per calcolare le previsioni</p>
              )}
            </div>

            {/* 5 Zone Daniels — Training Paces */}
            <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-8">
                <Zap className="w-6 h-6 text-[#C0FF00]" />
                <h2 className="text-xl font-black tracking-widest uppercase italic">Zone di Allenamento Daniels</h2>
              </div>
              {Object.keys(paces).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[
                    { key: "easy",       zone: "E",  name: "Easy",       desc: "Recupero attivo / corsa lenta", pct: "59–74%", color: "#3B82F6" },
                    { key: "marathon",   zone: "M",  name: "Marathon",   desc: "Ritmo maratona", pct: "75–84%", color: "#10B981" },
                    { key: "threshold",  zone: "T",  name: "Threshold",  desc: "Soglia lattato (20–40 min)", pct: "83–88%", color: "#EAB308" },
                    { key: "interval",   zone: "I",  name: "Interval",   desc: "Intervalli VO2max (3–5 min)", pct: "95–100%", color: "#F59E0B" },
                    { key: "repetition", zone: "R",  name: "Repetition", desc: "Ripetute velocità (< 2 min)", pct: "105–120%", color: "#F43F5E" },
                  ].map(({ key, zone, name, desc, pct, color }) => (
                    <div key={key} className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black italic" style={{ color }}>{zone}</span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">{pct}</span>
                      </div>
                      <div className="text-xs font-black text-white uppercase tracking-wider">{name}</div>
                      <div className="text-xl font-black text-white">{(paces as Record<string,string|null>)[key] ?? "—"}<span className="text-xs text-gray-500 font-normal ml-1">/km</span></div>
                      <div className="text-[10px] text-gray-500 italic leading-tight">{desc}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 text-sm py-4">VDOT non disponibile — sincronizza corse validate per calcolare i passi</p>
              )}
            </div>

            {/* Deriva Cardiaca */}
            <StatsDrift runs={runs} />

            {/* Ground Contact Time Analysis */}
            {gctData && gctData.monthly.length > 0 && (
              <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Zap className="w-6 h-6 text-[#8B5CF6]" />
                  <div>
                    <h2 className="text-xl font-black tracking-widest uppercase italic">Tempo Contatto Suolo (GCT)</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                      Media mensile per fascia di pace · {gctData.summary.total_runs} corse analizzate
                      {gctData.summary.avg_gct && ` · GCT medio: ${gctData.summary.avg_gct} ms`}
                    </p>
                  </div>
                </div>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gctData.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        stroke="#444" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => {
                          const [y, m] = v.split('-');
                          const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                          return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
                        }}
                      />
                      <YAxis 
                        stroke="#444" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['dataMin - 10', 'dataMax + 10']}
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '12px' }}
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
                          const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
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
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#3B82F6' }}
                        name="pace_530"
                        connectNulls={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="pace_500" 
                        stroke="#10B981" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#10B981' }}
                        name="pace_500"
                        connectNulls={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="pace_445" 
                        stroke="#F43F5E" 
                        strokeWidth={3} 
                        dot={{ r: 5, fill: '#F43F5E' }}
                        name="pace_445"
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {[
                    { key: 'pace_530', label: '≥ 5:30/km', color: '#3B82F6' },
                    { key: 'pace_500', label: '5:00-5:29/km', color: '#10B981' },
                    { key: 'pace_445', label: '< 4:45/km', color: '#F43F5E' },
                  ].map(({ key, label, color }) => {
                    const values = gctData.monthly.map(m => m[key as keyof typeof m]).filter((v): v is number => v !== null);
                    const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
                    const min = values.length > 0 ? Math.min(...values) : null;
                    const max = values.length > 0 ? Math.max(...values) : null;
                    return (
                      <div key={key} className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 text-center">
                        <div className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color }}>{label}</div>
                        {avg !== null ? (
                          <>
                            <div className="text-2xl font-black italic text-white">{avg}<span className="text-xs text-gray-500 font-normal ml-1">ms</span></div>
                            <div className="text-[9px] text-gray-500 mt-1">min {min}ms · max {max}ms</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-600 font-bold">N/D</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BIOLOGY TAB (V3 Biology Content) */}
        {activeTab === 'biology' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <LineChartIcon className="w-6 h-6 text-[#3B82F6]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Grafico del Futuro</h2>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={futureTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis hide domain={[-50, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                      <Line type="monotone" dataKey="condizione" stroke="#EAB308" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="affaticamento" stroke="#F43F5E" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="forma" stroke="#10B981" strokeWidth={4} dot={{ r: 4, fill: '#10B981' }} />
                      <ReferenceLine x="1/4" stroke="#EAB308" strokeDasharray="3 3">
                        <Label value="PICCO 1 Apr" position="top" fill="#EAB308" fontSize={10} fontWeight="black" />
                      </ReferenceLine>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 bg-[#111111] border border-[#222] rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <div className="relative w-48 h-48 mb-8">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="88" stroke="#1E1E1E" strokeWidth="4" fill="none" />
                    <circle cx="96" cy="96" r="88" stroke="#EAB308" strokeWidth="8" fill="none" strokeDasharray={552.92} strokeDashoffset={552.92 * (1 - 0.7)} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-black text-white italic">6</span>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Giorni</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-white uppercase italic">Il tuo Golden Day è</h3>
                <div className="text-3xl font-black text-[#EAB308] italic mt-1 uppercase tracking-widest">Mer 1 Apr</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Briefcase className="w-6 h-6 text-[#3B82F6]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Portafoglio Biologico</h2>
                </div>
                <div className="space-y-6">
                  {[
                    { name: 'Neuromuscolare', km: '0 km', time: '3-7 giorni', effect: 'Reattività e Potenza', color: '#EAB308', icon: Zap },
                    { name: 'Metabolico', km: '43.4 km', time: '7-14 giorni', effect: 'Efficienza e Soglia', color: '#F43F5E', icon: Activity },
                    { name: 'Strutturale', km: '0 km', time: '14-21 giorni', effect: 'Capillari e Mitocondri', color: '#3B82F6', icon: Dna },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-[#181818] border border-[#2A2A2A] rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-[#111] border border-[#222]">
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-black text-white uppercase">{item.name}</div>
                          <div className="text-[10px] font-bold text-gray-500">{item.km}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: item.color }}>{item.time}</div>
                        <div className="text-[10px] text-gray-600 font-bold italic">{item.effect}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Info className="w-6 h-6 text-[#10B981]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">Come funziona?</h2>
                </div>
                <div className="space-y-4 text-xs text-gray-500 font-medium italic leading-relaxed">
                  <p>Quando ti alleni, il tuo corpo subisce uno <span className="text-[#F43F5E] font-black">stress controllato</span>. Nelle ore e giorni successivi, si ricostruisce <span className="text-[#10B981] font-black">più forte di prima</span>.</p>
                  <p>Questo fenomeno si chiama <span className="text-white font-black">supercompensazione</span>. I cambiamenti strutturali richiedono dai <span className="text-[#3B82F6] font-black">10 ai 21 giorni</span> per manifestarsi come performance.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOAD & RISK TAB (V3 Load Content + V1 Risk) */}
        {activeTab === 'load' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-[#111111] border border-[#222] rounded-3xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <AlertTriangle className="w-6 h-6 text-[#EAB308]" />
                  <h2 className="text-xl font-black tracking-widest uppercase italic">ACWR</h2>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={acwrData}>
                      <defs>
                        <linearGradient id="colorAcwr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="date" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#444" fontSize={10} domain={[0, 2]} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #222' }} />
                      <ReferenceLine y={1.5} stroke="#F43F5E" strokeDasharray="3 3" />
                      <ReferenceLine y={0.8} stroke="#10B981" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="value" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorAcwr)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 bg-[#111111] border border-[#222] rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <ShieldAlert className="w-16 h-16 text-[#EAB308] mb-4" />
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Rischio Infortuni</div>
                <div className="text-4xl font-black text-[#EAB308] italic uppercase tracking-widest">Moderato</div>
                <div className="w-full space-y-4 mt-10">
                  <div className="flex items-center justify-between p-4 bg-[#181818] border border-[#2A2A2A] rounded-2xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monotonia</span>
                    <span className="text-lg font-black text-white">1.2</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#181818] border border-[#2A2A2A] rounded-2xl">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Strain</span>
                    <span className="text-lg font-black text-white">4,200</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#111111] border border-[#222] rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-10">
                <Heart className="w-6 h-6 text-[#F43F5E]" />
                <h2 className="text-xl font-black tracking-widest uppercase italic">Stato di Recupero</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                <CircularGauge value={85} label="HRV Status" status="Ottimo" color="#10B981" size="large" />
                <CircularGauge value={72} label="Sonno" status="Buono" color="#3B82F6" size="large" />
                <CircularGauge value={45} label="Stress" status="Moderato" color="#EAB308" size="large" />
                <CircularGauge value={20} label="Dolori Muscolari" status="Basso" color="#10B981" size="large" />
              </div>
            </div>
          </div>
        )}

        {/* BADGES TAB */}
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
