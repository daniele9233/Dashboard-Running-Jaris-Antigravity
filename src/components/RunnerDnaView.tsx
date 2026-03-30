import React, { useEffect, useState } from "react";
import { getRunnerDna } from "../api";
import { 
  Dna, 
  Activity, 
  TrendingUp, 
  Target, 
  HeartPulse, 
  Zap, 
  BrainCircuit, 
  Trophy,
  BarChart,
  CalendarDays
} from "lucide-react";

export function RunnerDnaView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRunnerDna()
      .then((res) => {
        setData(res.data.dna);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#050505] p-8">
        <Dna className="w-16 h-16 text-[#C0FF00] animate-spin mb-6" style={{ animationDuration: '3s' }} />
        <h2 className="text-[#C0FF00] font-black text-2xl tracking-[0.2em] animate-pulse">EXTRACTING METRIC DNA...</h2>
        <p className="text-gray-500 mt-3 text-sm tracking-widest uppercase">Cross-referencing historical Strava data</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 bg-[#0A0A0A] p-8">
        <p className="text-gray-500 uppercase tracking-widest">Dati insufficienti o errore di calcolo.</p>
      </div>
    );
  }

  const { profile, stats, performance, consistency, efficiency, current_state, potential } = data;

  return (
    <div className="flex-1 overflow-y-auto bg-[#050505] p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1400px] mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Dna className="w-8 h-8 text-[#C0FF00]" />
              <h1 className="text-5xl font-black italic tracking-tighter text-white">RUNNER <span className="text-[#C0FF00]">DNA</span></h1>
            </div>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
              Analisi avanzata basata sul tuo intero storico corse. Questo motore AI estrae il tuo profilo fisiologico e biomeccanico per fornirti l'esatto identikit del tuo potenziale organico.
            </p>
          </div>
          
          <div className="flex gap-4">
             {/* Badge VDOT */}
             <div className="bg-[#111] border border-[#C0FF00]/30 rounded-2xl p-4 min-w-[160px] text-center shadow-[0_0_30px_rgba(192,255,0,0.05)]">
               <div className="text-[10px] text-[#C0FF00] font-black tracking-[0.2em] mb-1">VDOT ATTUALE</div>
               <div className="text-4xl font-black text-white">{profile.vdot_current}</div>
             </div>
             {/* Livello Generale */}
             <div className="bg-[#111] border border-white/10 rounded-2xl p-4 min-w-[160px] text-center">
               <div className="text-[10px] text-gray-500 font-black tracking-[0.2em] mb-1">LIVELLO ATLETA</div>
               <div className="text-2xl font-bold text-white uppercase mt-1">{profile.level}</div>
             </div>
          </div>
        </div>

        {/* BENTO GRID LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

          {/* 1. Profilo Biometrico (Main Card) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-gradient-to-br from-[#111] to-[#0A0A0A] border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#C0FF00]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 group-hover:bg-[#C0FF00]/20 transition-all duration-700"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#C0FF00] mb-4">
                  <BrainCircuit className="w-5 h-5" />
                  <span className="text-xs font-black tracking-[0.2em]">CLASSIFICAZIONE AI</span>
                </div>
                <h3 className="text-5xl font-black text-white leading-none uppercase tracking-tighter">{profile.type}</h3>
                <p className="text-gray-400 mt-4 max-w-sm">
                  Questa classificazione si basa sull'equilibrio numerico tra le tue sessioni lattacide, corse di recupero e volumi su distanza. Il tuo profilo è altamente orientato verso questo fenotipo.
                </p>
              </div>
              
              <div className="mt-8 flex gap-8">
                <div>
                  <div className="text-xs text-gray-500 font-black tracking-widest mb-1">DISTANZA IDEALE</div>
                  <div className="text-xl font-bold text-white">{potential.ideal_distance}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-black tracking-widest mb-1">KM TOTALI ANALIZZATI</div>
                  <div className="text-xl font-bold text-white">{performance.total_km} km</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Efficienza Biomeccanica */}
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-white/20 transition-colors">
            <div>
               <div className="flex items-center gap-2 text-rose-500 mb-4">
                 <Zap className="w-4 h-4" />
                 <span className="text-xs font-black tracking-[0.2em]">EFFICIENZA AEROBICA</span>
               </div>
               <div className="text-4xl font-black text-white">{efficiency.score_pct}<span className="text-xl text-gray-500">%</span></div>
               <p className="text-sm font-bold text-white mt-1 uppercase">{efficiency.label}</p>
            </div>
            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
              Il rapporto m/min per battito cardiaco. Verifica la tua capacità di generare movimento minimizzando lo sforzo cardiaco.
            </p>
          </div>

          {/* 3. Costanza (Consistency) */}
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 flex flex-col justify-between hover:border-white/20 transition-colors">
            <div>
               <div className="flex items-center gap-2 text-blue-500 mb-4">
                 <CalendarDays className="w-4 h-4" />
                 <span className="text-xs font-black tracking-[0.2em]">CONSISTENZA</span>
               </div>
               <div className="text-4xl font-black text-white">{consistency.score_pct}<span className="text-xl text-gray-500">%</span></div>
               <p className="text-sm font-bold text-white mt-1 uppercase">{consistency.label}</p>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-4">
               <div>
                  <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">FREQUENZA MEDIA</div>
                  <div className="text-lg font-bold text-white">{consistency.runs_per_week} <span className="text-xs font-normal text-gray-500">run/set</span></div>
               </div>
            </div>
          </div>

          {/* 4. Statistiche Aggregate Details */}
          <div className="col-span-1 md:col-span-2 bg-[#111] border border-white/10 rounded-3xl p-6 relative">
             <div className="flex items-center gap-2 text-gray-400 mb-6">
                 <BarChart className="w-4 h-4" />
                 <span className="text-xs font-black tracking-[0.2em]">METRICHE CORE AGGREGATE</span>
             </div>
             
             <div className="grid grid-cols-3 gap-6">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">PASSO MEDIO (ALL TIME)</div>
                  <div className="text-3xl font-black text-white">{stats.avg_pace}<span className="text-sm font-normal text-gray-500 ml-1">/km</span></div>
                </div>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">BATTITI MEDI</div>
                  <div className="text-3xl font-black text-white">{stats.avg_hr}<span className="text-sm font-normal text-gray-500 ml-1">bpm</span></div>
                </div>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5">
                  <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">CADENZA MEDIA</div>
                  <div className="text-3xl font-black text-white">{stats.avg_cadence}<span className="text-sm font-normal text-gray-500 ml-1">spm</span></div>
                </div>
             </div>

             {/* Zone Distrib */}
             <div className="mt-8">
               <div className="text-[10px] text-gray-500 font-black tracking-widest mb-3">DISTRIBUZIONE ZONE CARDIACHE FISIOLOGICHE</div>
               <div className="flex h-3 rounded-full overflow-hidden">
                 <div style={{ width: `${stats.zone_distribution.z1}%` }} className="bg-gray-400" title={`Z1: ${stats.zone_distribution.z1}%`}></div>
                 <div style={{ width: `${stats.zone_distribution.z2}%` }} className="bg-blue-400" title={`Z2: ${stats.zone_distribution.z2}%`}></div>
                 <div style={{ width: `${stats.zone_distribution.z3}%` }} className="bg-emerald-400" title={`Z3: ${stats.zone_distribution.z3}%`}></div>
                 <div style={{ width: `${stats.zone_distribution.z4}%` }} className="bg-amber-400" title={`Z4: ${stats.zone_distribution.z4}%`}></div>
                 <div style={{ width: `${stats.zone_distribution.z5}%` }} className="bg-rose-500" title={`Z5: ${stats.zone_distribution.z5}%`}></div>
               </div>
               <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-black">
                 <span>Z1 (Recovery)</span>
                 <span>Z2 (Easy)</span>
                 <span>Z3 (Tempo)</span>
                 <span>Z4 (Threshold)</span>
                 <span>Z5 (VO2max)</span>
               </div>
             </div>
          </div>

          {/* 5. Performance Trend & Stato */}
          <div className="col-span-1 md:col-span-2 bg-[#111] border border-white/10 rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-indigo-400 mb-6">
                 <TrendingUp className="w-4 h-4" />
                 <span className="text-xs font-black tracking-[0.2em]">TREND DI PERFORMANCE E STATO</span>
             </div>

             <div className="grid grid-cols-2 gap-8 h-full">
               <div className="flex flex-col justify-center">
                 <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">TREND STORICO</div>
                 <div className={`text-2xl font-black uppercase ${performance.trend_status.includes('Crescita') || performance.trend_status.includes('Progressione') ? 'text-[#C0FF00]' : 'text-white'}`}>
                   {performance.trend_status}
                 </div>
                 <p className="text-xs text-gray-500 mt-2">Variazione VDOT rilevata rispetto alle origini storiche.</p>
               </div>

               <div className="flex flex-col justify-center border-l border-white/5 pl-8">
                 <div className="text-[10px] text-gray-500 font-black tracking-widest mb-1">STATO DI FORMA ATTUALE</div>
                 <div className="text-2xl font-black text-white uppercase">{current_state.form_label}</div>
                 <div className="text-xs text-gray-500 mt-2">CTL Attuale: <span className="text-white font-bold">{current_state.fitness_ctl}</span></div>
               </div>
             </div>
          </div>

          {/* 6. Potenziale Biologico (Full Width Bottom) */}
          <div className="col-span-1 md:col-span-3 lg:col-span-4 bg-gradient-to-r from-black to-[#0a0a0a] border border-[#C0FF00]/20 rounded-3xl p-8 relative overflow-hidden group">
            <div className="flex flex-col lg:flex-row gap-12 items-center justify-between z-10 relative">
              
              <div className="lg:w-1/3">
                 <div className="flex items-center gap-2 text-[#C0FF00] mb-4">
                   <Target className="w-5 h-5" />
                   <span className="text-xs font-black tracking-[0.2em]">POTENZIALE BIOLOGICO ASSOLUTO</span>
                 </div>
                 <p className="text-gray-400 text-sm leading-relaxed mb-6">
                   Il motore di AI ha calcolato il tuo tetto massimo teorico (VDOT Ceiling). Questo valore incrocia la tua base cardiovascolare con l'età e l'efficienza biomeccanica attuale. Se ottimizzi la costanza e l'allenamento, questi sono i tempi elitari che il tuo DNA ti consente potenzialmente di raggiungere.
                 </p>
                 <div className="bg-[#C0FF00]/10 border border-[#C0FF00]/30 rounded-xl p-4 inline-block">
                   <div className="text-[10px] text-[#C0FF00] font-black tracking-[0.2em] mb-1">VDOT CEILING MAX</div>
                   <div className="text-5xl font-black text-[#C0FF00]">{potential.vdot_ceiling}</div>
                 </div>
              </div>

               <div className="lg:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  {Object.entries(potential.predictions || {}).map(([dist, time]) => (
                    <div key={dist} className="bg-black/60 border border-white/10 rounded-2xl p-5 text-center hover:border-[#C0FF00]/50 transition-colors">
                      <div className="text-[10px] text-gray-500 font-black tracking-[0.2em] mb-2 uppercase">{dist}</div>
                      <div className="text-2xl font-black text-white">{time as string}</div>
                    </div>
                  ))}
               </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
