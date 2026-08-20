import { useState } from "react";
import { TrainingGrid } from "./TrainingGrid";
import { TrainingSidebar } from "./TrainingSidebar";
import { ChevronUp, ChevronDown } from "lucide-react";

export function TrainingView() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#121212] text-white relative">
      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden md:border-r border-[#2A2A2A]">
        <TrainingGrid />
      </div>

      {/* Desktop Sidebar — invariato */}
      <div className="hidden md:block md:w-[350px] flex-shrink-0 overflow-y-auto bg-[#181818]">
        <TrainingSidebar />
      </div>

      {/* Mobile bottom sheet toggle */}
      <button
        type="button"
        onClick={() => setMobileSidebarOpen((v) => !v)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-[#C0FF00] text-black font-black text-[10px] tracking-widest uppercase px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 min-h-[44px]"
        aria-label="Apri pannello training"
      >
        {mobileSidebarOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        {mobileSidebarOpen ? "Chiudi" : "Pannello"}
      </button>

      {/* Mobile bottom sheet */}
      {mobileSidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 max-h-[85vh] overflow-y-auto bg-[#181818] border-t border-[#2A2A2A] rounded-t-3xl shadow-2xl pb-20">
            <div className="sticky top-0 bg-[#181818] border-b border-[#2A2A2A] flex items-center justify-center py-3">
              <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>
            <TrainingSidebar />
          </div>
        </>
      )}
    </div>
  );
}
