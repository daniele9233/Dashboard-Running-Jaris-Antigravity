import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Activity, Target, Heart, TrendingUp, Zap } from 'lucide-react';

const vo2Data = [
  { date: '30/10', value: 43.2 }, { date: '14/11', value: 44.7 }, { date: '26/11', value: 45.8 },
  { date: '12/02', value: 31.4 }, { date: '05/03', value: 40.6 }, { date: '22/03', value: 29.0 },
  { date: 'Oggi', value: 30.3 },
];

const sogliaData = [
  { date: '01 Nov', pace: 4.71, label: '4:43', bpm: 152, color: '#3B82F6', trend: 'up' },
  { date: '16 Nov', pace: 4.33, label: '4:20', bpm: 149, color: '#10B981', trend: 'up' },
  { date: '30 Jan', pace: 5.51, label: '5:31', bpm: 149, color: '#EAB308', trend: 'down' },
  { date: '14 Feb', pace: 5.31, label: '5:19', bpm: 148, color: '#10B981', trend: 'up' },
  { date: '01 Mar', pace: 5.25, label: '5:15', bpm: 153, color: '#10B981', trend: 'up' },
  { date: '16 Mar', pace: 6.61, label: '6:37', bpm: 151, color: '#EAB308', trend: 'down' },
];

const paceData = [
  { date: '03/11', easy: 6.5, tempo: 5.0, fast: 4.0 },
  { date: '17/11', easy: 6.2, tempo: 4.8, fast: 3.8 },
  { date: '26/01', easy: 7.0, tempo: 5.5, fast: 4.5 },
  { date: '09/02', easy: 6.8, tempo: 5.2, fast: 4.2 },
  { date: '02/03', easy: 6.0, tempo: 4.5, fast: 3.5 },
  { date: '16/03', easy: 5.8, tempo: 4.2, fast: 3.2 },
];

const cadenzaData = [
  { date: '02/25', value: 156 }, { date: '04/25', value: 168 }, { date: '06/25', value: 170 },
  { date: '08/25', value: 174 }, { date: '10/25', value: 176 }, { date: '01/26', value: 174 },
  { date: '03/26', value: 173 },
];

