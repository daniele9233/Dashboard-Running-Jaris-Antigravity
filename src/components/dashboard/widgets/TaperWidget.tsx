import { useMemo } from "react";
import { BatteryCharging } from "lucide-react";
import {
  CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { FitnessFreshnessPoint } from "../../../types/api";
import { InfoTooltip } from "./InfoTooltip";
import { CHART_SERIES, CHART_SURFACE, CHART_TEXT, CHART_TYPE, chartAxis, chartGrid } from "../../statistics/chartTheme";
import { PLAN_DAYS } from "../../../data/mezzaOttobrePlan";
import { RACE_EVE_ISO, RACE_ISO, TAPER_START_ISO, addDays, formOf, taperReport } from "../../../utils/taperForecast";

/**
 * FRESCHEZZA E TAPER — quanto sei fresco oggi, dove arrivi alla vigilia della
 * mezza e se il carico segue il piano. I conti stanno in utils/taperForecast.
 */

const TONE = { ok: CHART_SERIES.positive, warn: CHART_SERIES.load, bad: CHART_SERIES.risk } as const;
const MONO = { fontFamily: CHART_TYPE.mono };
const VERIFY_ISO = PLAN_DAYS.find((d) => d.verify?.startsWith("Verifica 1"))?.date ?? "2026-09-27";

const signed = (n: number) => {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : r < 0 ? `−${-r}` : "0";
};
const short = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Row { iso: string; label: string; piano?: number; reale?: number; proiezione?: number }

export function TaperWidget({ ff }: { ff: FitnessFreshnessPoint[] | undefined }) {
  const todayIso = localIso(new Date());
  const r = useMemo(() => taperReport(ff, todayIso), [ff, todayIso]);

  const rows = useMemo<Row[]>(() => {
    const planned = new Map(r.planned.map((p) => [p.date, p.tsb]));
    const actual = new Map(r.actual.map((p) => [p.date, p.tsb]));
    const proj = new Map(r.projection.map((p) => [p.date, p.tsb]));
    const out: Row[] = [];
    // fino alla vigilia: il giorno della gara la TSB crolla per la gara stessa
    for (let iso = PLAN_DAYS[0].date; iso <= RACE_EVE_ISO; iso = addDays(iso, 1)) {
      out.push({ iso, label: short(iso), piano: planned.get(iso), reale: actual.get(iso), proiezione: proj.get(iso) });
    }
    return out;
  }, [r]);

  const lo = Math.min(-35, ...rows.flatMap((x) => [x.piano, x.reale, x.proiezione].filter((v): v is number => v != null)));
  const yMin = Math.floor((lo - 3) / 5) * 5;
  const yMax = 25;

  const now = r.today ? formOf(r.today.tsb) : null;
  const eve = r.eve ? formOf(r.eve.tsb) : null;
  const plannedAtVerify = r.planned.find((p) => p.date === VERIFY_ISO)?.tsb;

  const note =
    r.phase === "carico" && todayIso <= VERIFY_ISO
      ? `Nelle settimane 2–3 il rosso è normale: è il carico, non un allarme. La Verifica 1 del ${short(VERIFY_ISO)} la corri con la TSB intorno a ${signed(plannedAtVerify ?? -27)}: se va così così, pesa la fatica e non la forma.`
      : r.phase === "carico"
      ? `Dal ${short(TAPER_START_ISO)} inizia lo scarico: da lì la TSB deve salire fino a sopra +10 alla vigilia.`
      : r.phase === "scarico"
      ? "Il taper funziona se la TSB sale verso la vigilia. Le ultime sedute la fanno oscillare di qualche punto: è normale."
      : null;

  return (
    <div className="h-full rounded-[24px] p-6 flex flex-col gap-4 overflow-hidden backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
      <div className="flex items-center gap-2">
        <BatteryCharging size={18} style={{ color: CHART_SERIES.primary }} />
        <h3 className="text-white text-lg font-black tracking-tight">Freschezza e taper</h3>
        <InfoTooltip title="FRESCHEZZA E TAPER" lines={[
          "TSB = fitness (CTL) meno fatica (ATL). Sopra +10 sei fresco, sotto −20 in sovraccarico: stessa formula e stesse soglie della card Status di Forma.",
          "Piano: la curva che il piano della mezza prevede, partendo dal tuo stato del 16 settembre.",
          "Proiezione: dove arrivi alla vigilia con quello che hai fatto davvero più il resto del piano.",
          "Fondo: CTL classica a 42 giorni. Quella dell'app è una media di circa tre settimane e nel taper scende più in fretta della forma vera.",
          "Bici e forza non entrano nel conto: il backend misura solo le corse.",
        ]} />
        <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/[0.08] text-[#A0A0A0]">
          {r.phase === "carico" ? "Carico" : r.phase === "scarico" ? "Scarico" : r.phase === "gara" ? "Gara" : r.phase === "dopo" ? "Dopo la gara" : "Prima del piano"}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 min-h-0 flex-1">
        {/* numeri e verdetto */}
        <div className="flex flex-col gap-3 flex-1 min-w-[260px]">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Adesso" value={r.today ? signed(r.today.tsb) : "—"} color={now?.color} sub={now?.label ?? "TSB"} />
            <Stat label="Vigilia" value={r.eve ? signed(r.eve.tsb) : "—"} color={eve?.color}
              sub={`piano ${signed(r.plannedEve.tsb)}`} />
            <Stat label="Fondo" value={r.baseLossPct != null ? `−${Math.round(r.baseLossPct)}%` : "—"}
              sub="dal picco" />
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 pl-4 pr-3 py-3 relative overflow-hidden">
            <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: TONE[r.verdict.tone] }} />
            <p className="text-sm font-black text-white">{r.verdict.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[#A0A0A0]">{r.verdict.text}</p>
          </div>

          {note && <p className="text-[11.5px] leading-snug text-[#8A8A8A]">{note}</p>}
        </div>

        {/* la curva */}
        <div className="flex-[1.6] min-w-[300px] min-h-[190px] flex flex-col">
          <div className="flex-1 min-h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 14, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid {...chartGrid} />
                <ReferenceArea y1={10} y2={yMax} fill={CHART_SERIES.primary} fillOpacity={0.06} ifOverflow="hidden" />
                <ReferenceArea y1={yMin} y2={-20} fill={CHART_SERIES.risk} fillOpacity={0.07} ifOverflow="hidden" />
                <ReferenceLine y={0} stroke={CHART_SURFACE.borderStrong} />
                <ReferenceLine x={short(VERIFY_ISO)} stroke={CHART_TEXT.faint} strokeDasharray="2 3"
                  label={{ value: "Verifica 1", position: "top", fill: CHART_TEXT.axis, fontSize: 10 }} />
                <ReferenceLine x={short(TAPER_START_ISO)} stroke={CHART_TEXT.faint} strokeDasharray="2 3"
                  label={{ value: "scarico", position: "top", fill: CHART_TEXT.axis, fontSize: 10 }} />
                {todayIso >= PLAN_DAYS[0].date && todayIso <= RACE_EVE_ISO && (
                  <ReferenceLine x={short(todayIso)} stroke={CHART_SERIES.primary} strokeOpacity={0.5}
                    label={{ value: "oggi", position: "insideBottomRight", fill: CHART_SERIES.primary, fontSize: 10 }} />
                )}
                <XAxis dataKey="label" {...chartAxis} interval={6} />
                <YAxis {...chartAxis} domain={[yMin, yMax]} ticks={[-30, -20, -10, 0, 10, 20].filter((t) => t >= yMin)} width={44} />
                <Tooltip
                  contentStyle={{ background: CHART_SURFACE.panel, border: `1px solid ${CHART_SURFACE.borderStrong}`, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: CHART_TEXT.muted }}
                  formatter={(v: number, name: string) => [signed(v), name]}
                />
                <Line type="monotone" dataKey="piano" name="piano" stroke={CHART_TEXT.muted} strokeWidth={1.5}
                  strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="proiezione" name="proiezione" stroke={CHART_SERIES.projected} strokeWidth={2}
                  strokeDasharray="2 3" dot={false} isAnimationActive={false} connectNulls />
                <Line type="monotone" dataKey="reale" name="reale" stroke={CHART_SERIES.primary} strokeWidth={2.5}
                  dot={false} isAnimationActive={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-7 text-[10px] text-[#8A8A8A]" style={MONO}>
            <Legend color={CHART_SERIES.primary} label="reale" />
            <Legend color={CHART_TEXT.muted} label="piano" dashed />
            <Legend color={CHART_SERIES.projected} label="proiezione" dashed />
            <span>fino alla vigilia · gara {short(RACE_ISO)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5 min-w-0">
      <div className="text-[9px] font-black tracking-widest uppercase text-[#8A8A8A] truncate">{label}</div>
      <div className="text-2xl font-black tracking-tight tabular-nums" style={{ ...MONO, color: color ?? "#FFFFFF" }}>{value}</div>
      <div className="text-[10.5px] text-[#A0A0A0] truncate">{sub}</div>
    </div>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
      {label}
    </span>
  );
}
