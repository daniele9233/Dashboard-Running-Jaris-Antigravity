import { CheckCircle2, XCircle, AlertTriangle, TrendingDown, Thermometer, BatteryLow, Target, Minus } from "lucide-react";
import type { Diagnosis, SessionEval, Verdict } from "../utils/trainingAdherence";

/**
 * UI dell'aderenza: il verdetto della singola seduta e la diagnosi sul pattern.
 * Il giudizio arriva dal confronto fra prescrizione e giri realmente corsi,
 * quindi non c'è nulla da cliccare: si legge.
 */

const fmtPace = (sec: number | null) =>
  sec == null ? '—' : `${Math.floor(Math.round(sec) / 60)}:${String(Math.round(sec) % 60).padStart(2, '0')}`;

const VERDICT_STYLE: Record<Verdict, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  on_target:     { label: 'Centrata',        color: '#10B981', bg: 'rgba(16,185,129,0.10)',  icon: CheckCircle2 },
  close:         { label: 'Quasi',           color: '#C0FF00', bg: 'rgba(192,255,0,0.10)',   icon: CheckCircle2 },
  under:         { label: 'Sotto target',    color: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  icon: TrendingDown },
  not_completed: { label: 'Non chiusa',      color: '#F43F5E', bg: 'rgba(244,63,94,0.10)',   icon: XCircle },
  missed:        { label: 'Non svolta',      color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: Minus },
  unrated:       { label: 'Senza giri',      color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: Minus },
};

/** Verdetto della singola seduta, con i numeri che lo giustificano. */
export function SessionVerdict({ e }: { e: SessionEval }) {
  const s = VERDICT_STYLE[e.verdict];
  const Icon = s.icon;
  const showNumbers = e.kind !== 'easy' && e.verdict !== 'missed' && e.verdict !== 'unrated';

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: `${s.color}40`, background: s.bg }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color: s.color }} />
        <span className="text-sm font-black uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-gray-500">esito automatico</span>
      </div>

      {showNumbers ? (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Ripetute" value={`${e.repsDone}/${e.repsPrescribed}`} />
          <Stat
            label="Passo"
            value={fmtPace(e.actualPaceSec)}
            sub={e.targetPaceSec ? `target ${fmtPace(e.targetPaceSec)}` : undefined}
            accent={e.deltaPct != null && e.deltaPct > 5 ? '#F59E0B' : undefined}
          />
          <Stat
            label="Tenuta"
            value={e.fadePct == null ? '—' : `${e.fadePct > 0 ? '+' : ''}${e.fadePct.toFixed(1)}%`}
            sub={e.fadePct == null ? undefined : 'ultima vs prima'}
            accent={e.fadePct != null && e.fadePct >= 4 ? '#F59E0B' : undefined}
          />
        </div>
      ) : (
        <p className="text-[11px] text-gray-400">
          {e.verdict === 'missed'
            ? 'Nessuna corsa registrata in questa data.'
            : e.verdict === 'unrated'
            ? 'La corsa c\'è ma non ha i giri: senza lap non si può giudicare la struttura.'
            : 'Corsa facile: conta averla fatta, non il ritmo.'}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">{label}</div>
      <div className="text-lg font-black tabular-nums" style={{ color: accent ?? '#FFFFFF', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-gray-600">{sub}</div>}
    </div>
  );
}

const CAUSE_ICON = {
  none: CheckCircle2,
  pace_too_fast: Target,
  endurance: TrendingDown,
  heat: Thermometer,
  fatigue: BatteryLow,
} as const;

/**
 * Diagnosi sul pattern. Compare solo quando dice qualcosa: una seduta storta
 * non merita un allarme, due o tre di fila sì.
 */
export function AdherenceBanner({ d }: { d: Diagnosis }) {
  if (d.level === 'ok' && d.streak === 0) return null;

  const color = d.level === 'recalibrate' ? '#F43F5E' : d.level === 'watch' ? '#F59E0B' : '#6B7280';
  const Icon = d.level === 'ok' ? CheckCircle2 : CAUSE_ICON[d.cause] ?? AlertTriangle;

  return (
    <div
      className="rounded-2xl border p-5 mb-5"
      style={{ borderColor: `${color}40`, background: `linear-gradient(135deg, ${color}12, rgba(0,0,0,0.3))` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: `${color}1f` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-black text-white">{d.headline}</h3>
            {d.streak >= 2 && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}1f`, color }}>
                {d.streak} di fila · su {d.considered} valutate
              </span>
            )}
          </div>
          <p className="text-[12px] text-gray-300 leading-relaxed mt-1.5">{d.detail}</p>
          {d.action && (
            <p className="text-[12px] leading-relaxed mt-2 pt-2 border-t border-white/10" style={{ color }}>
              <span className="font-black uppercase tracking-widest text-[9px] mr-1.5">Cosa fare</span>
              {d.action}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Striscia compatta delle ultime sedute chiave: il pattern a colpo d'occhio. */
export function AdherenceStrip({ evals }: { evals: SessionEval[] }) {
  const key = evals.filter((e) => e.kind !== 'easy').slice(0, 8).reverse();
  if (key.length < 2) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ultime chiave</span>
      <div className="flex items-center gap-1">
        {key.map((e, i) => {
          const s = VERDICT_STYLE[e.verdict];
          return (
            <span
              key={i}
              title={`${e.date} · ${e.title} · ${s.label}`}
              className="w-2.5 h-6 rounded-full"
              style={{ background: s.color, opacity: e.verdict === 'missed' || e.verdict === 'unrated' ? 0.35 : 1 }}
            />
          );
        })}
      </div>
    </div>
  );
}