export function StatsProgress() {
  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* VO2 MAX */}
          <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">VO2 Max Stimato</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2A2A2A" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="0" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#3B82F6" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="100" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-[#3B82F6]">40.6</span>
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white mb-1">40.6</div>
              <div className="text-xs text-gray-400 mb-1">ml/kg/min</div>
              <div className="text-sm font-semibold text-[#10B981] mb-2">Medio</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Target className="w-3 h-3 text-[#EAB308]" /> Target 4:30/km: <span className="text-[#EAB308]">47.9</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">Gap: 7.3 ml/kg/min</div>
            </div>
          </div>
        </div>

        {/* OBIETTIVO */}
        <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] flex-1 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Obiettivo Mezza Maratona</span>
          </div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">TARGET</div>
              <div className="text-2xl font-bold text-[#10B981]">1:35:00</div>
              <div className="text-xs text-gray-500">4:30/km</div>
            </div>
            <div className="text-gray-500 mb-4">→</div>
            <div>
              <div className="text-xs text-gray-500 mb-1">ATTUALE</div>
              <div className="text-2xl font-bold text-[#EAB308]">1:51:35</div>
              <div className="text-xs text-gray-500">5:17/km</div>
            </div>
            <div className="bg-[#EAB308]/20 text-[#EAB308] px-3 py-2 rounded-lg text-sm font-bold">
              GAP<br/>+16:36
            </div>
          </div>
          <div className="h-2 w-full bg-[#2A2A2A] rounded-full overflow-hidden mb-2">
            <div className="h-full bg-[#10B981] rounded-full" style={{ width: '85%' }} />
          </div>
          <div className="text-center text-xs text-gray-500">85% verso l'obiettivo</div>
        </div>
        </div>

      {/* SOGLIA ANAEROBICA */}
      <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] xl:col-span-2 flex flex-col">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-4 h-4 text-[#10B981]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Soglia Anaerobica</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-8 text-center">
          <div className="bg-[#121212] p-4 rounded-2xl border border-[#2A2A2A]">
            <div className="text-xs text-[#10B981] mb-2 uppercase font-bold">Attuale</div>
            <div className="flex justify-center gap-4">
              <div>
                <Heart className="w-5 h-5 text-[#F43F5E] mx-auto mb-1" />
                <div className="text-xl font-bold text-white">152</div>
                <div className="text-xs text-gray-500">bpm</div>
              </div>
              <div>
                <Activity className="w-5 h-5 text-[#3B82F6] mx-auto mb-1" />
                <div className="text-xl font-bold text-white">5:16</div>
                <div className="text-xs text-gray-500">/km</div>
              </div>
              <div>
                <Zap className="w-5 h-5 text-[#10B981] mx-auto mb-1" />
                <div className="text-xl font-bold text-white">85</div>
                <div className="text-xs text-gray-500">% FC max</div>
              </div>
            </div>
          </div>
          
          <div className="bg-[#121212] p-4 rounded-2xl border border-[#2A2A2A] col-span-2">
            <div className="text-xs text-[#EAB308] mb-2 uppercase font-bold">Pre-Infortunio (Nov 2025)</div>
            <div className="flex justify-center gap-8">
              <div>
                <Heart className="w-5 h-5 text-[#F43F5E] mx-auto mb-1" />
                <div className="text-xl font-bold text-[#EAB308]">149</div>
                <div className="text-xs text-gray-500">bpm</div>
              </div>
              <div>
                <Activity className="w-5 h-5 text-[#EAB308] mx-auto mb-1" />
                <div className="text-xl font-bold text-[#EAB308]">4:20</div>
                <div className="text-xs text-gray-500">/km</div>
              </div>
              <div>
                <Zap className="w-5 h-5 text-[#EAB308] mx-auto mb-1" />
                <div className="text-xl font-bold text-[#EAB308]">83</div>
                <div className="text-xs text-gray-500">% FC max</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="text-sm font-bold text-[#10B981] uppercase tracking-wider">Progressi Soglia (ogni 15 giorni)</div>
          <div className="text-xs text-gray-500">Stesso sforzo (FC 140-160 bpm) → Passo più veloce = miglioramento</div>
        </div>

        <div className="flex-1 min-h-[200px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sogliaData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <Tooltip 
                cursor={{ fill: '#2A2A2A', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', color: '#fff' }}
              />
              <Bar dataKey="pace" radius={[4, 4, 0, 0]}>
                {sogliaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between px-2 mt-2">
          {sogliaData.map((d, i) => (
            <div key={i} className="text-center">
              <div className="text-xs font-bold text-white">{d.label}</div>
              <div className="text-[10px] text-gray-500">{d.bpm} bpm</div>
              <div className="text-[10px] text-gray-400 mt-1">{d.date}</div>
              <div className={`text-xs mt-1 ${d.trend === 'up' ? 'text-[#10B981]' : 'text-[#EAB308]'}`}>
                {d.trend === 'up' ? '↑' : '↓'}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10B981]"></div> Miglior passo</span>
          <span className="flex items-center gap-1">↑ Miglioramento</span>
        </div>
      </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* ANDAMENTO VO2MAX */}
      <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-[#F43F5E]"></div>
          <span className="text-sm font-bold text-white uppercase tracking-wider">Andamento VO2Max</span>
        </div>
        <div className="h-48 w-full mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={vo2Data}>
              <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />
              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', color: '#fff' }} />
              <Line type="monotone" dataKey="value" stroke="#F43F5E" strokeWidth={2} dot={{ fill: '#F43F5E', r: 4 }} label={{ position: 'top', fill: '#71717A', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">↑ Linea che sale = VO2max migliora</div>
      </div>

      {/* ANDAMENTO PACES */}
      <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Andamento Paces</span>
        </div>
        <div className="text-xs text-gray-500 mb-6">Ritmi medi per zona, settimana per settimana</div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={paceData}>
              <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis reversed domain={[3, 8]} hide />
              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', color: '#fff' }} />
              <Line type="monotone" dataKey="easy" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="tempo" stroke="#EAB308" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fast" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <span className="flex items-center gap-1 text-gray-400"><div className="w-2 h-2 rounded-full bg-[#10B981]"></div> Easy</span>
          <span className="flex items-center gap-1 text-gray-400"><div className="w-2 h-2 rounded-full bg-[#EAB308]"></div> Tempo</span>
          <span className="flex items-center gap-1 text-gray-400"><div className="w-2 h-2 rounded-full bg-[#F43F5E]"></div> Fast</span>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">↓ Linee che scendono = passo più veloce (meglio)</div>
      </div>

      {/* CADENZA */}
      <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A] flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-3 bg-[#3B82F6] rounded-full"></div>
            <div className="w-1.5 h-3 bg-[#3B82F6] rounded-full"></div>
          </div>
          <span className="text-sm font-bold text-white uppercase tracking-wider">Cadenza</span>
        </div>
        <div className="text-xs text-gray-500 mb-6">Media mensile (spm) — target: 180 passi/min</div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cadenzaData}>
              <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis domain={[150, 190]} hide />
              <ReferenceLine y={180} stroke="#10B981" strokeDasharray="3 3" />
              <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', color: '#fff' }} />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} label={{ position: 'top', fill: '#71717A', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center text-xs text-gray-500 mt-2">Punti verdi = cadenza a target (180+) - Linea tratteggiata = obiettivo</div>
      </div>
      </div>

    </div>
  );
}
