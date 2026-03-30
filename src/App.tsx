/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { JarvisOverlay } from "./components/JarvisOverlay";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./components/DashboardView";
import { TrainingView } from "./components/TrainingView";
import { ProfileView } from "./components/ProfileView";
import { StatisticsView } from "./components/statistics/StatisticsView";
import { RoutesView } from "./components/RoutesView";
import { ActivitiesView } from "./components/ActivitiesView";
import { RunnerDnaView } from "./components/RunnerDnaView";
import { Search, Bell, Settings } from "lucide-react";
import { useParams } from "react-router-dom";
import { exchangeStravaCode, syncStrava } from "./api";

// Wrapper per passare runId da URL params a RoutesView
function RoutesViewWrapper() {
  const { runId } = useParams<{ runId: string }>();
  return <RoutesView runId={runId ?? null} />;
}

// View placeholder per sezioni non ancora implementate
function ComingSoonView({ label }: { label: string }) {
  return (
    <main className="flex-1 flex items-center justify-center text-gray-500">
      <p className="text-sm font-black uppercase tracking-widest">{label} — Coming Soon</p>
    </main>
  );
}

const NAV_ITEMS = [
  { path: "/",            label: "DASHBOARD"  },
  { path: "/training",    label: "TRAINING"   },
  { path: "/activities",  label: "ACTIVITIES" },
  { path: "/statistics",  label: "STATISTICS" },
  { path: "/runner-dna",  label: "RUNNER DNA" },
  { path: "/profile",     label: "PROFILE"    },
];

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Strava OAuth callback: exchange code and sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaCode = params.get("strava_code");
    if (stravaCode) {
      // Remove the query param from the URL
      window.history.replaceState({}, "", window.location.pathname);
      exchangeStravaCode(stravaCode)
        .then(() => syncStrava())
        .then(() => navigate("/activities"))
        .catch((err) => console.error("Strava sync failed:", err));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Deriva la view attiva dal primo segmento del path
  const activeSegment = location.pathname.split("/")[1] || "dashboard";

  const isNavActive = (path: string) => {
    const segment = path === "/" ? "dashboard" : path.slice(1);
    return activeSegment === segment;
  };

  return (
    <>
    <JarvisOverlay />
    <div className="w-full h-screen bg-[#050505] flex overflow-hidden text-white font-sans">
      <Sidebar activeView={activeSegment} onViewChange={(id) => navigate(id === "dashboard" ? "/" : `/${id}`)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0A0A0A] z-40">
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black italic tracking-tighter text-[#C0FF00]">METIC LAB</span>
            </div>
            <nav className="flex items-center gap-8">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`text-[10px] font-black tracking-[0.2em] transition-colors ${
                    isNavActive(item.path) ? "text-[#C0FF00]" : "text-gray-500 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-[#C0FF00] transition-colors" />
              <input
                type="text"
                placeholder="Analyze specific route..."
                className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none focus:border-[#C0FF00]/50 w-64 transition-all"
              />
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-500 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#0A0A0A]" />
              </button>
              <button className="text-gray-500 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border border-white/20 flex items-center justify-center overflow-hidden">
                <img src="https://picsum.photos/seed/user/100/100" alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        {/* Route Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <Routes>
            <Route path="/"                 element={<DashboardView />} />
            <Route path="/activities"       element={<ActivitiesView onSelectRun={(id) => navigate(`/activities/${id}`)} />} />
            <Route path="/activities/:runId" element={<RoutesViewWrapper />} />
            <Route path="/training"         element={<TrainingView />} />
            <Route path="/runner-dna"       element={<RunnerDnaView />} />
            <Route path="/statistics"       element={<StatisticsView />} />
            <Route path="/profile"          element={<ProfileView />} />
            <Route path="/recovery"         element={<ComingSoonView label="Recovery" />} />
            <Route path="/biometrics"       element={<ComingSoonView label="Biometrics" />} />
            <Route path="/insights"         element={<ComingSoonView label="Insights" />} />
            <Route path="*"                 element={<ComingSoonView label="Page not found" />} />
          </Routes>
        </div>
      </div>
    </div>
    </>
  );
}
