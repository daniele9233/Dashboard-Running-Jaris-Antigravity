import { useState, useEffect } from "react";
import { Target, Trash2, ChevronDown, Plus } from "lucide-react";
import type { FieldTest } from "../../../types/api";
import { postFieldTest, getFieldTestLatest, deleteFieldTest } from "../../../api";

/**
 * FieldTestWidget — Test sul campo pace-only per benchmark VDOT.
 *
 * Utente sceglie distanza fissa (3K/5K/6K), inserisce tempo finale.
 * Backend calcola VDOT via Daniels reverse formula (NO HR, solo pace).
 * Test recente (<90gg) sovrascrive VDOT calcolato da runs history.
 *
 * Display:
 * - Stato corrente: ultimo test + VDOT derivato + pace medio
 * - Form aggiunta nuovo test (distance picker + time input)
 * - Delete test
 */
export function FieldTestWidget() {
  const [latest, setLatest] = useState<FieldTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [distance, setDistance] = useState<3 | 5 | 6>(5);
  const [timeMin, setTimeMin] = useState("");
  const [timeSec, setTimeSec] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await getFieldTestLatest();
      setLatest(r.test);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const submit = async () => {
    setError(null);
    const m = parseInt(timeMin, 10);
    const s = parseInt(timeSec || "0", 10);
    if (isNaN(m) || m < 0 || isNaN(s) || s < 0 || s >= 60) {
      setError("Tempo non valido");
      return;
    }
    const total = m * 60 + s;
    if (total <= 0) {
      setError("Tempo deve essere > 0");
      return;
    }
    setSaving(true);
    try {
      await postFieldTest({ distance_km: distance, time_seconds: total });
      setShowForm(false);
      setTimeMin("");
      setTimeSec("");
      await reload();
      // Force dashboard refresh — best-effort
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!latest?._id) return;
    if (!confirm("Eliminare questo field test?")) return;
    await deleteFieldTest(latest._id);
    await reload();
    window.location.reload();
  };

  const fmtPace = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const fmtTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const daysAgo = (iso: string): number => {
    const d = new Date(iso);
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  };

  return (
    <div className="h-full rounded-[24px] p-6 flex flex-col backdrop-blur-2xl border border-white/[0.12] shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] bg-gradient-to-br from-white/[0.06] to-black/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-[#C0FF00]" size={14} />
          <span className="text-[#A0A0A0] text-[10px] font-black tracking-widest">FIELD TEST</span>
        </div>
        {latest && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-[#666] hover:text-[#C0FF00] text-[10px] font-black tracking-wider transition-colors flex items-center gap-1"
          >
            <Plus size={11} />
            NUOVO
          </button>
        )}
      </div>

      {/* Latest test display */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#666] text-[10px] font-black tracking-widest">Caricamento...</div>
        </div>
      ) : !latest && !showForm ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-[#A0A0A0] text-xs text-center leading-snug">
            Nessun field test registrato.
            <br />
            <span className="text-[#555] text-[10px]">
              Corri 3/5/6 km a massima intensità per benchmark VDOT pace-only.
            </span>
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-black text-[#C0FF00] border border-[#C0FF00]/30 hover:border-[#C0FF00] rounded-[12px] px-4 py-2 transition-all"
          >
            <Plus size={12} className="inline mr-1" />
            REGISTRA TEST
          </button>
        </div>
      ) : !showForm && latest ? (
        <>
          {/* Test attivo */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-white text-5xl font-black tracking-tight">
                {latest.vdot.toFixed(1)}
              </span>
              <span className="text-[#A0A0A0] text-sm font-semibold">VDOT</span>
            </div>
            <div className="text-[#666] text-[10px] font-bold uppercase tracking-widest mb-4">
              Benchmark attivo (pace-only)
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-[12px] bg-white/[0.025] border border-white/[0.06] p-3">
                <div className="text-[9px] font-black tracking-widest uppercase text-gray-500">Distanza</div>
                <div className="text-white text-lg font-black mt-1">{latest.distance_km}K</div>
              </div>
              <div className="rounded-[12px] bg-white/[0.025] border border-white/[0.06] p-3">
                <div className="text-[9px] font-black tracking-widest uppercase text-gray-500">Tempo</div>
                <div className="text-white text-lg font-black font-mono mt-1">{fmtTime(latest.time_seconds)}</div>
              </div>
              <div className="rounded-[12px] bg-white/[0.025] border border-white/[0.06] p-3">
                <div className="text-[9px] font-black tracking-widest uppercase text-gray-500">Pace</div>
                <div className="text-[#C0FF00] text-lg font-black font-mono mt-1">{fmtPace(latest.pace_sec_per_km)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto text-[#555] text-[9px] tracking-wider">
              <span>{daysAgo(latest.date)} giorni fa</span>
              <button
                onClick={remove}
                className="text-[#555] hover:text-[#F43F5E] transition-colors flex items-center gap-1"
              >
                <Trash2 size={10} />
                ELIMINA
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Form aggiunta nuovo test */
        <div className="flex-1 flex flex-col gap-3">
          {/* Distance picker */}
          <div>
            <label className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase mb-2 block">
              Distanza
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([3, 5, 6] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistance(d)}
                  className={`py-2 rounded-[12px] text-sm font-black tracking-wider transition-all ${
                    distance === d
                      ? "bg-[#C0FF00] text-black"
                      : "bg-white/[0.05] text-[#A0A0A0] border border-white/[0.08] hover:border-white/[0.2]"
                  }`}
                >
                  {d} KM
                </button>
              ))}
            </div>
          </div>

          {/* Time input */}
          <div>
            <label className="text-[#A0A0A0] text-[10px] font-black tracking-widest uppercase mb-2 block">
              Tempo finale (mm:ss)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                max="180"
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
                placeholder="20"
                className="w-20 bg-white/[0.05] border border-white/[0.1] rounded-[12px] px-3 py-2 text-white text-center text-sm font-mono focus:outline-none focus:border-[#C0FF00]/50"
              />
              <span className="text-white font-bold">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={timeSec}
                onChange={(e) => setTimeSec(e.target.value)}
                placeholder="50"
                className="w-20 bg-white/[0.05] border border-white/[0.1] rounded-[12px] px-3 py-2 text-white text-center text-sm font-mono focus:outline-none focus:border-[#C0FF00]/50"
              />
            </div>
          </div>

          {error && (
            <div className="text-[#F43F5E] text-[10px] font-bold">{error}</div>
          )}

          <div className="flex gap-2 mt-auto">
            <button
              onClick={() => {
                setShowForm(false);
                setError(null);
              }}
              className="flex-1 py-2 rounded-[12px] text-xs font-black text-[#A0A0A0] border border-white/[0.1] hover:border-white/[0.3] transition-all"
            >
              ANNULLA
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex-1 py-2 rounded-[12px] text-xs font-black text-black bg-[#C0FF00] hover:bg-[#D0FF40] disabled:opacity-50 transition-all"
            >
              {saving ? "SALVO..." : "SALVA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
