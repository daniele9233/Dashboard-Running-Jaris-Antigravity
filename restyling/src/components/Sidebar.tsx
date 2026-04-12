import React from 'react';
import { Activity, BarChart2, Dumbbell, HelpCircle, LogOut, Play, Zap, Trophy, Battery, Watch } from 'lucide-react';

export function Sidebar() {
  return (
    <div className="w-64 bg-white dark:bg-[#141414] h-full flex flex-col border-r border-gray-200 dark:border-[#222] transition-colors shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-blue-600 dark:bg-[#ccff00] p-1.5 rounded text-white dark:text-black transition-colors">
          <Zap size={20} fill="currentColor" />
        </div>
        <div>
          <div className="text-gray-900 dark:text-white font-bold text-xl tracking-tight leading-none">Monolith</div>
          <div className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-semibold tracking-widest mt-1">ELITE PERFORMANCE</div>
        </div>
      </div>

      <nav className="flex-1 mt-6 overflow-y-auto">
        <div className="px-0">
          <a href="#" className="flex items-center gap-4 px-6 py-4 bg-blue-50 dark:bg-[#1a1a1a] border-l-4 border-blue-600 dark:border-[#ccff00] text-blue-600 dark:text-[#ccff00] transition-colors">
            <Activity size={20} />
            <span className="font-semibold text-sm tracking-wide">PERFORMANCE</span>
          </a>
          <a href="#" className="flex items-center gap-4 px-6 py-4 text-gray-500 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white transition-colors">
            <Activity size={20} />
            <span className="font-semibold text-sm tracking-wide">BIOMETRICS</span>
          </a>
          <a href="#" className="flex items-center gap-4 px-6 py-4 text-gray-500 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white transition-colors">
            <Dumbbell size={20} />
            <span className="font-semibold text-sm tracking-wide">TRAINING</span>
          </a>
          <a href="#" className="flex items-center gap-4 px-6 py-4 text-gray-500 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white transition-colors">
            <BarChart2 size={20} />
            <span className="font-semibold text-sm tracking-wide">ANALYTICS</span>
          </a>
        </div>

        {/* Sensors in Sidebar */}
        <div className="px-6 mt-8">
          <div className="flex items-center gap-2 mb-4">
            <Watch className="text-blue-600 dark:text-[#ccff00]" size={16} />
            <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest uppercase">Sensors</span>
          </div>
          
          <div className="space-y-3 bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-lg border border-gray-100 dark:border-[#222] transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Watch size={14} className="text-gray-900 dark:text-white" />
                <span className="text-gray-900 dark:text-white text-xs font-bold">Epix Pro</span>
              </div>
              <span className="text-blue-600 dark:text-[#ccff00] text-[10px] font-bold tracking-widest">CONNECTED</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-gray-900 dark:text-white" />
                <span className="text-gray-900 dark:text-white text-xs font-bold">HRM-Pro</span>
              </div>
              <div className="flex items-center gap-1">
                <Battery size={12} className="text-gray-500 dark:text-[#A0A0A0]" />
                <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold">84%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hall of Fame in Sidebar */}
        <div className="px-6 mt-8">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="text-blue-600 dark:text-[#ccff00]" size={16} />
            <span className="text-gray-500 dark:text-[#A0A0A0] text-[10px] font-bold tracking-widest uppercase">Hall of Fame</span>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-[#222]">
              <span className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold">5K</span>
              <span className="text-gray-900 dark:text-white font-bold">16:42</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-[#222]">
              <span className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold">10K</span>
              <span className="text-gray-900 dark:text-white font-bold">34:18</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-[#A0A0A0] text-xs font-bold">HM</span>
              <span className="text-gray-900 dark:text-white font-bold">1:15:02</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-6 space-y-6">
        <button className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-[#ccff00] dark:hover:bg-[#b3e600] text-white dark:text-black font-bold py-4 px-4 rounded flex items-center justify-center gap-2 transition-colors">
          <Play size={16} fill="currentColor" />
          <span className="text-sm tracking-wide">START SESSION</span>
        </button>
        
        <div className="space-y-4">
          <a href="#" className="flex items-center gap-4 text-gray-500 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white transition-colors">
            <HelpCircle size={18} />
            <span className="font-semibold text-xs tracking-wide">SUPPORT</span>
          </a>
          <a href="#" className="flex items-center gap-4 text-gray-500 dark:text-[#A0A0A0] hover:text-gray-900 dark:hover:text-white transition-colors">
            <LogOut size={18} />
            <span className="font-semibold text-xs tracking-wide">SIGN OUT</span>
          </a>
        </div>
      </div>
    </div>
  );
}
