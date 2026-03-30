import { Activity, AlertTriangle, ShieldCheck, ShieldAlert, HeartPulse, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

const acwrData = [
  { date: '1 Mar', ratio: 0.9, acute: 400, chronic: 440 },
  { date: '8 Mar', ratio: 1.1, acute: 500, chronic: 450 },
  { date: '15 Mar', ratio: 1.25, acute: 600, chronic: 480 },
  { date: '22 Mar', ratio: 1.6, acute: 800, chronic: 500 }, // Danger zone
  { date: '29 Mar', ratio: 1.4, acute: 750, chronic: 530 },
  { date: '5 Apr', ratio: 1.1, acute: 650, chronic: 590 },
  { date: '12 Apr', ratio: 0.95, acute: 600, chronic: 630 },
];

const recoveryData = [
  { metric: 'HRV Status', value: 85, status: 'Ottimo', color: '#10B981' },
  { metric: 'Sonno', value: 72, status: 'Buono', color: '#3B82F6' },
  { metric: 'Stress', value: 45, status: 'Moderato', color: '#EAB308' },
  { metric: 'Dolori Muscolari', value: 20, status: 'Basso', color: '#10B981' },
];

export function StatsRisk() {
  const currentRisk = "Moderato"; // Basso, Moderato, Alto
  const currentACWR = 1.1;

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column (Charts & Metrics) */}
        <div className="xl:col-span-2 space-y-6">
          {/* ACWR Chart */}
          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-[#EAB308]" />
                  Acute:Chronic Workload Ratio
                </h3>
                <p className="text-xs text-gray-500 mt-1">Rapporto tra fatica recente (7gg) e fitness storico (28gg)</p>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={acwrData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRatio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EAB308" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} domain={[0, 2]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#121212', border: '1px solid #2A2A2A', borderRadius: '12px', color: '#E2E8F0' }}
                    itemStyle={{ color: '#E2E8F0' }}
                  />
                  <ReferenceLine y={1.5} stroke="#F43F5E" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Danger Zone', fill: '#F43F5E', fontSize: 10 }} />
                  <ReferenceLine y={1.3} stroke="#3B82F6" strokeDasharray="3 3" />
                  <ReferenceLine y={0.8} stroke="#3B82F6" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'Sweet Spot', fill: '#3B82F6', fontSize: 10 }} />
                  <Area type="monotone" dataKey="ratio" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorRatio)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recovery Metrics */}
          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <HeartPulse className="w-5 h-5 text-[#F43F5E]" />
              Stato di Recupero
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {recoveryData.map((item, index) => (
                <div key={index} className="bg-[#121212] p-4 rounded-2xl border border-[#2A2A2A] flex flex-col items-center text-center">
                  <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#2A2A2A"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="3"
                        strokeDasharray={`${item.value}, 100`}
                      />
                    </svg>
                    <div className="absolute flex items-center justify-center text-sm font-bold text-white">
                      {item.value}
                    </div>
                  </div>
                  <h4 className="text-xs text-gray-400 font-medium mb-1">{item.metric}</h4>
                  <span className="text-sm font-bold" style={{ color: item.color }}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Overview & Strain) */}
        <div className="space-y-6">
          {/* Risk Overview */}
          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A] flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#10B981] via-[#EAB308] to-[#F43F5E]"></div>
            <ShieldAlert className="w-12 h-12 text-[#EAB308] mb-4" />
            <h3 className="text-gray-400 text-sm font-medium mb-1">Rischio Infortuni Globale</h3>
            <div className="text-3xl font-bold text-[#EAB308] mb-2">{currentRisk}</div>
            <p className="text-xs text-gray-500">Basato su carico acuto, cronico e recupero</p>
          </div>

          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="text-sm font-semibold text-gray-400">ACWR Attuale</h3>
              </div>
              <span className="text-2xl font-bold text-white">{currentACWR}</span>
            </div>
            
            <div className="w-full bg-[#121212] rounded-full h-3 mb-2 overflow-hidden flex border border-[#2A2A2A]">
              <div className="h-full bg-[#10B981]" style={{ width: '40%' }}></div> {/* 0 - 0.8 */}
              <div className="h-full bg-[#3B82F6]" style={{ width: '25%' }}></div> {/* 0.8 - 1.3 Sweet spot */}
              <div className="h-full bg-[#EAB308]" style={{ width: '10%' }}></div> {/* 1.3 - 1.5 */}
              <div className="h-full bg-[#F43F5E]" style={{ width: '25%' }}></div> {/* 1.5+ Danger */}
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1">
              <span>Sotto-allenamento</span>
              <span>Sweet Spot</span>
              <span>Zona Pericolo</span>
            </div>
          </div>

          {/* Monotony */}
          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-[#10B981]" />
              <h3 className="text-sm font-semibold text-gray-400">Monotonia</h3>
            </div>
            <div className="text-3xl font-bold text-white mb-1">1.2</div>
            <p className="text-xs text-gray-500 mb-4">Variazione del carico giornaliero. &lt; 1.5 è ottimale.</p>
            <div className="w-full bg-[#121212] rounded-full h-2 border border-[#2A2A2A]">
              <div className="bg-[#10B981] h-2 rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>

          {/* Strain */}
          <div className="bg-[#181818] p-6 rounded-2xl border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-[#F43F5E]" />
              <h3 className="text-sm font-semibold text-gray-400">Strain (Sforzo)</h3>
            </div>
            <div className="text-3xl font-bold text-white mb-1">4,200</div>
            <p className="text-xs text-gray-500 mb-4">Carico settimanale × Monotonia. Attenzione se &gt; 6000.</p>
            <div className="w-full bg-[#121212] rounded-full h-2 border border-[#2A2A2A]">
              <div className="bg-[#EAB308] h-2 rounded-full" style={{ width: '70%' }}></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
