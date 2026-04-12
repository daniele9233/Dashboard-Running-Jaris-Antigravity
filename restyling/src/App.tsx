import React from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './components/Dashboard';
import { ThemeProvider } from './components/ThemeContext';

function AppContent() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#0f0f0f] text-gray-900 dark:text-white overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          <Dashboard />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
