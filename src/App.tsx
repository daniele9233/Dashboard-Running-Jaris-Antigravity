/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { JarvisProvider, useJarvisContext } from "./context/JarvisContext";
import { LayoutProvider } from "./context/LayoutContext";
import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SettingsControls } from "./components/SettingsControls";

// Route-level code splitting: ogni view è un chunk separato (Suspense gestisce loading).
// I componenti usano named export → wrap con .then per estrarre il named come default.
const DashboardView  = lazy(() => import("./components/DashboardView").then((m) => ({ default: m.DashboardView })));
const TrainingView   = lazy(() => import("./components/TrainingView").then((m) => ({ default: m.TrainingView })));
const ProfileView    = lazy(() => import("./components/ProfileView").then((m) => ({ default: m.ProfileView })));
const StatisticsView = lazy(() => import("./components/statistics/StatisticsView").then((m) => ({ default: m.StatisticsView })));
const RoutesView     = lazy(() => import("./components/RoutesView").then((m) => ({ default: m.RoutesView })));
const ActivitiesView = lazy(() => import("./components/ActivitiesView").then((m) => ({ default: m.ActivitiesView })));
const RunnerDnaView  = lazy(() => import("./components/RunnerDnaView").then((m) => ({ default: m.RunnerDnaView })));
const RankingView    = lazy(() => import("./components/RankingView").then((m) => ({ default: m.RankingView })));
import { useParams } from "react-router-dom";
import { exchangeStravaCode, syncStrava, getProfile } from "./api";
import { invalidateCache, useApi } from "./hooks/useApi";
import { API_CACHE } from "./hooks/apiCacheKeys";
import { useServerEvents } from "./hooks/useServerEvents";

/** Iniziali da nome utente: "Daniele Pasco" → "DP". Fallback "ML". */
function deriveInitials(name?: string | null): string {
  if (!name) return "ML";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "ML";
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  return initials || "ML";
}

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

  // Profile per avatar dinamico (cache-shared con tutti gli altri view).
  const { data: profile } = useApi(getProfile, { cacheKey: API_CACHE.PROFILE });
  const profileName = (profile as { name?: string } | null)?.name ?? null;
  const initials = deriveInitials(profileName);

  // SSE: ricevi push dal backend (sync_complete / training_adapted) e
  // auto-invalida le cache. Niente F5 dopo sync.
  useServerEvents();

  const NAV_ITEMS = [
    { path: "/",            label: t("nav.dashboard")  },
    { path: "/training",    label: t("nav.training")   },
    { path: "/activities",  label: t("nav.activities") },
    { path: "/statistics",  label: t("nav.statistics") },
    { path: "/runner-dna",  label: t("nav.runnerDna")  },
    { path: "/ranking",     label: t("nav.ranking")    },
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
        .then(() => {
          // Strava OAuth + sync done → drop everything that depends on runs
          invalidateCache(API_CACHE.PROFILE);
          invalidateCache(API_CACHE.RUNS);
          invalidateCache(API_CACHE.DASHBOARD);
          invalidateCache(API_CACHE.ANALYTICS);
          invalidateCache(API_CACHE.BEST_EFFORTS);
          invalidateCache(API_CACHE.HEATMAP);
          invalidateCache(API_CACHE.SUPERCOMPENSATION);
          navigate("/activities");
        })
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
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Bar */}
        <header
          className="h-16 border-b flex items-center justify-between px-4 md:px-8 z-40 gap-2"
          style={{
            borderColor: "var(--app-border)",
            backgroundColor: "var(--app-bg-alt)",
          }}
        >
          <div className="flex items-center gap-4 md:gap-8 min-w-0 flex-1 pl-12 md:pl-0">
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <span className="text-xl font-black italic tracking-tighter" style={{ color: "var(--app-accent)" }}>METIC LAB</span>
            </div>
            <nav className="flex items-center gap-3 md:gap-5 overflow-x-auto whitespace-nowrap scrollbar-hide" aria-label="Navigazione principale">
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
            {/* Language + Theme controls */}
            <SettingsControls />

            <div className="flex items-center gap-4">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 border flex items-center justify-center shrink-0"
                style={{ borderColor: "var(--app-border-strong)" }}
                title={profileName ?? "Metic Lab"}
                aria-label={profileName ? `Profilo ${profileName}` : "Profilo utente"}
              >
                <span className="text-[10px] font-black text-white select-none">{initials}</span>
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
                <Route path="/ranking"          element={<RankingView />} />
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
