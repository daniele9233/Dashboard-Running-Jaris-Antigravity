/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, Suspense, lazy } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { JarvisProvider, useJarvisContext } from "./context/JarvisContext";
import { LayoutProvider } from "./context/LayoutContext";
import { Sidebar } from "./components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SettingsControls } from "./components/SettingsControls";
import { useNavItems, isNavActive, centerInStrip } from "./navigation";

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
const BadgesView     = lazy(() => import("./components/BadgesView").then((m) => ({ default: m.BadgesView })));
const GamificationV1 = lazy(() => import("./components/gamification/GamificationV1").then((m) => ({ default: m.GamificationV1 })));
const RaceLabView = lazy(() => import("./components/racelab/RaceLabView").then((m) => ({ default: m.RaceLabView })));
import { useParams } from "react-router-dom";
import { exchangeStravaCode, syncStrava, getProfile } from "./api";
import { invalidateCache, useApi } from "./hooks/useApi";
import { API_CACHE } from "./hooks/apiCacheKeys";
import { useServerEvents } from "./hooks/useServerEvents";
import { BadgeProvider, useBadges } from "./components/celebrations/BadgeProvider";

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

  const { evaluateAfterSync } = useBadges();

  const NAV_ITEMS = useNavItems();

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
          // Valuta i badge sui run appena sincronizzati (post-baseline)
          evaluateAfterSync().catch(() => {});
        })
        .catch((err) => console.error("Strava sync failed:", err));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * La voce attiva deve essere sempre in vista. Sulla striscia orizzontale di
   * telefono e tablet stare su /ranking e vedere solo DASHBOARD · TRAINING ·
   * ATTIVITÀ vuol dire non sapere dove si è.
   */
  const navStripRef = useRef<HTMLElement | null>(null);
  const activeNavRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    centerInStrip(navStripRef.current, activeNavRef.current);
  }, [location.pathname]);

  // la sfumatura sul bordo compare solo se la striscia trabocca davvero:
  // su uno schermo largo abbastanza non deve sbiadire l'ultima voce
  const [navOverflows, setNavOverflows] = useState(false);
  useEffect(() => {
    const el = navStripRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => setNavOverflows(el.scrollWidth > el.clientWidth + 2);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  }, []);

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
          <div className="flex items-center gap-4 md:gap-8 min-w-0 flex-1 pl-12 lg:pl-0">
            {/* il nome del prodotto sta già nella sidebar, accanto al logo: in
                testata era un doppione da 110px che spingeva fuori la nav */}
            <nav
              ref={navStripRef}
              className={`flex items-center gap-3 md:gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide ${navOverflows ? "[mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] pr-8" : ""}`}
              aria-label="Navigazione principale"
            >
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(location.pathname, item.path);
                return (
                  <button
                    key={item.path}
                    ref={active ? activeNavRef : undefined}
                    aria-current={active ? "page" : undefined}
                    onClick={() => navigate(item.path)}
                    className="text-[10px] font-black tracking-[0.16em] transition-colors py-3 px-1 min-h-[44px] flex items-center"
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

          <div className="flex items-center gap-3 md:gap-5 shrink-0">
            {/* Language + Theme controls */}
            <SettingsControls />

            <div className="flex items-center gap-4">
              <div
                className="w-8 h-8 rounded-full bg-surface-2 border border-line-strong flex items-center justify-center shrink-0"
                title={profileName ?? "Metic Lab"}
                aria-label={profileName ? `Profilo ${profileName}` : "Profilo utente"}
              >
                <span className="text-[11px] font-black text-brand select-none">{initials}</span>
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
                <Route path="/runner-dna-v1"    element={<Navigate to="/runner-dna" replace />} />
                <Route path="/runner-dna-v2"    element={<Navigate to="/runner-dna" replace />} />
                <Route path="/ranking"          element={<RankingView />} />
                <Route path="/badges"           element={<BadgesView />} />
                <Route path="/gamification-v1"  element={<GamificationV1 />} />
                <Route path="/gamification-v3"  element={<Navigate to="/gamification-v1" replace />} />
                <Route path="/race-lab"         element={<RaceLabView />} />
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
        <BadgeProvider>
          <AppContent />
        </BadgeProvider>
      </JarvisProvider>
    </LayoutProvider>
  );
}
