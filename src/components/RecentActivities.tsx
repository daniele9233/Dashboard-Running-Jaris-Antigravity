import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Footprints, Timer, HeartPulse, MapPin, Zap, TrendingUp, ChevronRight } from "lucide-react";
import type { Run } from "../types/api";

interface RecentActivitiesProps {
  runs: Run[];
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function getRunStyle(runType: string) {
  const t = (runType || "").toLowerCase();
  if (t.includes("interval") || t.includes("speed") || t.includes("fartlek") || t.includes("ripetute"))
    return { Icon: Zap, bg: "bg-[#F59E0B]/10", color: "text-[#F59E0B]", label: "Intervals" };
  if (t.includes("tempo") || t.includes("threshold") || t.includes("soglia"))
    return { Icon: Timer, bg: "bg-[#3B82F6]/10", color: "text-[#3B82F6]", label: "Tempo" };
  if (t.includes("long") || t.includes("lun") || t.includes("fondo lungo"))
    return { Icon: MapPin, bg: "bg-[#F43F5E]/10", color: "text-[#F43F5E]", label: "Long Run" };
  if (t.includes("recov") || t.includes("rigene"))
    return { Icon: HeartPulse, bg: "bg-[#8B5CF6]/10", color: "text-[#8B5CF6]", label: "Recovery" };
  if (t.includes("race") || t.includes("gara") || t.includes("compet"))
    return { Icon: TrendingUp, bg: "bg-[#EC4899]/10", color: "text-[#EC4899]", label: "Race" };
  return { Icon: Footprints, bg: "bg-[#14B8A6]/10", color: "text-[#14B8A6]", label: "Easy Run" };
}

function formatRunDate(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const day = d.toLocaleDateString("it", { day: "numeric", month: "short" });
  return `${day}, ${h}:${m}`;
}

function getDayLabel(dateStr: string): string {
  const runDate = new Date(dateStr);
  runDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (runDate.getTime() === today.getTime()) return "OGGI";
  if (runDate.getTime() === yesterday.getTime()) return "IERI";
  return runDate
    .toLocaleDateString("it", { day: "numeric", month: "long" })
    .toUpperCase();
}

// ─── Component ──────────────────────────────────────────────────────────────

export function RecentActivities({ runs }: RecentActivitiesProps) {
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const sorted = [...runs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);

    const map = new Map<string, Run[]>();
    for (const run of sorted) {
      const label = getDayLabel(run.date);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(run);
    }

    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [runs]);

  return (
    <div className="bg-bg-card border border-[#1E293B] rounded-xl p-5 flex flex-col h-full">
      <h3 className="text-sm font-medium text-text-primary mb-6">Recent Activities</h3>

      {groups.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
          Nessuna corsa sincronizzata
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <h4 className="text-[10px] font-semibold text-text-muted tracking-wider mb-3 uppercase">
                {group}
              </h4>
              <div className="space-y-3">
                {items.map((run) => {
                  const { Icon, bg, color, label } = getRunStyle(run.run_type);
                  const title = run.location || label;
                  return (
                    <div
                      key={run.id}
                      onClick={() => navigate(`/activities/${run.id}`)}
                      className="flex items-center justify-between group cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate max-w-[120px]">
                            {title}
                          </div>
                          <div className="text-xs text-text-muted">{formatRunDate(run.date)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-sm font-medium text-text-primary">
                            {run.distance_km.toFixed(1)} km
                          </div>
                          <div className="text-xs text-text-muted">{run.avg_pace}/km</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
