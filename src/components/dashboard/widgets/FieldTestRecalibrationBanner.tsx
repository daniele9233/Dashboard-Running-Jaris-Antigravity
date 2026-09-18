import { useEffect, useState } from "react";
import { AlertTriangle, X, Target } from "lucide-react";
import type { FieldTestDivergenceResponse } from "../../../types/api";
import { getFieldTestDivergence } from "../../../api";

/**
 * FieldTestRecalibrationBanner — top dashboard banner.
 *
 * Smart detection: mostra alert se zone obsolete (no_test, stale, divergence).
 * Click "REGISTRA NUOVO FIELD TEST" → scrolla a FieldTestWidget.
 * Click X → dismiss in session (riappare al refresh).
 *
 * No auto-recalc VDOT: utente sempre in controllo.
 */
export function FieldTestRecalibrationBanner() {
  const [data, setData] = useState<FieldTestDivergenceResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getFieldTestDivergence().then(setData).catch(() => setData(null));
  }, []);

  if (!data || !data.needs_recalibration || dismissed) return null;

  const scrollToFieldTest = () => {
    const el = document.querySelector('[data-grid-key="field-test"]');
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // Fallback: scroll to bottom dove sta widget
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  // Color/intensity per reason
  const palette =
    data.reason === "no_test"
      ? { color: "#C0FF00", bg: "rgba(192,255,0,0.08)", border: "rgba(192,255,0,0.3)" }
      : data.reason === "stale"
      ? { color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)" }
      : { color: "#60A5FA", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.3)" };

  return (
    <div
      className="rounded-[16px] backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] p-4 mb-4 flex items-start gap-3"
      style={{
        background: `linear-gradient(to right, ${palette.bg}, rgba(0,0,0,0.4))`,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div
        className="rounded-[12px] p-2 shrink-0"
        style={{ background: `${palette.color}22` }}
      >
        {data.reason === "no_test" ? (
          <Target size={18} style={{ color: palette.color }} />
        ) : (
          <AlertTriangle size={18} style={{ color: palette.color }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] font-black tracking-widest uppercase mb-1"
          style={{ color: palette.color }}
        >
          {data.reason === "no_test" && "BENCHMARK MANCANTE"}
          {data.reason === "stale" && "ZONE OBSOLETE"}
          {data.reason === "divergence" && "FITNESS MIGLIORATA"}
        </div>
        <div className="text-white text-[13px] font-bold leading-snug">
          {data.message}
        </div>
        {data.evidence.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.evidence.slice(0, 3).map((ev, i) => (
              <div
                key={i}
                className="text-[10px] font-mono px-2 py-1 rounded-[8px] bg-white/[0.05] border border-white/[0.08] text-[#A0A0A0]"
              >
                {new Date(ev.date).toLocaleDateString("it", { day: "2-digit", month: "short" })}
                {" · "}
                <span className="text-white">{ev.distance_km}km</span>
                {ev.interval_detail ? (
                  <>
                    {" · "}
                    <span style={{ color: palette.color }}>{ev.interval_detail}</span>
                  </>
                ) : (
                  <>
                    {" GAP "}
                    <span style={{ color: palette.color }}>{ev.gap_pace}</span>
                    {ev.expected_t_pace && (
                      <>
                        {" vs T "}
                        <span className="text-[#666]">{ev.expected_t_pace}</span>
                      </>
                    )}
                    {ev.expected_i_pace && !ev.interval_detail && (
                      <>
                        {" vs I "}
                        <span className="text-[#666]">{ev.expected_i_pace}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={scrollToFieldTest}
          className="px-3 py-2 rounded-[12px] text-[10px] font-black tracking-widest text-black transition-all hover:opacity-90"
          style={{ backgroundColor: palette.color }}
        >
          REGISTRA TEST
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[#666] hover:text-white transition-colors p-1"
          title="Nascondi"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
