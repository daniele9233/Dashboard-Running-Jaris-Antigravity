import { Medal } from "lucide-react";
import { CelebrationStudio } from "./celebrations/CelebrationStudio";

/**
 * BadgesView — pagina dedicata ai badge (estratta dal tab Badge di Statistics).
 *
 * Stesso linguaggio visivo athlete-card di RankingView: base #0A0A0A,
 * header nero/lime, contenuto = Celebration Studio (le 100 celebrazioni).
 */
export function BadgesView() {
  return (
    <main className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white p-4 md:p-6 lg:p-10 min-h-0 custom-scrollbar">
      <div className="max-w-[1500px] mx-auto space-y-5 md:space-y-6">
        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-white uppercase italic">
              I Miei <span className="text-[#C0FF00]">Badge</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-black tracking-[0.3em] uppercase mt-2">
              Traguardi sbloccati con le performance reali
            </p>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Medal className="w-5 h-5 text-[#C0FF00]" />
            <span className="text-[10px] font-black tracking-[0.25em] uppercase">Hall of Fame</span>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-5 md:space-y-6">
          <CelebrationStudio />
        </div>
      </div>
    </main>
  );
}
