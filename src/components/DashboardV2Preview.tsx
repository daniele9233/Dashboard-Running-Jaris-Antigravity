/**
 * DashboardV2Preview — mock statico, valori fittizi, nessuna logica/API.
 * Accessibile su /v2 per confronto visivo con la dashboard attuale.
 */
import { useNavigate } from "react-router-dom";
import {
  Activity, BarChart2, Heart, RefreshCw, Dumbbell, LineChart,
  Bell, Settings, Search, Plus, HelpCircle, LogOut,
  Zap, TrendingDown, Trophy, MapPin, ChevronRight,
} from "lucide-react";

// ─── Gauge SVG ────────────────────────────────────────────────────────────────
function GaugeCircle({ value, color }: { value: number; color: string }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} stroke="#2a2a2a" strokeWidth="9" fill="none" />
        <circle
          cx="65" cy="65" r={r}
          stroke={color}
          strokeWidth="9"
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white leading-none">51</span>
        <span className="text-[10px] text-[#777] font-black tracking-widest mt-1">PEAK SCORE</span>
      </div>
    </div>
  );
}

// ─── Mini Bar Chart (Training Consistency) ───────────────────────────────────
const CONSISTENCY_BARS = [
  { h: 35, active: false }, { h: 55, active: false }, { h: 72, active: true  },
  { h: 88, active: true  }, { h: 60, active: false }, { h: 40, active: false },
  { h: 20, active: false }, { h: 15, active: false }, { h: 30, active: false },
  { h: 48, active: false }, { h: 65, active: true  }, { h: 82, active: true  },
  { h: 70, active: false }, { h: 90, active: true  },
];

function ConsistencyChart() {
  return (
    <div className="flex items-end gap-2 h-24 px-2">
      {CONSISTENCY_BARS.map((b, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm transition-all"
          style={{
            height: `${b.h}%`,
            backgroundColor: b.active ? "#C0FF00" : "#2a2a2a",
          }}
        />
      ))}
    </div>
  );
}

