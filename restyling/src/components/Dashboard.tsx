import React from 'react';
import { Wind, TrendingDown, Activity, Clock, Target, Timer, Zap, Flame, Trophy } from 'lucide-react';
import { MapboxMap } from './MapboxMap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from './ThemeContext';

const weeklyData = [
  { day: 'Mon', km: 12 },
  { day: 'Tue', km: 15 },
  { day: 'Wed', km: 8 },
  { day: 'Thu', km: 22 },
  { day: 'Fri', km: 5 },
  { day: 'Sat', km: 28 },
  { day: 'Sun', km: 35 },
];

export function Dashboard() {
  const { isDark } = useTheme();

  return (
    <div className="p-8 w-full max-w-[1600px] mx-auto space-y-5">
      <div className="flex gap-5 items-start">
        {/* Main Content */}
        <div className="flex-1 space-y-5 min-w-0">
          {/* Top Row */}
        <div className="grid grid-cols-3 gap-5">
        {/* Status of Form */}
        <div className="col-span-2 bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 relative overflow-hidden transition-colors">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-2">LIVE BIO-FEED</div>
              <h2 className="text-gray-900 dark:text-white text-4xl font-bold tracking-tight">Status of Form</h2>
            </div>
            <div className="bg-blue-100 dark:bg-[#ccff00]/10 text-blue-600 dark:text-[#ccff00] px-3 py-1 rounded-full text-xs font-bold tracking-wide flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#ccff00]"></div>
              OPTIMAL
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="relative w-64 h-64 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke={isDark ? "#333" : "#eee"} strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="40" stroke={isDark ? "#ccff00" : "#2563eb"} strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset="40" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-blue-600 dark:text-[#ccff00] text-5xl font-bold">84</span>
                <span className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mt-1">PEAK SCORE</span>
              </div>
            </div>

            <div className="text-right flex flex-col gap-6">
              <div>
                <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-1">TSB</div>
                <div className="text-blue-600 dark:text-[#ccff00] text-3xl font-bold">+12.4</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-1">EFFICIENCY</div>
                <div className="text-gray-900 dark:text-white text-3xl font-bold">98.2%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-1 flex flex-col gap-5">
          {/* VO2 Max */}
          <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-6 flex-1 flex flex-col justify-between border-t-4 border-blue-600 dark:border-[#ccff00] transition-colors">
            <div className="flex justify-between items-start">
              <Wind className="text-blue-600 dark:text-[#ccff00]" size={24} />
              <div className="bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-[#A0A0A0] px-2 py-1 rounded text-[10px] font-bold tracking-widest">
                ALL-TIME HIGH
              </div>
            </div>
            <div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-2">VO2 MAX</div>
              <div className="flex items-baseline gap-2">
                <span className="text-gray-900 dark:text-white text-5xl font-bold tracking-tight">74.2</span>
                <span className="text-gray-500 dark:text-[#A0A0A0] text-sm font-semibold">ml/kg/min</span>
              </div>
            </div>
          </div>

          {/* Fatigue Index */}
          <div className="bg-blue-600 dark:bg-[#ccff00] rounded-xl p-6 flex-1 flex flex-col justify-between shadow-sm dark:shadow-none transition-colors">
            <div className="flex justify-between items-start">
              <TrendingDown className="text-white dark:text-black" size={24} />
              <div className="bg-white/20 dark:bg-black/10 text-white dark:text-black px-2 py-1 rounded text-[10px] font-bold tracking-widest">
                CRUCIAL FOCUS
              </div>
            </div>
            <div>
              <div className="text-blue-100 dark:text-black/70 text-xs font-bold tracking-widest mb-2">FATIGUE INDEX</div>
              <div className="flex items-baseline gap-2">
                <span className="text-white dark:text-black text-5xl font-bold tracking-tight">2.1</span>
                <span className="text-blue-100 dark:text-black/70 text-sm font-bold">LOW RISK</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Small Cards */}
      <div className="grid grid-cols-4 gap-5">
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors flex flex-col justify-between">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest mb-4">SOGLIA ANAEROBICA</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-gray-900 dark:text-white text-3xl font-bold">172</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-xs">BPM</span>
          </div>
          <div className="flex gap-1 h-1.5 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex-1 rounded-full ${i < 4 ? 'bg-blue-600 dark:bg-[#ccff00]' : 'bg-gray-200 dark:bg-[#333]'}`}></div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors flex flex-col justify-between">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest mb-4">LACTATE THRESHOLD</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-gray-900 dark:text-white text-3xl font-bold">168</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-xs">BPM</span>
          </div>
          <div className="flex gap-1 h-1.5 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex-1 rounded-full ${i < 5 ? 'bg-gray-400 dark:bg-[#555]' : 'bg-gray-200 dark:bg-[#333]'}`}></div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors flex flex-col justify-between">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest mb-4">AVG PACE</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-gray-900 dark:text-white text-3xl font-bold">4:15</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-xs">/km</span>
          </div>
          <div className="flex gap-1 h-1.5 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex-1 rounded-full ${i === 3 ? 'bg-blue-600 dark:bg-[#ccff00]' : 'bg-gray-200 dark:bg-[#333]'}`}></div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors flex flex-col justify-between">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest mb-4">DERIVA CARDIACA</div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-gray-900 dark:text-white text-3xl font-bold">3.2</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-xs">%</span>
          </div>
          <div className="flex gap-1 h-1.5 mt-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex-1 rounded-full ${i === 5 ? 'bg-blue-600 dark:bg-[#ccff00]' : 'bg-gray-400 dark:bg-[#555]'}`}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Chart and Map */}
      <div className="grid grid-cols-5 gap-5 items-stretch">
        {/* Bar Chart */}
        <div className="col-span-3 bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors flex flex-col">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-6">KILOMETRAGGIO SETTIMANALE</div>
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <XAxis dataKey="day" stroke={isDark ? "#888" : "#aaa"} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={isDark ? "#888" : "#aaa"} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                  contentStyle={{
                    backgroundColor: isDark ? '#111' : '#fff', 
                    border: isDark ? '1px solid #333' : '1px solid #eee', 
                    borderRadius: '8px', 
                    color: isDark ? '#fff' : '#000'
                  }}
                />
                <Bar dataKey="km" fill={isDark ? "#ccff00" : "#2563eb"} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mapbox Minimap */}
        <div className="col-span-2 bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 flex flex-col transition-colors relative">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-6">LAST RUN LOCATION</div>
          <div className="flex-1 rounded-lg overflow-hidden relative min-h-[280px]">
             <MapboxMap />
             {/* Clean Overlay */}
             <div className="absolute bottom-4 left-4 z-10">
               <div className="text-gray-900 dark:text-white text-sm font-bold drop-shadow-md">12.4 km</div>
               <div className="text-gray-700 dark:text-[#A0A0A0] text-xs font-semibold drop-shadow-md">Parco Sempione, Milan</div>
             </div>
          </div>
        </div>
      </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[340px] shrink-0 space-y-5">
        {/* Target Card */}
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Target className="text-blue-600 dark:text-[#ccff00]" size={16} />
            <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest uppercase">Target: Milan Marathon</span>
          </div>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-gray-900 dark:text-white text-4xl font-bold">42</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-sm font-bold mr-2">D</span>
            <span className="text-gray-900 dark:text-white text-4xl font-bold">14</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-sm font-bold mr-2">H</span>
            <span className="text-gray-900 dark:text-white text-4xl font-bold">30</span>
            <span className="text-gray-500 dark:text-[#A0A0A0] text-sm font-bold">M</span>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-bold tracking-widest mb-2">
              <span className="text-gray-500 dark:text-[#A0A0A0]">TRAINING PLAN</span>
              <span className="text-blue-600 dark:text-[#ccff00]">72%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 dark:bg-[#ccff00] rounded-full" style={{ width: '72%' }}></div>
            </div>
          </div>
        </div>

        {/* Next Optimal Session Card */}
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-4 transition-colors flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2 w-full">
            <Timer className="text-orange-500" size={16} />
            <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest uppercase">Next Optimal Session</span>
          </div>
          
          <div className="relative w-24 h-24 flex-shrink-0 mb-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke={isDark ? "#333" : "#eee"} strokeWidth="6" fill="none" />
              <circle cx="50" cy="50" r="40" stroke="#f97316" strokeWidth="6" fill="none" strokeDasharray="251.2" strokeDashoffset="60" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-gray-900 dark:text-white text-lg font-bold tracking-tight">04:22:15</span>
            </div>
          </div>
          
          <div className="text-orange-500 text-[10px] font-bold tracking-widest uppercase">
            Injury Prevention Buffer
          </div>
        </div>

        {/* Adaptation Summary Card */}
        <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-6 transition-colors">
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest uppercase mb-6">Adaptation Summary</div>
          
          <div className="space-y-5">
            {/* Neuro */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="text-blue-600 dark:text-[#ccff00]" size={14} />
                  <span className="text-gray-900 dark:text-white text-xs font-bold uppercase">Neuro</span>
                </div>
                <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px]">Ready Tomorrow</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 dark:bg-[#ccff00] rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            
            {/* Metabo */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="text-orange-500" size={14} />
                  <span className="text-gray-900 dark:text-white text-xs font-bold uppercase">Metabo</span>
                </div>
                <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px]">In Progress</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            
            {/* Strutt */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="text-purple-500" size={14} />
                  <span className="text-gray-900 dark:text-white text-xs font-bold uppercase">Strutt</span>
                </div>
                <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px]">In Progress</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-[#333] rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: '30%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Row 4: Session Logs (Full Width) */}
      <div className="bg-white dark:bg-[#1a1a1a] shadow-sm dark:shadow-none rounded-xl p-8 transition-colors w-full">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold tracking-widest mb-2">SESSION LOGS</div>
            <h2 className="text-gray-900 dark:text-white text-2xl font-bold tracking-tight">Performance History</h2>
          </div>
          <button className="text-blue-600 dark:text-[#ccff00] text-xs font-bold tracking-widest border-b border-blue-600 dark:border-[#ccff00] pb-1">
            EXPORT ALL DATA
          </button>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-7 text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest mb-4 px-4">
            <div className="col-span-2">TYPE</div>
            <div>DATE</div>
            <div>DURATION</div>
            <div>AVG PACE</div>
            <div>TE SCORE</div>
            <div className="text-right">STATUS</div>
          </div>
          
          <div className="space-y-2">
            <div className="grid grid-cols-7 items-center bg-gray-50 dark:bg-[#111] rounded-lg p-4 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <Activity className="text-blue-600 dark:text-[#ccff00]" size={18} />
                <span className="text-gray-900 dark:text-white font-semibold text-sm">Interval Sprints</span>
              </div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">Oct 24, 2023</div>
              <div className="text-gray-900 dark:text-white font-semibold text-sm">45:12</div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">3:42 /km</div>
              <div className="text-blue-600 dark:text-[#ccff00] font-bold text-sm">4.8 <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-normal tracking-widest ml-1">HIGHLY AEROBIC</span></div>
              <div className="text-right flex items-center justify-end gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#ccff00]"></div>
                <span className="text-gray-900 dark:text-white text-[10px] font-bold tracking-widest">VERIFIED</span>
              </div>
            </div>

            <div className="grid grid-cols-7 items-center bg-gray-50 dark:bg-[#111] rounded-lg p-4 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <Activity className="text-blue-600 dark:text-[#ccff00]" size={18} />
                <span className="text-gray-900 dark:text-white font-semibold text-sm">Recovery Zone</span>
              </div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">Oct 23, 2023</div>
              <div className="text-gray-900 dark:text-white font-semibold text-sm">1:20:05</div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">5:15 /km</div>
              <div className="text-gray-900 dark:text-white font-bold text-sm">2.1 <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-normal tracking-widest ml-1">RECOVERY</span></div>
              <div className="text-right flex items-center justify-end gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#ccff00]"></div>
                <span className="text-gray-900 dark:text-white text-[10px] font-bold tracking-widest">VERIFIED</span>
              </div>
            </div>

            <div className="grid grid-cols-7 items-center bg-gray-50 dark:bg-[#111] rounded-lg p-4 transition-colors">
              <div className="col-span-2 flex items-center gap-3">
                <Clock className="text-blue-600 dark:text-[#ccff00]" size={18} />
                <span className="text-gray-900 dark:text-white font-semibold text-sm">Tempo Session</span>
              </div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">Oct 21, 2023</div>
              <div className="text-gray-900 dark:text-white font-semibold text-sm">38:40</div>
              <div className="text-gray-500 dark:text-[#A0A0A0] text-sm">4:05 /km</div>
              <div className="text-blue-600 dark:text-[#ccff00] font-bold text-sm">4.2 <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-normal tracking-widest ml-1">AEROBIC IMPACT</span></div>
              <div className="text-right flex items-center justify-end gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-[#ccff00]"></div>
                <span className="text-gray-900 dark:text-white text-[10px] font-bold tracking-widest">VERIFIED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
