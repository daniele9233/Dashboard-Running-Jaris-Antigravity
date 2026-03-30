import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FlaskConical, Zap, Flame, Dna, Calendar, Star, Briefcase, TrendingUp, BarChart2 } from 'lucide-react';

const futureData = [
  { date: 'Oggi', condizione: 18, affaticamento: 15, forma: 3 },
  { date: '29/3', condizione: 17, affaticamento: 10, forma: 7 },
  { date: '1/4', condizione: 16, affaticamento: 5, forma: 11 }, // Picco
  { date: '4/4', condizione: 15, affaticamento: 3, forma: 12 },
  { date: '7/4', condizione: 14, affaticamento: 2, forma: 12 },
  { date: '9/4', condizione: 13, affaticamento: 1, forma: 12 },
];

export function StatsCalc() {
  return (
    <div className="pb-20">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column (Charts & Portfolio) */}
        <div className="xl:col-span-2 space-y-6">
          {/* GRAFICO DEL FUTURO */}
          <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
              <span className="text-lg font-bold text-white">Grafico del Futuro</span>
            </div>
            <div className="text-xs text-gray-500 mb-6">Come evolverà la tua forma nei prossimi 14 giorni</div>
            
            <div className="h-80 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={futureData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis hide domain={[0, 25]} />
                  <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2A2A2A', color: '#E2E8F0', borderRadius: '12px' }} />
                  <ReferenceLine x="Oggi" stroke="#10B981" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="condizione" stroke="#EAB308" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="affaticamento" stroke="#64748B" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="forma" stroke="#10B981" strokeWidth={3} dot={(props: any) => {
                    if (props.payload.date === '1/4') {
                      return <circle key={props.key} cx={props.cx} cy={props.cy} r={6} fill="#121212" stroke="#10B981" strokeWidth={3} />;
                    }
                    return <circle key={props.key} cx={props.cx} cy={props.cy} r={0} fill="none" />;
                  }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 bg-[#EAB308]/20 text-[#EAB308] px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <Star className="w-3 h-3" /> PICCO 1 Apr
              </div>
            </div>
            
            <div className="flex justify-center gap-6 mt-4 text-xs">
              <span className="flex items-center gap-2 text-gray-400"><div className="w-3 h-1 bg-[#EAB308] rounded-full"></div> Condizione</span>
              <span className="flex items-center gap-2 text-gray-400"><div className="w-3 h-1 bg-[#64748B] rounded-full"></div> Affaticamento</span>
              <span className="flex items-center gap-2 text-gray-400"><div className="w-3 h-1 bg-[#10B981] rounded-full"></div> Forma</span>
            </div>

            <div className="mt-6 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#F43F5E]" />
                <span className="font-bold text-white">Il tuo corpo sta caricando energia!</span>
              </div>
              <p className="text-sm text-gray-400">
                Gli allenamenti recenti stanno maturando. Vedrai il picco di forma il 1 Apr. Continua a riposarti per massimizzare i benefici.
              </p>
            </div>
          </div>

          {/* PORTAFOGLIO BIOLOGICO */}
          <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-6">
              <Briefcase className="w-5 h-5 text-[#8B5CF6]" />
              <div>
                <div className="text-lg font-bold text-white">Portafoglio Biologico</div>
                <div className="text-xs text-gray-500">Il rendimento dei tuoi investimenti negli ultimi 21 giorni</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-4 px-2">
              <div className="col-span-2">Investimento</div>
              <div className="text-center">Maturazione</div>
              <div className="text-right">Rendimento</div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 w-1/2">
                  <Zap className="w-5 h-5 text-[#EAB308]" />
                  <div>
                    <div className="font-bold text-[#EAB308]">Neuromuscolare</div>
                    <div className="text-xs text-gray-500">0 km</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#EAB308] bg-[#EAB308]/10 px-2 py-1 rounded-lg">3-7 giorni</div>
                <div className="text-xs text-gray-400 text-right w-1/4">Reattività e Potenza</div>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 w-1/2">
                  <Flame className="w-5 h-5 text-[#F43F5E]" />
                  <div>
                    <div className="font-bold text-[#F43F5E]">Metabolico</div>
                    <div className="text-xs text-gray-500">43.4 km</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#F43F5E] bg-[#F43F5E]/10 px-2 py-1 rounded-lg">7-14 giorni</div>
                <div className="text-xs text-gray-400 text-right w-1/4">Efficienza e Soglia</div>
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3 w-1/2">
                  <Dna className="w-5 h-5 text-[#8B5CF6]" />
                  <div>
                    <div className="font-bold text-[#8B5CF6]">Strutturale</div>
                    <div className="text-xs text-gray-500">0 km</div>
                  </div>
                </div>
                <div className="text-xs font-bold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-1 rounded-lg">14-21 giorni</div>
                <div className="text-xs text-gray-400 text-right w-1/4">Capillari e Mitocondri</div>
              </div>
            </div>

            <div className="mt-6 bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex gap-3">
              <BarChart2 className="w-5 h-5 text-[#3B82F6] shrink-0" />
              <p className="text-sm text-gray-400">
                8 allenamenti investiti. Il tuo portafoglio è sbilanciato verso il settore metabolico. Stai lavorando bene sulla soglia e l'efficienza!
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (Explanation & Cash Out) */}
        <div className="space-y-6">
          {/* INVEST & CASH OUT */}
          <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5 text-[#EAB308]" />
              <div>
                <div className="text-lg font-bold text-white">Invest & Cash Out</div>
                <div className="text-xs text-gray-500">Il momento perfetto per dare il massimo</div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-32 h-32 rounded-full border-4 border-[#EAB308] flex flex-col items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,179,8,0.2)] bg-[#121212]">
                <span className="text-4xl font-bold text-[#EAB308]">6</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Giorni</span>
              </div>
              
              <div className="text-center mb-6">
                <div className="text-lg text-white mb-1">Il tuo Golden Day è</div>
                <div className="text-2xl font-bold text-[#EAB308]">Mer 1 Apr</div>
              </div>

              <p className="text-sm text-gray-400 text-center max-w-xs leading-relaxed mb-6">
                Hai accumulato <span className="text-[#10B981] font-bold">43.5 km</span> di potenziale negli ultimi 21 giorni.<br/><br/>
                Il tuo corpo trasformerà questo sforzo in massima potenza tra <span className="text-[#EAB308] font-bold">6 giorni</span>.
              </p>

              <button className="flex items-center gap-2 text-sm font-bold text-[#EAB308] bg-[#EAB308]/10 px-4 py-2 rounded-xl hover:bg-[#EAB308]/20 transition-colors">
                <Calendar className="w-4 h-4" /> Segna il calendario per il tuo Personal Best!
              </button>
            </div>
          </div>

          {/* SUPERCOMPENSAZIONE EXPLANATION */}
          <div className="bg-[#181818] rounded-2xl p-6 border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#10B981]/20 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-[#10B981]" />
              </div>
              <span className="text-lg font-bold text-white">Come funziona?</span>
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Quando ti alleni, il tuo corpo subisce uno <span className="text-[#10B981] font-semibold">stress controllato</span>. Nelle ore e giorni successivi, non si limita a tornare al livello precedente: si ricostruisce <span className="text-[#10B981] font-semibold">più forte di prima</span>.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed mb-6">
              Questo fenomeno si chiama <span className="text-white font-semibold">supercompensazione</span>. I cambiamenti strutturali — nuovi mitocondri, capillari più densi, enzimi più efficienti — richiedono dai <span className="text-[#10B981] font-semibold">10 ai 21 giorni</span> per manifestarsi come performance.
            </p>

            {/* Types of stress */}
            <div className="space-y-3">
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex gap-4">
                <Zap className="w-6 h-6 text-[#EAB308] shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#EAB308]">Neuromuscolare</span>
                    <span className="text-xs text-gray-500">3-7 giorni</span>
                  </div>
                  <p className="text-xs text-gray-400">Sprint, salite, velocità. Il sistema nervoso si adatta rapidamente.</p>
                </div>
              </div>
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex gap-4">
                <Flame className="w-6 h-6 text-[#F43F5E] shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#F43F5E]">Metabolico</span>
                    <span className="text-xs text-gray-500">7-14 giorni</span>
                  </div>
                  <p className="text-xs text-gray-400">Soglia, ripetute, fartlek. Enzimi e mitocondri diventano più efficienti.</p>
                </div>
              </div>
              <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-4 flex gap-4">
                <Dna className="w-6 h-6 text-[#8B5CF6] shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[#8B5CF6]">Strutturale</span>
                    <span className="text-xs text-gray-500">14-21 giorni</span>
                  </div>
                  <p className="text-xs text-gray-400">Lunghi, base aerobica. Nuovi capillari e mitocondri vengono costruiti.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

