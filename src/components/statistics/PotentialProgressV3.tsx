import { useMemo, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, RadialBar, RadialBarChart, ReferenceDot,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, Treemap, XAxis, YAxis, ZAxis,
  Bar, BarChart, Cell,
} from "recharts";
import { Activity, ArrowDownRight, ArrowUpRight, Flame, Gauge, Target, TrendingUp, Zap } from "lucide-react";
import type { Run } from "../../types/api";
import { usePhysio, fmtDate } from "../gamification/usePhysio";
import { SYSTEM_ORDER, SYSTEMS, humanDays } from "../gamification/physioEngine";
import { ZONES, type ZoneId } from "../gamification/gamiCore";
import { CHART_SERIES, CHART_SURFACE, CHART_TEXT } from "./chartTheme";

/**
 * POTENZIALE E PROGRESSI · V2
 * ════════════════════════════════════════════════════════════════════════════
 * La versione precedente rispondeva alla domanda "come sto andando" con una
 * collezione di metriche. Questa risponde a una domanda diversa, e più utile:
 *
 *   «Di quanto sono ancora migliorabile, cosa me lo impedisce, e quando arriva?»
 *
 * Il filo che tiene insieme i sei blocchi è UNA SOLA UNITÀ DI MISURA: i punti di
 * VDOT. I serbatoi valgono punti, il sistema che frena costa punti, una singola
 * seduta ne aggiunge una frazione, un traguardo ne chiede un numero preciso.
 * Tutto ciò che si legge qui si può sommare mentalmente, ed è il motivo per cui
 * questa pagina esiste separata dalla prima.
 *
 * Il motore è lo stesso del Banco di prova e della gamification (physioEngine):
 * nessun calcolo parallelo, così due schermate non danno due numeri diversi —
 * un errore già pagato altrove in questa app.
 */

const PANEL = CHART_SURFACE.panel;
const BORDER = CHART_SURFACE.border;
const GRID = CHART_SURFACE.grid;
const LIME = CHART_SERIES.primary;
const CYAN = CHART_SERIES.compare;
const MONO = "'JetBrains Mono', monospace";

