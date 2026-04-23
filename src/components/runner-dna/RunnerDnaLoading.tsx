import { motion } from "motion/react";
import { Dna } from "lucide-react";

const steps = [
  "Lettura profilo atleta",
  "Analisi storico Strava",
  "Validazione Garmin Running Dynamics",
  "Calcolo score e distanza ideale",
  "Generazione insight coach",
];

export function RunnerDnaLoading({ label = "Sequenziamento Runner DNA" }: { label?: string }) {
  return (
    <div className="flex-1 overflow-hidden bg-[#050609] text-white">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,255,45,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative flex min-h-full items-center justify-center p-6">
        <div className="w-full max-w-3xl rounded-lg border border-[#C8FF2D]/20 bg-[#080A0E]/90 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
          <div className="grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative mx-auto h-[220px] w-[220px]">
              <motion.div
                className="absolute inset-0 rounded-full border border-[#C8FF2D]/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-5 rounded-full border border-dashed border-cyan-300/30"
                animate={{ rotate: -360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-12 rounded-full bg-[#C8FF2D]/10 blur-xl"
                animate={{ scale: [0.8, 1.08, 0.8], opacity: [0.35, 0.85, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Dna className="h-20 w-20 text-[#C8FF2D]" />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C8FF2D]">
                {label}
              </div>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-tight text-white">
                Analisi in corso
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Sto leggendo i dati reali del tuo profilo, le corse sincronizzate e le metriche Garmin disponibili.
              </p>

              <div className="mt-7 space-y-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={step}
                    className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-4 py-3"
                    initial={{ opacity: 0.35, x: -10 }}
                    animate={{ opacity: [0.35, 1, 0.35], x: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.25 }}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#C8FF2D] shadow-[0_0_14px_rgba(200,255,45,0.8)]" />
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">{step}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