// ─── Adaptation Bar ──────────────────────────────────────────────────────────
function AdaptBar({ label, pct, color, status }: { label: string; pct: number; color: string; status: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-black tracking-widest text-[#888] uppercase">{label}</span>
        <span className="text-[10px] font-black" style={{ color }}>{status}</span>
      </div>
      <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV = [
  { icon: Activity,   label: "PERFORMANCE", active: true  },
  { icon: Heart,      label: "BIOMETRICS",  active: false },
  { icon: RefreshCw,  label: "RECOVERY",    active: false },
  { icon: Dumbbell,   label: "TRAINING",    active: false },
  { icon: LineChart,  label: "ANALYSIS",    active: false },
];

function V2Sidebar({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-[200px] shrink-0 bg-[#0d0d0d] border-r border-white/[0.05] flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 pt-7 pb-6">
        <div className="text-[#C0FF00] text-base font-black tracking-tight leading-none">METIC LAB</div>
        <div className="text-[#555] text-[9px] font-black tracking-widest mt-1">ELITE PERFORMANCE</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black tracking-widest transition-all ${
              active
                ? "bg-[#C0FF00] text-black"
                : "text-[#555] hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-6 space-y-3">
        <button
          className="w-full flex items-center justify-center gap-2 bg-[#C0FF00] text-black text-[11px] font-black tracking-widest py-3.5 rounded-full hover:bg-[#d4ff33] transition-all"
        >
          <Plus size={15} />
          NEW SESSION
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#555] hover:text-white text-[11px] font-black tracking-widest">
          <HelpCircle size={14} /> SUPPORT
        </button>
        <button
          onClick={onBack}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[#555] hover:text-rose-400 text-[11px] font-black tracking-widest"
        >
          <LogOut size={14} /> TORNA V1
        </button>
      </div>
    </div>
  );
}

// ─── Main Preview ─────────────────────────────────────────────────────────────
export function DashboardV2Preview() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0d0d0d] flex text-white font-sans overflow-hidden">
      <V2Sidebar onBack={() => navigate("/")} />

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="h-14 border-b border-white/[0.05] flex items-center justify-between px-6 bg-[#0d0d0d] shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#555]" />
            <input
              readOnly
              defaultValue="Search metrics..."
              className="bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-[11px] text-[#555] w-52 cursor-default"
            />
          </div>
          <div className="flex items-center gap-4">
            <Bell size={17} className="text-[#555]" />
            <Settings size={17} className="text-[#555]" />
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img src="https://picsum.photos/seed/daniele/64/64" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 max-w-[1400px] mx-auto space-y-5">

            {/* Preview badge */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-black italic tracking-tight text-white uppercase">Hey, Daniele 👋</h1>
                </div>
                <p className="text-sm text-[#666]">Ready for your morning anaerobic threshold test?</p>
              </div>
              <div className="flex items-center gap-2 bg-[#C0FF00]/10 border border-[#C0FF00]/30 rounded-full px-4 py-2">
                <div className="w-2 h-2 rounded-full bg-[#C0FF00] animate-pulse" />
                <span className="text-[#C0FF00] text-[10px] font-black tracking-widest">PREVIEW V2 — VALORI FITTIZI</span>
              </div>
            </div>

            {/* ── Main 2-col layout ── */}
            <div className="flex gap-5 items-start">

              {/* LEFT — main content */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* Row 1: Status of Form + ATL */}
                <div className="grid grid-cols-5 gap-4">
                  {/* Status of Form */}
                  <div className="col-span-3 bg-[#161616] border border-white/[0.06] rounded-2xl p-6">
                    <div className="text-[#555] text-[9px] font-black tracking-widest mb-5">STATUS OF FORM</div>
                    <div className="flex items-center gap-8">
                      <GaugeCircle value={51} color="#C0FF00" />
                      <div className="flex flex-col gap-5">
                        <div>
                          <div className="text-[#555] text-[9px] font-black tracking-widest mb-1">TSB VALUE</div>
                          <div className="text-[#C0FF00] text-3xl font-black">+0.4</div>
                        </div>
                        <div>
                          <div className="text-[#555] text-[9px] font-black tracking-widest mb-1">EFFICIENCY FACTOR</div>
                          <div className="text-white text-3xl font-black">85.5%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fatigue ATL */}
                  <div className="col-span-2 bg-[#C0FF00] rounded-2xl p-6 flex flex-col justify-between">
                    <div>
                      <div className="text-black/60 text-[9px] font-black tracking-widest mb-1">FATIGUE (ATL)</div>
                      <div className="text-black text-7xl font-black tracking-tight leading-none">19.1</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-black/60" />
                      <span className="text-black/70 text-sm font-black">LOW</span>
                    </div>
                    <TrendingDown size={32} className="text-black/40 self-end" />
                  </div>
                </div>

                {/* Row 2: Training Consistency */}
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-[#555] text-[9px] font-black tracking-widest">TRAINING CONSISTENCY (12M)</div>
                    <div className="flex items-center gap-2 bg-[#C0FF00]/10 border border-[#C0FF00]/20 rounded-full px-3 py-1">
                      <Zap size={10} className="text-[#C0FF00]" />
                      <span className="text-[#C0FF00] text-[9px] font-black tracking-widest">ELITE LEVEL</span>
                    </div>
                  </div>
                  <ConsistencyChart />
                  <div className="flex justify-between mt-3">
                    <span className="text-[#444] text-[9px] font-black">JAN 23</span>
                    <span className="text-[#444] text-[9px] font-black">JUN 23</span>
                    <span className="text-[#444] text-[9px] font-black">JAN 24</span>
                  </div>
                </div>

                {/* Row 3: Anaerobic + Lactate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6">
                    <div className="text-[#555] text-[9px] font-black tracking-widest mb-4">ANAEROBIC THRESHOLD</div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-white text-5xl font-black">174</span>
                      <span className="text-[#555] text-sm font-black">BPM</span>
                    </div>
                    <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-[#C0FF00] rounded-full" style={{ width: "72%" }} />
                    </div>
                  </div>
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-6">
                    <div className="text-[#555] text-[9px] font-black tracking-widest mb-4">LACTATE THRESHOLD</div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-white text-5xl font-black">4:12</span>
                      <span className="text-[#555] text-sm font-black">MIN/KM</span>
                    </div>
                    <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full bg-[#60A5FA] rounded-full" style={{ width: "58%" }} />
                    </div>
                  </div>
                </div>

                {/* Row 4: VO2 + Avg Pace */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <div className="text-[#555] text-[9px] font-black tracking-widest mb-3">VO2 MAX EST.</div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-4xl font-black">38.9</span>
                        <span className="text-[#555] text-xs font-black">ml/kg/min</span>
                      </div>
                    </div>
                    <Activity size={28} className="text-[#333]" />
                  </div>
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <div className="text-[#555] text-[9px] font-black tracking-widest mb-3">AVG PACE (LAST 30D)</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-white text-4xl font-black">5'42</span>
                        <span className="text-white text-2xl font-black">"</span>
                        <span className="text-[#555] text-xs font-black ml-1">min/km</span>
                      </div>
                    </div>
                    <BarChart2 size={28} className="text-[#333]" />
                  </div>
                </div>

                {/* Row 5: Cardiac Drift + Next Optimal + Efficiency Index */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Cardiac Drift */}
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center shrink-0">
                      <Heart size={18} className="text-rose-400" />
                    </div>
                    <div>
                      <div className="text-[#555] text-[9px] font-black tracking-widest mb-1">CARDIAC DRIFT</div>
                      <div className="text-white text-xl font-black">+5.2%</div>
                      <div className="text-rose-400 text-[9px] font-black">Elevated</div>
                    </div>
                  </div>

                  {/* Next Optimal Session — highlighted */}
                  <div className="bg-[#161616] border-2 border-[#C0FF00]/40 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[#C0FF00]/[0.03]" />
                    <div className="w-10 h-10 rounded-full bg-[#C0FF00]/15 flex items-center justify-center shrink-0 relative">
                      <RefreshCw size={18} className="text-[#C0FF00]" />
                    </div>
                    <div className="relative">
                      <div className="text-[#C0FF00] text-[9px] font-black tracking-widest mb-1">NEXT OPTIMAL SESSION</div>
                      <div className="text-white text-sm font-black leading-tight">Tomorrow, 07:30</div>
                      <div className="text-[#888] text-[10px] font-black">· Low Aerobic</div>
                    </div>
                    <ChevronRight size={14} className="text-[#C0FF00] ml-auto relative shrink-0" />
                  </div>

                  {/* Efficiency Index */}
                  <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#C0FF00]/10 flex items-center justify-center shrink-0">
                      <Zap size={18} className="text-[#C0FF00]" />
                    </div>
                    <div>
                      <div className="text-[#555] text-[9px] font-black tracking-widest mb-1">EFFICIENCY INDEX</div>
                      <div className="text-white text-xl font-black">1.54</div>
                      <div className="text-[#C0FF00] text-[9px] font-black">Stable</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT — side panel */}
              <div className="w-[280px] shrink-0 space-y-4">

                {/* Hall of Fame */}
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy size={13} className="text-[#C0FF00]" />
                    <span className="text-[#555] text-[9px] font-black tracking-widest">HALL OF FAME</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "FASTEST 10K",      value: "44:12",  meta: "MAR 24" },
                      { label: "MAX DISTANCE",      value: "21.4 km", meta: "FEB 24" },
                      { label: "HIGHEST ELEVATION", value: "842 m",  meta: "APR 24" },
                    ].map(({ label, value, meta }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div>
                          <div className="text-[#555] text-[9px] font-black tracking-widest">{label}</div>
                          <div className="text-white text-sm font-black mt-0.5">{value}</div>
                        </div>
                        <span className="text-[#444] text-[9px] font-black">{meta}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ultima Corsa — map card */}
                <div className="rounded-2xl overflow-hidden relative bg-[#111] border border-white/[0.06]">
                  {/* Map placeholder */}
                  <div
                    className="h-[140px] relative overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                    }}
                  >
                    {/* Grid lines fake map */}
                    <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#888" strokeWidth="0.3"/>
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                      {/* Fake route polyline */}
                      <polyline
                        points="20,110 50,85 90,70 130,60 165,55 185,65 210,80 240,75 260,60"
                        fill="none" stroke="#C0FF00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        opacity="0.9"
                      />
                    </svg>
                    <div className="absolute top-3 left-3 bg-[#C0FF00] text-black text-[8px] font-black tracking-widest px-2 py-1 rounded-md">
                      ULTIMA CORSA
                    </div>
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 text-white/60">
                      <MapPin size={10} />
                    </div>
                  </div>
                  {/* Run info */}
                  <div className="p-4">
                    <div className="text-white font-black text-sm mb-0.5">Morning Tempo Run</div>
                    <div className="text-[#555] text-[10px] mb-3">Milano, Parco Sempione</div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "DIST",  value: "8.42 km" },
                        { label: "TIME",  value: "42:15"   },
                        { label: "PACE",  value: "5'01\""  },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="text-[#444] text-[8px] font-black tracking-widest mb-0.5">{label}</div>
                          <div className="text-white text-xs font-black">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Adaptation Summary */}
                <div className="bg-[#161616] border border-white/[0.06] rounded-2xl p-5">
                  <div className="text-[#555] text-[9px] font-black tracking-widest mb-4">ADAPTATION SUMMARY</div>
                  <AdaptBar label="Cardiovascular" pct={88} color="#C0FF00"   status="OPTIMAL"      />
                  <AdaptBar label="Metabolic"      pct={62} color="#60A5FA"   status="GOOD"         />
                  <AdaptBar label="Muscular"       pct={38} color="#F43F5E"   status="HIGH TENSION" />
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
