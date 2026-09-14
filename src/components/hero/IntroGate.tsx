import { Suspense, useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IntroHero } from "./IntroHero";

/**
 * The hero opens every time the site does, except when the page is an OAuth
 * return (the app has work to do immediately) or `?intro=0` is passed.
 */
function shouldShowIntro() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has("strava_code")) return false;
  if (params.get("intro") === "0") return false;
  return true;
}

/**
 * Holds the app back until the hero's entrance has played, so dashboard data
 * and rendering never compete with the choreography. The wrapper element stays
 * the same across phases — only `inert` flips — so the app never remounts.
 */
export function IntroGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(shouldShowIntro);
  const [appMounted, setAppMounted] = useState(() => !showIntro);

  const reveal = useCallback(() => setAppMounted(true), []);
  const finish = useCallback(() => setShowIntro(false), []);
  const route = useCallback((to: string) => navigate(to), [navigate]);

  return (
    <>
      <div className="contents" inert={showIntro}>
        {appMounted ? <Suspense fallback={null}>{children}</Suspense> : null}
      </div>
      {showIntro && <IntroHero onReveal={reveal} onFinish={finish} onRoute={route} />}
    </>
  );
}
