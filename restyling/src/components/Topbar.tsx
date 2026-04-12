import React from 'react';
import { Bell, Search, Settings, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

export function Topbar() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="h-20 flex items-center justify-between px-8 border-b border-gray-200 dark:border-[#222] bg-white dark:bg-[#0f0f0f] shrink-0 transition-colors">
      <div className="relative w-96">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#888]" size={18} />
        <input 
          type="text" 
          placeholder="Search athletes or data..." 
          className="w-full bg-gray-100 dark:bg-[#1a1a1a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#555] rounded-md py-3 pl-12 pr-4 focus:outline-none focus:ring-1 focus:ring-blue-600 dark:focus:ring-[#ccff00] text-sm transition-colors"
        />
      </div>

      <div className="flex items-center gap-6">
        <button onClick={toggleTheme} className="text-gray-500 dark:text-[#888] hover:text-gray-900 dark:hover:text-white transition-colors">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="text-gray-500 dark:text-[#888] hover:text-gray-900 dark:hover:text-white transition-colors">
          <Bell size={20} />
        </button>
        <button className="text-gray-500 dark:text-[#888] hover:text-gray-900 dark:hover:text-white transition-colors">
          <Settings size={20} />
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-200 dark:border-[#222]">
          <div className="text-right">
            <div className="text-gray-900 dark:text-white font-semibold text-sm">Marcus Thorne</div>
            <div className="text-gray-500 dark:text-[#888] text-[10px] font-bold tracking-widest">ELITE TIER</div>
          </div>
          <img 
            src="https://i.pravatar.cc/150?u=marcus" 
            alt="Marcus Thorne" 
            className="w-10 h-10 rounded-full border border-gray-200 dark:border-[#333]"
          />
        </div>
      </div>
    </div>
  );
}
