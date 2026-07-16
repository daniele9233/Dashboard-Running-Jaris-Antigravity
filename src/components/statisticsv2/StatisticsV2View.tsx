import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Radar, Activity, FlaskConical, CloudSun, Dna } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { API_CACHE } from "../../hooks/apiCacheKeys";
import { getRuns, getAnalytics, getVdotPaces, getDashboard, getSupercompensation } from "../../api";
import type {
  RunsResponse, AnalyticsResponse, VdotPacesResponse, DashboardResponse, SupercompensationResponse,
} from "../../types/api";
import { V2 } from "./v2Shared";
import { V2LoadForm, V2PotentialProgress, V2Biomechanics } from "./v2TabsCore";
import { V2BiologyFuture, V2ClimatePace, V2Detraining } from "./v2TabsFuture";

/**
 * STATISTICS V2 — sezione parallela alla v1 (che resta intatta).
 * Stesso set di sottosezioni, linguaggio visivo diverso: bento flat, superfici
 * piatte, hairline borders, label mono uppercase, grafici SVG custom con
 * tooltip ovunque. Palette: lime primaria, arancio secondaria, cyan terziaria.
 */

type V2Tab = "load" | "potential" | "biomech" | "biology" | "climate" | "detraining";

export function StatisticsV2View() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<V2Tab>("load");

  const { data: runsData } = useApi<RunsResponse>(getRuns, { cacheKey: API_CACHE.RUNS });
  const { data: analyticsData } = useApi<AnalyticsResponse>(getAnalytics, { cacheKey: API_CACHE.ANALYTICS });
  const { data: vdotData } = useApi<VdotPacesResponse>(getVdotPaces, { cacheKey: API_CACHE.VDOT_PACES });
  const { data: dashData } = useApi<DashboardResponse>(getDashboard, { cacheKey: API_CACHE.DASHBOARD });
  const { data: superData } = useApi<SupercompensationResponse>(getSupercompensation, { cacheKey: API_CACHE.SUPERCOMPENSATION });

  const runs = useMemo(() => runsData?.runs ?? [], [runsData]);
  const ff = useMemo(() => dashData?.fitness_freshness ?? [], [dashData]);

  const TABS: Array<{ id: V2Tab; label: string; icon: typeof BarChart3 }> = [
    { id: "load", label: t("statsTabs.loadForm"), icon: BarChart3 },
    { id: "potential", label: t("statsTabs.potentialProgress"), icon: Radar },
    { id: "biomech", label: t("statsTabs.biomechanics"), icon: Activity },
    { id: "biology", label: t("statsTabs.biologyFuture"), icon: FlaskConical },
    { id: "climate", label: t("statsTabs.climatePace"), icon: CloudSun },
    { id: "detraining", label: t("statsTabs.detraining"), icon: Dna },
  ];

  return (
    <main className="flex-1 overflow-y-auto min-h-0 custom-scrollbar" style={{ background: V2.bg }}>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 md:py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic" style={{ color: V2.ink }}>
              Statistics <span style={{ color: V2.lime }}>V2</span>
            </h1>
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase mt-2" style={{ color: V2.inkMuted, fontFamily: V2.mono }}>
              Bento analytics · flat surfaces
            </p>
          </div>
        </div>

        {/* Tab bar — underline, scroll orizzontale su mobile */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-6 -mx-1 px-1" style={{ borderBottom: `1px solid ${V2.border}` }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="flex items-center gap-2 px-4 py-3 text-[10px] font-black tracking-[0.14em] uppercase whitespace-nowrap transition-colors"
                style={{
                  color: active ? V2.ink : V2.inkMuted,
                  borderBottom: `2px solid ${active ? V2.lime : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: active ? V2.lime : V2.inkMuted }} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Contenuto tab */}
        {tab === "load" && <V2LoadForm runs={runs} ff={ff} />}
        {tab === "potential" && <V2PotentialProgress runs={runs} analytics={analyticsData} vdotPaces={vdotData} />}
        {tab === "biomech" && <V2Biomechanics runs={runs} />}
        {tab === "biology" && <V2BiologyFuture superData={superData} />}
        {tab === "climate" && <V2ClimatePace runs={runs} analytics={analyticsData} />}
        {tab === "detraining" && <V2Detraining runs={runs} ff={ff} />}
      </div>
    </main>
  );
}