// ── guscio dei pannelli ───────────────────────────────────────────────────────
function Panel({ icon: Icon, title, hint, children, className = "" }: {
  icon: typeof Target; title: string; hint?: string;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border overflow-hidden ${className}`}
      style={{ borderColor: BORDER, background: PANEL }}
    >
      <div className="flex items-baseline gap-2 px-5 pt-4 pb-3">
        <Icon className="w-4 h-4 self-center" style={{ color: LIME }} />
        <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white">{title}</h3>
        {hint && <span className="ml-auto text-[10px] truncate" style={{ color: CHART_TEXT.faint }}>{hint}</span>}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, unit, sub, color = LIME, icon: Icon }: {
  label: string; value: string; unit?: string; sub?: string; color?: string; icon?: typeof Target;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: "#0A0A0A" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
        <span className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: CHART_TEXT.axis }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-black tabular-nums leading-none" style={{ fontFamily: MONO, color }}>{value}</span>
        {unit && <span className="text-[10px]" style={{ color: CHART_TEXT.muted }}>{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[10.5px] leading-snug" style={{ color: CHART_TEXT.muted }}>{sub}</div>}
    </div>
  );
}

const box = {
  background: "#0A0A0AF5", border: `1px solid ${CHART_SURFACE.borderStrong}`,
  borderRadius: 10, padding: "8px 10px", fontSize: 11,
};

export function PotentialProgressV3({ runs }: { runs: Run[] }) {
  const physio = usePhysio(runs);
  const [sysSel, setSysSel] = useState<string | null>(null);

  // ── 1 · la traiettoria: storia e previsione nello stesso grafico ──
  const trajectory = useMemo(() => {
    if (!physio.ok) return [];
    const past = physio.history
      .filter((_, i) => i % 3 === 0)
      .map((h) => ({ day: h.day - physio.model.today, iso: h.iso, vdotPast: h.vdot, vdotNext: null as number | null }));
    const future = physio.forecast.points
      .filter((p) => p.day - physio.model.today <= 400)
      .map((p) => ({ day: p.day - physio.model.today, iso: p.iso, vdotPast: null as number | null, vdotNext: p.vdot }));
    // il punto di giunzione appartiene a entrambe le serie, o la linea si spezza
    const join = { day: 0, iso: past[past.length - 1]?.iso ?? "", vdotPast: physio.vdot, vdotNext: physio.vdot };
    return [...past, join, ...future];
  }, [physio]);

  // ── 2 · i serbatoi, in punti di VDOT ──
  const tanks = useMemo(() => {
    if (!physio.ok) return [];
    return SYSTEM_ORDER.map((id) => {
      const s = physio.byId[id];
      const def = SYSTEMS[id];
      return {
        id,
        name: def.name,
        short: def.name.split(" ")[0],
        color: def.color,
        pct: Math.round(s?.pct ?? 0),
        settles: Math.round(s?.settlesAt ?? 0),
        trend: Math.round((s?.trend28 ?? 0) * 10) / 10,
        dose: Math.round(s?.weeklyDose ?? 0),
        full: Math.round(s?.weeklyFull ?? 0),
        /** Punti di VDOT ancora sul tavolo in questo sistema. */
        onTable: Math.round(((100 - (s?.pct ?? 0)) / 100) * def.vdotSpan * 10) / 10,
        span: def.vdotSpan,
        what: def.what,
        from: def.from,
        tau: def.tau,
      };
    });
  }, [physio]);

  const onTableTotal = useMemo(
    () => Math.round(tanks.reduce((s, t) => s + t.onTable, 0) * 10) / 10,
    [tanks],
  );

  // ── 3 · dove finiscono i minuti (treemap) ──
  const minutesTree = useMemo(() => {
    const zones: ZoneId[] = ["recovery", "easy", "medium", "threshold", "vo2"];
    return zones
      .map((z) => ({ name: ZONES[z].name, size: Math.round(physio.weeklyZone[z] ?? 0), color: ZONES[z].color }))
      .filter((z) => z.size > 0);
  }, [physio.weeklyZone]);

  // ── 4 · le sedute che pesano ──
  const impacts = useMemo(
    () => physio.impacts
      .filter((s) => s.day >= physio.model.today - 120)
      .map((s) => ({
        x: s.day - physio.model.today,
        y: Math.round(s.vdotGain * 1000) / 1000,
        z: Math.max(8, Math.round(s.minutes)),
        name: s.name,
        date: s.date,
        km: s.km,
        color: s.mainSystem?.color ?? CHART_TEXT.faint,
        system: s.mainSystem?.name ?? "—",
        what: s.what,
      })),
    [physio.impacts, physio.model.today],
  );

  // ── 5 · i traguardi, in ordine di arrivo ──
  /** Solo i traguardi ancora aperti: quelli già presi valgono una riga sola. */
  const goals = useMemo(
    () => physio.goals
      .filter((g) => !g.done && g.days != null)
      .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9))
      .slice(0, 6),
    [physio.goals],
  );
  const doneGoals = useMemo(() => physio.goals.filter((g) => g.done), [physio.goals]);
  const goalMaxDays = Math.max(60, ...goals.map((g) => g.days ?? 0));

  if (!physio.ok) {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: BORDER, background: PANEL }}>
        <p className="text-[12px]" style={{ color: CHART_TEXT.muted }}>
          Servono almeno cinque corse con passo e durata per far girare il modello. Sincronizza e torna qui.
        </p>
      </div>
    );
  }

  const limiter = physio.limiter;
  const trendCol = (v: number) => (v > 0.2 ? CHART_SERIES.positive : v < -0.2 ? CHART_SERIES.risk : CHART_TEXT.muted);

  return (
    <div className="space-y-5">

      {/* ══ RIGA 1 · I QUATTRO NUMERI ══════════════════════════════════════ */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="VDOT al fresco" value={physio.vdot.toFixed(1)} icon={Gauge}
          sub={`Oggi, col clima di oggi, vale ${physio.vdotToday.toFixed(1)}.`}
        />
        <Kpi
          label="Crescita attuale" value={`${physio.forecast.perMonth >= 0 ? "+" : ""}${physio.forecast.perMonth.toFixed(2)}`}
          unit="punti / mese" color={physio.forecast.perMonth >= 0 ? CHART_SERIES.positive : CHART_SERIES.risk}
          icon={physio.forecast.perMonth >= 0 ? ArrowUpRight : ArrowDownRight}
          sub={`Fra 90 giorni: ${physio.forecast.in90.toFixed(1)}.`}
        />
        <Kpi
          label="Dove ti fermi" value={physio.forecast.plateau.toFixed(1)} color={CYAN} icon={TrendingUp}
          sub={physio.forecast.halfwayDays != null
            ? `Metà strada ${humanDays(physio.forecast.halfwayDays)}, se non cambia niente.`
            : "Con questo carico sei già al plateau."}
        />
        <Kpi
          label="Ancora sul tavolo" value={`${onTableTotal.toFixed(1)}`} unit="punti VDOT"
          color={CHART_SERIES.load} icon={Flame}
          sub={limiter ? `Il grosso è in ${limiter.def.name.toLowerCase()}.` : undefined}
        />
      </div>

      {/* ══ RIGA 2 · LA TRAIETTORIA ════════════════════════════════════════ */}
      <Panel
        icon={TrendingUp} title="La traiettoria del potenziale"
        hint="un anno dietro, un anno davanti · tratteggio = previsione"
      >
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trajectory} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="pp3-past" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LIME} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={LIME} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="day" type="number" domain={["dataMin", "dataMax"]}
                tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                tickFormatter={(d: number) => (d === 0 ? "oggi" : `${d > 0 ? "+" : ""}${Math.round(d / 30)}m`)}
                stroke={CHART_SURFACE.borderStrong}
              />
              <YAxis
                domain={["auto", "auto"]} width={46}
                tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                stroke={CHART_SURFACE.borderStrong}
              />
              <Tooltip
                contentStyle={box} labelStyle={{ color: "#fff", fontFamily: MONO, fontSize: 10.5 }}
                labelFormatter={(d) => {
                  const p = trajectory.find((t) => t.day === d);
                  return p?.iso ? fmtDate(p.iso) : "";
                }}
                formatter={(v: number, n) => [v.toFixed(1), n === "vdotPast" ? "VDOT misurato" : "VDOT previsto"]}
              />
              <ReferenceLine
                y={physio.forecast.plateau} stroke={CYAN} strokeDasharray="5 4"
                label={{ value: `plateau ${physio.forecast.plateau.toFixed(1)}`, position: "insideTopRight", fill: CYAN, fontSize: 10, fontFamily: MONO }}
              />
              <ReferenceLine x={0} stroke="#ffffff33" />
              <Area type="monotone" dataKey="vdotPast" stroke={LIME} strokeWidth={2.2} fill="url(#pp3-past)" connectNulls={false} dot={false} />
              <Line type="monotone" dataKey="vdotNext" stroke={LIME} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
              <ReferenceDot x={0} y={physio.vdot} r={4.5} fill={LIME} stroke="#0A0A0A" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: CHART_TEXT.muted }}>
          La curva piena è quello che i tuoi allenamenti hanno già costruito, ricalcolato giorno per giorno
          sull'ultimo anno. Il tratteggio è dove porta lo stesso carico se non cambi niente: si appiattisce
          perché i serbatoi si avvicinano al loro pieno, non perché ti stanchi.
        </p>
      </Panel>

      {/* ══ RIGA 3 · SERBATOI + QUANTO LASCI SUL TAVOLO ════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel icon={Activity} title="I cinque serbatoi" hint="anello esterno = dove si stabilizza col carico di adesso">
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={[...tanks].reverse()} innerRadius="24%" outerRadius="100%"
                startAngle={90} endAngle={-270}
              >
                <Tooltip
                  contentStyle={box}
                  formatter={(v: number, _n, p) => [`${v}%`, (p?.payload as { name?: string })?.name ?? ""]}
                />
                <RadialBar dataKey="pct" background={{ fill: "#1A1A1A" }} cornerRadius={6}>
                  {[...tanks].reverse().map((t) => <Cell key={t.id} fill={t.color} />)}
                </RadialBar>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 space-y-1.5">
            {tanks.map((t) => (
              <button
                key={t.id} type="button"
                onClick={() => setSysSel(sysSel === t.id ? null : t.id)}
                className="w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                style={{ background: sysSel === t.id ? "#ffffff0a" : "transparent" }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-[11.5px] font-bold text-white/90 flex-1 min-w-0 truncate">{t.name}</span>
                  <span className="text-[11px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: t.color }}>
                    {t.pct}%
                  </span>
                  <span className="text-[10px] tabular-nums shrink-0 w-12 text-right" style={{ fontFamily: MONO, color: trendCol(t.trend) }}>
                    {t.trend > 0 ? "+" : ""}{t.trend}
                  </span>
                  <span className="text-[9.5px] tabular-nums shrink-0 w-16 text-right" style={{ fontFamily: MONO, color: CHART_TEXT.faint }}>
                    → {t.settles}%
                  </span>
                </div>
                {sysSel === t.id && (
                  <div className="mt-1.5 pl-4 text-[10.5px] leading-relaxed" style={{ color: CHART_TEXT.muted }}>
                    {t.what} Si alimenta con {t.from}; costante di tempo {t.tau} giorni.
                    Adesso ne ricevi <b className="text-white">{t.dose}′</b> a settimana contro i{" "}
                    <b className="text-white">{t.full}′</b> che lo terrebbero pieno.
                  </div>
                )}
              </button>
            ))}
            <div className="flex items-center gap-2 pt-1 text-[9px] tracking-[0.15em] uppercase" style={{ color: CHART_TEXT.faint }}>
              <span className="w-12 text-right">28 gg</span>
              <span className="w-16 text-right">si ferma a</span>
            </div>
          </div>
        </Panel>

        <Panel icon={Flame} title="Quanto lasci sul tavolo" hint="punti di VDOT recuperabili, sistema per sistema">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...tanks].sort((a, b) => b.onTable - a.onTable)} layout="vertical"
                margin={{ top: 4, right: 28, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number" domain={[0, Math.max(1, ...tanks.map((t) => t.span))]}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <YAxis
                  type="category" dataKey="short" width={74}
                  tick={{ fill: CHART_TEXT.muted, fontSize: 10.5 }}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <Tooltip
                  contentStyle={box}
                  formatter={(v: number, _n, p) => {
                    const row = p?.payload as { span?: number };
                    return [`${v} punti su ${row?.span ?? 0} possibili`, "recuperabili"];
                  }}
                />
                <Bar dataKey="onTable" radius={[0, 5, 5, 0]} barSize={22}>
                  {[...tanks].sort((a, b) => b.onTable - a.onTable).map((t) => (
                    <Cell key={t.id} fill={t.color} fillOpacity={limiter?.def.id === t.id ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {limiter && (
            <div className="mt-2 rounded-xl border p-3" style={{ borderColor: `${limiter.def.color}44`, background: `${limiter.def.color}0d` }}>
              <div className="text-[9px] font-black tracking-[0.2em] uppercase mb-1" style={{ color: limiter.def.color }}>
                Il collo di bottiglia
              </div>
              <p className="text-[11.5px] leading-relaxed text-gray-300">
                <b className="text-white">{limiter.def.name}</b> è al {Math.round(limiter.pct)}% e vale{" "}
                {SYSTEMS[limiter.def.id].vdotSpan.toFixed(1)} punti da vuoto a pieno: è lì che il prossimo mese
                rende di più. {limiter.def.what}
              </p>
            </div>
          )}
        </Panel>
      </div>

      {/* ══ RIGA 4 · MINUTI + SEDUTE ═══════════════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel icon={Zap} title="Dove finiscono i minuti" hint="media settimanale, ultime 6 settimane">
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={minutesTree} dataKey="size" aspectRatio={4 / 3} stroke={PANEL}
                content={<TreeCell />}
              />
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {minutesTree.map((z) => (
              <span key={z.name} className="flex items-center gap-1.5 text-[10px]" style={{ color: CHART_TEXT.muted }}>
                <span className="w-2 h-2 rounded-sm" style={{ background: z.color }} />
                {z.name} <b className="text-white tabular-nums" style={{ fontFamily: MONO }}>{z.size}′</b>
              </span>
            ))}
          </div>
        </Panel>

        <Panel icon={Activity} title="Le sedute che pesano" hint="quattro mesi · bolla = durata · colore = sistema alimentato">
          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis
                  type="number" dataKey="x" domain={[-120, 0]}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  tickFormatter={(d: number) => (d === 0 ? "oggi" : `${d}g`)}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <YAxis
                  type="number" dataKey="y" width={52}
                  tick={{ fill: CHART_TEXT.axis, fontSize: 10, fontFamily: MONO }}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  stroke={CHART_SURFACE.borderStrong}
                />
                <ZAxis type="number" dataKey="z" range={[24, 260]} />
                <Tooltip
                  contentStyle={box}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as typeof impacts[number];
                    return (
                      <div style={box}>
                        <div style={{ color: "#fff", fontFamily: MONO, fontWeight: 800 }}>{d.date} · {d.km.toFixed(1)} km</div>
                        <div style={{ color: d.color, fontFamily: MONO }}>{d.system} · +{d.y.toFixed(3)} VDOT</div>
                        <div style={{ color: CHART_TEXT.muted, maxWidth: 220 }}>{d.what}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={impacts} fillOpacity={0.75}>
                  {impacts.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: CHART_TEXT.muted }}>
            Ogni bolla è una corsa, in alto quelle che hanno costruito più potenziale. I numeri sono piccoli di
            proposito — nessuna singola uscita cambia una stagione — ma sono nella stessa unità, quindi due
            sedute si possono finalmente confrontare.
          </p>
        </Panel>
      </div>

      {/* ══ RIGA 5 · TRAGUARDI + PRESCRIZIONI ══════════════════════════════ */}
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel icon={Target} title="Quando arrivano i traguardi" hint="al carico di adesso, col clima del mese">
          <div className="space-y-2.5">
            {goals.map((g) => {
              const w = g.done ? 100 : Math.min(100, ((g.days ?? 0) / goalMaxDays) * 100);
              return (
                <div key={g.id}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[11.5px] font-bold text-white/90 flex-1 min-w-0 truncate">{g.label}</span>
                    {g.done ? (
                      <span className="text-[10px] font-black tracking-[0.15em] uppercase" style={{ color: CHART_SERIES.positive }}>
                        già tuo
                      </span>
                    ) : (
                      <>
                        <span className="text-[10.5px] tabular-nums" style={{ fontFamily: MONO, color: CHART_TEXT.muted }}>
                          {g.iso ? fmtDate(g.iso) : "—"}
                        </span>
                        <span className="text-[10px] shrink-0 w-24 text-right" style={{ fontFamily: MONO, color: LIME }}>
                          {g.human}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden" style={{ background: "#151515" }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${w}%`,
                        background: g.done
                          ? CHART_SERIES.positive
                          : `linear-gradient(90deg, ${LIME}, ${CYAN})`,
                        opacity: g.done ? 0.9 : 0.8,
                      }}
                    />
                  </div>
                  {!g.done && g.blocker && (
                    <div className="mt-1 text-[10px]" style={{ color: CHART_TEXT.faint }}>{g.blocker}</div>
                  )}
                </div>
              );
            })}
            {goals.length === 0 && (
              <p className="text-[11.5px]" style={{ color: CHART_TEXT.muted }}>
                Nessun traguardo aperto raggiungibile con questo carico: servirebbe più carico, o un obiettivo
                più ambizioso di quelli in lista.
              </p>
            )}
            {doneGoals.length > 0 && (
              <div className="pt-2 mt-1 border-t" style={{ borderColor: BORDER }}>
                <div className="text-[9px] font-black tracking-[0.2em] uppercase mb-1.5" style={{ color: CHART_SERIES.positive }}>
                  {doneGoals.length} già alla tua portata, oggi
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {doneGoals.map((g) => (
                    <span key={g.id} className="text-[10px] px-2 py-1 rounded-md"
                      style={{ background: `${CHART_SERIES.positive}14`, color: CHART_SERIES.positive }}>
                      {g.label}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: CHART_TEXT.faint }}>
                  "Alla tua portata" vuol dire che il modello ti dà quel tempo in giornata ideale, non che
                  l'hai già corso: il cronometro va ancora fatto girare.
                </p>
              </div>
            )}
          </div>
        </Panel>

        <Panel icon={Zap} title="Cosa aggiungere, in ordine di resa" hint="giorni tolti al primo traguardo aperto">
          <div className="space-y-2.5">
            {physio.prescriptions.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded-xl border p-3" style={{ borderColor: BORDER, background: "#0A0A0A" }}>
                <div className="flex items-baseline gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: p.system.color }} />
                  <span className="text-[12px] font-bold text-white flex-1 min-w-0">{p.title}</span>
                  {p.daysSaved != null && p.daysSaved > 0 && (
                    <span className="text-[12px] font-black tabular-nums shrink-0" style={{ fontFamily: MONO, color: CHART_SERIES.positive }}>
                      −{p.daysSaved} gg
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[10.5px] leading-snug" style={{ color: CHART_TEXT.muted }}>{p.detail}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "#151515" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.in8w)}%`, background: p.system.color }} />
                  </div>
                  <span className="text-[9.5px] tabular-nums shrink-0" style={{ fontFamily: MONO, color: CHART_TEXT.faint }}>
                    {Math.round(p.nowPct)}% → {Math.round(p.in8w)}% · +{p.vdotGain.toFixed(2)} VDOT
                  </span>
                </div>
              </div>
            ))}
            {physio.prescriptions.length === 0 && (
              <p className="text-[11.5px]" style={{ color: CHART_TEXT.muted }}>
                Niente da aggiungere: con questo carico i serbatoi sono già al loro pieno sostenibile.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Cella del treemap: il colore della zona, il nome solo se ci sta. */
function TreeCell(props: unknown) {
  const p = props as {
    x: number; y: number; width: number; height: number;
    name?: string; size?: number; color?: string; root?: { children?: { size: number }[] };
  };
  const { x, y, width, height, name, size, color } = p;
  if (!(width > 0 && height > 0)) return null;
  const total = p.root?.children?.reduce((s, c) => s + (c.size ?? 0), 0) ?? 0;
  const share = total > 0 && size ? Math.round((size / total) * 100) : 0;
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height} rx={6}
        fill={color ?? LIME} fillOpacity={0.72} stroke={PANEL} strokeWidth={2}
      />
      {width > 66 && height > 34 && (
        <>
          <text x={x + 8} y={y + 18} fill="#fff" style={{ fontSize: 11, fontWeight: 800 }}>{name}</text>
          <text x={x + 8} y={y + 33} fill="#ffffffbb" style={{ fontSize: 10, fontFamily: MONO }}>
            {size}′ · {share}%
          </text>
        </>
      )}
    </g>
  );
}

export default PotentialProgressV3;
