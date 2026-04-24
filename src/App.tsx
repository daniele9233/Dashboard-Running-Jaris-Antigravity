/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { JarvisProvider, useJarvisContext } from "./context/JarvisContext";
import { LayoutProvider } from "./context/LayoutContext";
import { Sidebar } from "./components/Sidebar";
import { DashboardView } from "./components/DashboardView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TrainingView } from "./components/TrainingView";
import { ProfileView } from "./components/ProfileView";
import { StatisticsView } from "./components/statistics/StatisticsView";
import { RoutesView } from "./components/RoutesView";
import { ActivitiesView } from "./components/ActivitiesView";
import { RunnerDnaView } from "./components/RunnerDnaView";
import { SettingsControls } from "./components/SettingsControls";
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
  const { t } = useTranslation();
  return (
    <main className="flex-1 flex items-center justify-center" style={{ color: "var(--app-text-dim)" }}>
      <p className="text-sm font-black uppercase tracking-widest">{label} — {t("common.comingSoon")}</p>
    </main>
  );
}

function AppContent() {
  const { JarvisPortal } = useJarvisContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const NAV_ITEMS = [
    { path: "/",            label: t("nav.dashboard")  },
    { path: "/training",    label: t("nav.training")   },
    { path: "/activities",  label: t("nav.activities") },
    { path: "/statistics",  label: t("nav.statistics") },
    { path: "/runner-dna",  label: t("nav.runnerDna")  },
    { path: "/profile",     label: t("nav.profile")    },
  ];

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
    {JarvisPortal}
    <div
      className="w-full h-screen flex overflow-hidden font-sans"
      style={{ backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
    >
      <Sidebar activeView={activeSegment} onViewChange={(id) => navigate(id === "dashboard" ? "/" : `/${id}`)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header
          className="h-16 border-b flex items-center justify-between px-8 z-40"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-bg-alt)",
          }}
        >
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black italic tracking-tighter" style={{ color: "var(--app-accent)" }}>METIC LAB</span>
            </div>
            <nav className="flex items-center gap-5">
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className="text-[10px] font-black tracking-[0.2em] transition-colors"
                    style={{ color: active ? "var(--app-accent)" : "var(--app-text-dim)" }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--app-text)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--app-text-dim)"; }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative group">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors"
                style={{ color: "var(--app-text-dim)" }}
              />
              <input
                type="text"
                placeholder={t("header.search")}
                className="border rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:outline-none w-56 transition-all"
                style={{
                  backgroundColor: "var(--app-input-bg)",
                  borderColor: "var(--app-border)",
                  color: "var(--app-text)",
                }}
              />
            </div>

            {/* Language + Theme controls */}
            <SettingsControls />

            <div className="flex items-center gap-4">
              <button
                className="transition-colors relative"
                style={{ color: "var(--app-text-dim)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-text-dim)")}
              >
                <Bell className="w-5 h-5" />
                <div
                  className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full border-2"
                  style={{ borderColor: "var(--app-bg-alt)" }}
                />
              </button>
              <button
                className="transition-colors"
                style={{ color: "var(--app-text-dim)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-text)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-text-dim)")}
              >
                <Settings className="w-5 h-5" />
              </button>
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border flex items-center justify-center overflow-hidden"
                style={{ borderColor: "var(--app-border-strong)" }}
              >
                <img src="https://picsum.photos/seed/user/100/100" alt="Profile" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        {/* Route Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center">
                <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: "var(--app-accent)", borderTopColor: "transparent" }} />
              </div>
            }>
              <Routes>
                <Route path="/"                 element={<DashboardView />} />
                <Route path="/activities"       element={<ActivitiesView onSelectRun={(id) => navigate(`/activities/${id}`)} />} />
                <Route path="/activities/:runId" element={<RoutesViewWrapper />} />
                <Route path="/training"         element={<TrainingView />} />
                <Route path="/runner-dna"       element={<RunnerDnaView />} />
                <Route path="/runner-dna-v2"    element={<Navigate to="/runner-dna" replace />} />
                <Route path="/statistics"       element={<StatisticsView />} />
                <Route path="/profile"          element={<ProfileView />} />
                <Route path="/recovery"         element={<ComingSoonView label="Recovery" />} />
                <Route path="/biometrics"       element={<ComingSoonView label="Biometrics" />} />
                <Route path="/insights"         element={<ComingSoonView label="Insights" />} />
                <Route path="*"                 element={<ComingSoonView label={t("common.pageNotFound")} />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
    </>
  );
}

export default function App() {
  return (
    <LayoutProvider>
      <JarvisProvider>
        <AppContent />
      </JarvisProvider>
    </LayoutProvider>
  );
}
