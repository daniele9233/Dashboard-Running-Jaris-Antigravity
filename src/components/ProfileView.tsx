import React, { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Map, { Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Award, Clock, Activity, Zap, Calendar, Edit3, Share2, RefreshCw, Link2, X, Check, Heart, ChevronRight, Upload, Camera, Bot } from "lucide-react";
import { useApi } from "../hooks/useApi";
import { getProfile, updateProfile, getStravaAuthUrl, syncStrava, getBestEfforts, getHeatmap, getRuns } from "../api";
import { useJarvisContext } from "../context/JarvisContext";
import type { Profile, BestEffort, Run } from "../types/api";

// ─── POLYLINE DECODER ────────────────────────────────────────────────────────

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lng / 1e5, lat / 1e5]);
  }
  return points;
}

// ─── TRAINING ZONES (valori fissi basati su FC Max) ──────────────────────────

function getZones() {
  return [
    { zone: "Z1", label: "Recupero",     range: "< 117",       min: 0,   max: 117, bar: "from-blue-500/60 to-blue-500" },
    { zone: "Z2", label: "Resistenza",   range: "118 – 146",   min: 118, max: 146, bar: "from-green-500/60 to-green-500" },
    { zone: "Z3", label: "Ritmo",        range: "147 – 160",   min: 147, max: 160, bar: "from-yellow-400/60 to-yellow-400" },
    { zone: "Z4", label: "Soglia",       range: "161 – 175",   min: 161, max: 175, bar: "from-orange-500/60 to-orange-500" },
    { zone: "Z5", label: "Anaerobico",   range: "> 176",       min: 176, max: 220, bar: "from-red-500/60 to-red-500" },
  ];
}

// Soglia Z2/Z3 per la regola 80/20: lente = avg HR <= 146
const SLOW_MAX_HR = 146;

// ─── HEATMAP ─────────────────────────────────────────────────────────────────

interface HeatmapDay {
  date: string;
  km: number;
  runType?: string;
}

function buildHeatmapGrid(data: HeatmapDay[], weeksBack = 24) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const latestSun = new Date(today);
  latestSun.setDate(today.getDate() - dayOfWeek);
  const map: Record<string, { km: number; runType: string }> = {};
  for (const d of data) {
    if (!map[d.date]) map[d.date] = { km: 0, runType: '' };
    map[d.date].km = d.km;
    if (d.runType) map[d.date].runType = d.runType;
  }
  const grid: HeatmapDay[][] = [];
  for (let w = weeksBack - 1; w >= 0; w--) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(latestSun);
      dt.setDate(latestSun.getDate() - w * 7 + d);
      const iso = dt.toISOString().slice(0, 10);
      week.push({ date: iso, km: map[iso]?.km ?? 0, runType: map[iso]?.runType ?? '' });
    }
    grid.push(week);
  }
  return grid;
}

function heatmapColor(km: number) {
  if (km === 0) return "bg-[#1A1A1A]";
  if (km < 5) return "bg-[#064E3B]";
  if (km < 10) return "bg-[#047857]";
  if (km < 20) return "bg-[#10B981]";
  return "bg-[#34D399]";
}

function heatmapGlow(km: number) {
  if (km === 0) return "";
  if (km < 5) return "shadow-[0_0_4px_rgba(16,185,129,0.15)]";
  if (km < 10) return "shadow-[0_0_6px_rgba(16,185,129,0.25)]";
  if (km < 20) return "shadow-[0_0_8px_rgba(16,185,129,0.35)]";
  return "shadow-[0_0_10px_rgba(52,211,153,0.5)]";
}

// Colori per tipo di corsa nella heatmap
function runTypeColor(runType: string | undefined, km: number) {
  if (km === 0) return "bg-[#1A1A1A]";
  const t = (runType || "").toLowerCase();
  if (t.includes("ripet") || t.includes("interval")) return "bg-[#EF4444]";       // Rosso - Ripetute
  if (t.includes("tempo") || t.includes("soglia")) return "bg-[#F59E0B]";         // Arancione - Tempo/Soglia
  if (t.includes("lungo") || t.includes("long")) return "bg-[#3B82F6]";           // Blu - Lungo
  if (t.includes("recup") || t.includes("recovery")) return "bg-[#A855F7]";       // Viola - Recupero
  if (t.includes("easy") || t.includes("lento")) return "bg-[#10B981]";           // Verde - Easy
  if (t.includes("gara") || t.includes("race") || t.includes("test")) return "bg-[#EC4899]"; // Rosa - Gara/Test
  // Default basato su km
  if (km < 5) return "bg-[#064E3B]";
  if (km < 10) return "bg-[#047857]";
  if (km < 20) return "bg-[#10B981]";
  return "bg-[#34D399]";
}


// ─── IMAGE RESIZE HELPER ────────────────────────────────────────────────────

function resizeImage(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── EDIT MODAL ──────────────────────────────────────────────────────────────

interface EditModalProps {
  profile: Profile;
  onClose: () => void;
  onSaved: (updated: Profile) => void;
}

function EditModal({ profile, onClose, onSaved }: EditModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: profile.name ?? "",
    profile_pic: profile.profile_pic ?? profile.strava_profile_pic ?? "",
    age: String(profile.age || ""),
    sex: profile.sex ?? "",
    weight_kg: String(profile.weight_kg || ""),
    height_cm: String(profile.height_cm || ""),
    max_hr: String(profile.max_hr || ""),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file, 256);
      setForm(f => ({ ...f, profile_pic: dataUrl }));
    } catch {
      setError("Errore nel caricamento dell'immagine.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, string | number> = {
        name: form.name,
        profile_pic: form.profile_pic,
        sex: form.sex,
      };
      if (form.age) patch.age = parseInt(form.age);
      if (form.weight_kg) patch.weight_kg = parseFloat(form.weight_kg);
      if (form.height_cm) patch.height_cm = parseFloat(form.height_cm);
      if (form.max_hr) patch.max_hr = parseInt(form.max_hr);
      const updated = await updateProfile(patch as Partial<Profile>);
      onSaved(updated);
    } catch {
      setError("Errore nel salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder: string, unit?: string) => (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          className="flex-1 bg-[#121212] border border-[#3A3A3A] rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#3B82F6] transition-colors"
        />
        {unit && <span className="text-sm text-gray-500 w-8">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Edit Profile</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-[#2A2A2A] flex items-center justify-center hover:bg-[#3A3A3A] transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Profile pic upload */}
        <div className="flex justify-center mb-5">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#3A3A3A] bg-[#121212]">
              {form.profile_pic ? (
                <img src={form.profile_pic} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-600">
                  {form.name.charAt(0).toUpperCase() || "?"}
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
        <p className="text-center text-xs text-gray-500 mb-4">Clicca sulla foto per cambiarla</p>

        <div className="space-y-4">
          {field("Nome", "name", "Il tuo nome")}
          {field("Età", "age", "28", "anni")}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Sesso</label>
            <div className="flex gap-2">
              {["M", "F"].map(s => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, sex: s }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
                    form.sex === s
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#121212] border border-[#3A3A3A] text-gray-400 hover:border-[#3B82F6]"
                  }`}
                >
                  {s === "M" ? "Maschio" : "Femmina"}
                </button>
              ))}
            </div>
          </div>
          {field("Peso", "weight_kg", "70", "kg")}
          {field("Altezza", "height_cm", "175", "cm")}
          {field("FC Massima", "max_hr", "195", "bpm")}
        </div>

        {error && <p className="mt-4 text-xs text-rose-400 text-center">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-xl text-sm font-medium text-gray-300 transition-colors">
            Annulla
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 rounded-xl text-sm font-bold text-white transition-colors">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HERO MAP ─────────────────────────────────────────────────────────────────

function HeroMap({ lastRun }: { lastRun: Run | null }) {
  const coords = useMemo(() => {
    if (!lastRun?.polyline) return null;
    return decodePolyline(lastRun.polyline);
  }, [lastRun]);

  const bounds = useMemo(() => {
    if (!coords || coords.length === 0) return null;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    }
    const padLng = (maxLng - minLng) * 0.15 || 0.005;
    const padLat = (maxLat - minLat) * 0.15 || 0.005;
    return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat] as [number, number, number, number];
  }, [coords]);

  const routeGeoJSON = useMemo(() => {
    if (!coords) return null;
    return { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: coords }, properties: {} };
  }, [coords]);

  if (!coords || !bounds || !routeGeoJSON) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f23]">
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <Map initialViewState={{ bounds, fitBoundsOptions: { padding: 40 } }} style={{ width: "100%", height: "100%" }} mapStyle="https://tiles.openfreemap.org/styles/dark" interactive={false} attributionControl={false}>
        <Source id="hero-route" type="geojson" data={routeGeoJSON}>
          <Layer id="hero-route-glow" type="line" paint={{ "line-color": "#3B82F6", "line-width": 6, "line-opacity": 0.3, "line-blur": 8 }} />
          <Layer id="hero-route-line" type="line" paint={{ "line-color": "#3B82F6", "line-width": 3, "line-opacity": 0.8 }} />
        </Source>
      </Map>
      <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#121212]/30 to-transparent" />
    </div>
  );
}

// ─── 80/20 RULE COMPONENT ────────────────────────────────────────────────────

function EightyTwentyRule({ runs, period }: { runs: Run[]; period: 7 | 14 }) {
  const slowMaxHr = SLOW_MAX_HR;

  const data = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - period);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentRuns = runs.filter(r => r.date >= cutoffStr && r.avg_hr && r.distance_km >= 1);
    let slowKm = 0, fastKm = 0;
    const details: { date: string; km: number; hr: number; type: "slow" | "fast" }[] = [];

    for (const r of recentRuns) {
      const hr = r.avg_hr ?? 0;
      if (hr <= slowMaxHr) {
        slowKm += r.distance_km;
        details.push({ date: r.date, km: r.distance_km, hr, type: "slow" });
      } else {
        fastKm += r.distance_km;
        details.push({ date: r.date, km: r.distance_km, hr, type: "fast" });
      }
    }

    const total = slowKm + fastKm;
    const slowPct = total > 0 ? Math.round((slowKm / total) * 100) : 0;
    const fastPct = total > 0 ? 100 - slowPct : 0;

    return { slowKm, fastKm, total, slowPct, fastPct, details, runCount: recentRuns.length };
  }, [runs, slowMaxHr, period]);

  const isBalanced = data.slowPct >= 75 && data.slowPct <= 85;
  const tooFast = data.slowPct < 75;

  return (
    <div className="space-y-4">
      {/* Period summary */}
      <div className="text-xs text-gray-500">
        {data.runCount > 0
          ? <span>{data.runCount} corse con FC negli ultimi <span className="text-white font-bold">{period}</span> giorni — {data.total.toFixed(1)} km totali</span>
          : <span>Nessuna corsa con FC negli ultimi <span className="text-white font-bold">{period}</span> giorni</span>
        }
      </div>
      {/* Donut-style bar */}
      <div className="relative h-5 bg-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-500 rounded-l-full transition-all duration-500"
          style={{ width: `${data.slowPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-r from-red-500 to-red-600 rounded-r-full transition-all duration-500"
          style={{ width: `${data.fastPct}%` }}
        />
        {/* 80% marker line */}
        <div className="absolute inset-y-0 left-[80%] w-0.5 bg-white/60 z-10" />
      </div>

      {/* Legend */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400">Lente (Z1-Z2)</span>
          <span className="font-bold text-white">{data.slowPct}%</span>
          <span className="text-xs text-gray-500">{data.slowKm.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{data.fastKm.toFixed(1)} km</span>
          <span className="font-bold text-white">{data.fastPct}%</span>
          <span className="text-gray-400">Veloci (Z3-Z5)</span>
          <div className="w-3 h-3 rounded-full bg-red-500" />
        </div>
      </div>

      {/* Status */}
      <div className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium ${
        isBalanced ? "bg-green-500/10 text-green-400" :
        tooFast ? "bg-red-500/10 text-red-400" :
        "bg-yellow-500/10 text-yellow-400"
      }`}>
        {isBalanced ? "Distribuzione ottimale" :
         tooFast ? "Troppe corse veloci — rallenta le uscite facili" :
         "Troppe corse lente — aggiungi qualità"}
      </div>

      {/* Recent runs breakdown */}
      {data.details.length > 0 && (
        <div className="space-y-1.5 max-h-36 overflow-y-auto">
          {data.details.sort((a, b) => b.date.localeCompare(a.date)).map((d, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-[#121212] rounded-lg text-xs">
              <span className="text-gray-500">{d.date}</span>
              <span className="text-gray-400">{d.km.toFixed(1)} km</span>
              <span className="text-gray-400">{d.hr} bpm</span>
              <span className={`font-bold ${d.type === "slow" ? "text-green-400" : "text-red-400"}`}>
                {d.type === "slow" ? "Lenta" : "Veloce"}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ─── PACE PROGRESSION CHART ──────────────────────────────────────────────────

interface PacePoint {
  date: string;
  pace: number;
  km: number;
  name: string;
}

function PaceProgressionChart({ pacePoints }: { pacePoints: PacePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const chartW = 500, chartH = 140, padX = 0, padY = 10;
  const paces = pacePoints.map(p => p.pace);
  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const avgPace = Math.round(paces.reduce((s, p) => s + p, 0) / paces.length);
  const range = maxPace - minPace || 60;
  const yS = (p: number) => padY + ((p - minPace) / range) * (chartH - 2 * padY);
  const xS = (i: number) => padX + (i / (pacePoints.length - 1 || 1)) * (chartW - 2 * padX);
  const avgY = yS(avgPace);
  const polyline = pacePoints.map((p, i) => `${xS(i)},${yS(p.pace)}`).join(" ");
  const areaPath = `M ${xS(0)},${yS(pacePoints[0].pace)} ` +
    pacePoints.map((p, i) => `L ${xS(i)},${yS(p.pace)}`).join(" ") +
    ` L ${xS(pacePoints.length - 1)},${chartH} L ${xS(0)},${chartH} Z`;
  const hp = hovered !== null ? pacePoints[hovered] : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${chartW}/${chartH}` }}>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <line x1="0" y1={yS(minPace)} x2={chartW} y2={yS(minPace)} stroke="#2A2A2A" strokeWidth="0.5" />
        <line x1="0" y1={yS(maxPace)} x2={chartW} y2={yS(maxPace)} stroke="#2A2A2A" strokeWidth="0.5" />
        <line x1="0" y1={avgY} x2={chartW} y2={avgY} stroke="#8B5CF6" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.4" />
        <path d={areaPath} fill="url(#paceGrad)" />
        <polyline points={polyline} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {hovered !== null && (
          <line x1={xS(hovered)} y1={0} x2={xS(hovered)} y2={chartH} stroke="#ffffff" strokeWidth="0.5" opacity="0.25" strokeDasharray="3 2" />
        )}
        {pacePoints.map((p, i) => {
          const isBest = p.pace === minPace;
          const isHov = hovered === i;
          return (
            <circle
              key={i}
              cx={xS(i)}
              cy={yS(p.pace)}
              r={isHov ? 6 : isBest ? 5 : 3}
              fill={isHov ? "#C0FF00" : isBest ? "#EAB308" : "#8B5CF6"}
              stroke={isHov ? "#C0FF00" : isBest ? "#FDE047" : "#121212"}
              strokeWidth={isHov ? 2 : isBest ? 2 : 1.5}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
      {/* Y axis labels */}
      <span className="absolute top-0 left-1 text-[9px] text-[#10B981] font-bold">{fmt(minPace)}</span>
      <span className="absolute bottom-0 left-1 text-[9px] text-[#F43F5E] font-bold">{fmt(maxPace)}</span>
      <span className="absolute right-1 text-[9px] text-[#8B5CF6]/60 font-medium" style={{ top: `${(avgY / chartH) * 100}%` }}>media {fmt(avgPace)}</span>
      {/* Tooltip */}
      {hp !== null && hovered !== null && (
        <div
          className="absolute z-20 bg-[#1E1E1E] border border-[#3A3A3A] rounded-lg px-3 py-2 pointer-events-none text-xs shadow-xl whitespace-nowrap"
          style={{
            left: `${(xS(hovered) / chartW) * 100}%`,
            top: `${(yS(hp.pace) / chartH) * 100}%`,
            transform: hovered < pacePoints.length / 2 ? "translate(10px, -50%)" : "translate(calc(-100% - 10px), -50%)",
          }}
        >
          <div className="text-gray-400 mb-0.5">{hp.date}</div>
          <div className="font-bold text-white text-sm">{fmt(hp.pace)}<span className="text-gray-400 text-xs font-normal"> /km</span></div>
          <div className="text-gray-400">{hp.km.toFixed(1)} km</div>
          {hp.name && <div className="text-gray-500 truncate max-w-[130px]">{hp.name}</div>}
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function ProfileView() {
  const navigate = useNavigate();
  const { data: profileData, loading } = useApi<Profile>(getProfile);
  const { data: effortsData } = useApi<{ efforts: BestEffort[] }>(getBestEfforts);
  const { data: heatmapData } = useApi<{ heatmap: { date: string; km: number }[] }>(getHeatmap);
  const { data: runsData } = useApi<{ runs: Run[] }>(getRuns);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [rulePeriod, setRulePeriod] = useState<7 | 14>(7);
  const { enabled: jarvisEnabled, setEnabled: setJarvisEnabled } = useJarvisContext();

  const activeProfile = profile ?? profileData;
  const lastRun = useMemo(() => {
    const runs = runsData?.runs ?? [];
    return runs.find(r => r.polyline) ?? runs[0] ?? null;
  }, [runsData]);

  const displayName = activeProfile?.name ?? "—";
  const totalKm = useMemo(() => {
    const runs = runsData?.runs ?? [];
    if (runs.length > 0) return runs.reduce((sum, r) => sum + (r.distance_km || 0), 0);
    return activeProfile?.total_km ?? 0;
  }, [runsData, activeProfile]);
  const raceGoal = activeProfile?.race_goal ?? "—";
  const level = activeProfile?.level ?? "—";
  const maxHr = activeProfile?.max_hr ?? 195;
  const efforts = effortsData?.efforts ?? [];
  const profilePic = activeProfile?.profile_pic || activeProfile?.strava_profile_pic || "";
  const allRuns = runsData?.runs ?? [];

  const heatmapGrid = useMemo(() => {
    if (heatmapData?.heatmap && heatmapData.heatmap.length > 0) {
      return buildHeatmapGrid(heatmapData.heatmap, 24);
    }
    // Fallback: costruisci da allRuns con run_type
    const runsMap: Record<string, { date: string; km: number; runType: string }> = {};
    for (const r of (runsData?.runs ?? [])) {
      const d = r.date?.slice(0, 10);
      if (d) {
        if (!runsMap[d]) {
          runsMap[d] = { date: d, km: 0, runType: '' };
        }
        runsMap[d].km += (r.distance_km || 0);
        if (r.run_type) {
          runsMap[d].runType = r.run_type;
        }
      }
    }
    const fallback = Object.values(runsMap);
    return buildHeatmapGrid(fallback, 24);
  }, [heatmapData, runsData]);
  const zones = useMemo(() => getZones(), [maxHr]);

  const handleStravaConnect = async () => {
    try {
      const data = await getStravaAuthUrl();
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to get Strava auth URL:", err);
    }
  };

  const handleStravaSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = (await syncStrava()) as { synced?: number };
      setSyncResult(`${res.synced ?? 0} corse sincronizzate!`);
    } catch {
      setSyncResult("Errore nella sincronizzazione. Connetti prima Strava.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#121212] text-white pb-12">
      {editOpen && activeProfile && (
        <EditModal profile={activeProfile} onClose={() => setEditOpen(false)} onSaved={updated => { setProfile(updated); setEditOpen(false); }} />
      )}

      {/* Hero Section — Map of last run */}
      <div className="relative h-72">
        <HeroMap lastRun={lastRun} />
        <div className="absolute bottom-0 left-0 w-full px-8 translate-y-1/3 flex items-end justify-between">
          <div className="flex items-end gap-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-[#121212] overflow-hidden bg-[#1E1E1E] shadow-2xl">
                {profilePic ? (
                  <img src={profilePic} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-600">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-[#3B82F6] rounded-full border-4 border-[#121212] flex items-center justify-center">
                <Award className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="mb-2">
              <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">
                {loading ? <span className="animate-pulse bg-white/10 rounded w-40 h-9 inline-block" /> : displayName}
              </h1>
              <div className="flex items-center gap-4 text-gray-400 font-medium">
                {raceGoal && raceGoal !== "—" && <span className="flex items-center gap-1"><Activity className="w-4 h-4" /> {raceGoal}</span>}
                {level && level !== "—" && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {level}</span>}
                {activeProfile?.sex && <span>{activeProfile.sex === "M" ? "♂" : "♀"}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mb-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#2A2A2A] rounded-lg text-sm font-medium transition-colors">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg text-sm font-medium transition-colors">
              <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 mt-24 grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Km Totali", value: totalKm > 0 ? totalKm.toFixed(0) : "—", unit: "km", icon: Activity, color: "text-[#3B82F6]" },
              { label: "Corse", value: String(allRuns.length || "—"), unit: "", icon: Zap, color: "text-[#EAB308]" },
              { label: "FC Max", value: String(maxHr), unit: "bpm", icon: Heart, color: "text-[#F43F5E]" },
              { label: "Personal Best", value: String(efforts.length), unit: "distanze", icon: Award, color: "text-[#10B981]" },
            ].map((stat, i) => (
              <div key={i} className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-5 hover:border-[#3A3A3A] transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{stat.value}</span>
                  <span className="text-sm font-medium text-gray-500">{stat.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Consistency Heatmap */}
          {(() => {
            const flat = heatmapGrid.flat();
            const activeDays = flat.filter(d => d.km > 0).length;
            const totalDays = flat.length;
            const pct = totalDays > 0 ? Math.round((activeDays / totalDays) * 100) : 0;
            const totalKmHeat = flat.reduce((s, d) => s + d.km, 0);
            // Calcola streak corrente (giorni consecutivi con corsa, partendo da oggi all'indietro)
            const reversedFlat = [...flat].reverse();
            let currentStreak = 0;
            // Salta oggi se non ha ancora corso
            const startIdx = reversedFlat[0]?.km === 0 ? 1 : 0;
            for (let i = startIdx; i < reversedFlat.length; i++) {
              if (reversedFlat[i].km > 0) currentStreak++;
              else break;
            }
            // Best streak
            let bestStreak = 0, tempStreak = 0;
            for (const d of flat) {
              if (d.km > 0) { tempStreak++; bestStreak = Math.max(bestStreak, tempStreak); }
              else tempStreak = 0;
            }
            // Settimane attive (almeno 3 corse nella settimana)
            const activeWeeks = heatmapGrid.filter(w => w.filter(d => d.km > 0).length >= 3).length;
            // Media km nei giorni attivi
            const avgKmActive = activeDays > 0 ? totalKmHeat / activeDays : 0;
            // Giorno preferito (quale giorno della settimana corri di più)
            const dayTotals = [0, 0, 0, 0, 0, 0, 0]; // Dom-Sab
            for (const week of heatmapGrid) week.forEach((d, di) => { if (d.km > 0) dayTotals[di]++; });
            const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
            const favDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
            const favDay = dayTotals[favDayIdx] > 0 ? dayNames[favDayIdx] : "—";

            return (
              <div className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#2A2A2A] rounded-2xl p-6 relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#10B981]/3 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between mb-5 relative">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                      Running Consistency
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">La tua costanza negli ultimi 6 mesi</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-[#10B981]/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="text-xs font-bold text-[#10B981]">{activeDays} giorni</span>
                    </div>
                    <div className="bg-[#3B82F6]/10 px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-bold text-[#3B82F6]">{pct}%</span>
                    </div>
                  </div>
                </div>

                {/* Heatmap grid */}
                <div className="flex gap-[5px] overflow-x-auto pb-2 relative">
                  <div className="flex flex-col gap-[5px] justify-between text-[10px] text-gray-600 font-medium pr-2 pt-0.5 flex-shrink-0">
                    <span>Dom</span><span>Mar</span><span>Gio</span><span>Sab</span>
                  </div>
                  <div className="flex gap-[5px] flex-1">
                    {heatmapGrid.map((week, wi) => (
                      <div key={wi} className="flex flex-col gap-[5px] flex-1">
                        {week.map((day, di) => (
                          <div
                            key={di}
                            className={`aspect-square min-w-[10px] rounded-[3px] ${runTypeColor(day.runType, day.km)} ${heatmapGlow(day.km)} transition-all duration-200 hover:scale-[1.5] hover:z-10 hover:ring-1 hover:ring-white/40 cursor-pointer`}
                            title={day.km > 0 ? `${day.date}: ${day.km.toFixed(1)} km${day.runType ? ` (${day.runType})` : ''}` : day.date}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-gray-500 font-medium">
                  <span>Meno</span>
                  <div className="flex gap-1">{[0, 3, 7, 12, 25].map((km, i) => <div key={i} className={`w-3 h-3 rounded-[3px] ${heatmapColor(km)} ${heatmapGlow(km)}`} />)}</div>
                  <span>Di più</span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#2A2A2A]/60 relative">
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Streak</div>
                    <div className="text-xl font-black text-[#10B981]">{currentStreak}</div>
                    <div className="text-[10px] text-gray-600">giorni</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Best Streak</div>
                    <div className="text-xl font-black text-[#EAB308]">{bestStreak}</div>
                    <div className="text-[10px] text-gray-600">giorni</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Media/Run</div>
                    <div className="text-xl font-black text-white">{avgKmActive.toFixed(1)}</div>
                    <div className="text-[10px] text-gray-600">km</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Giorno Top</div>
                    <div className="text-xl font-black text-[#3B82F6]">{favDay}</div>
                    <div className="text-[10px] text-gray-600">{dayTotals[favDayIdx] > 0 ? `${dayTotals[favDayIdx]} corse` : ""}</div>
                  </div>
                </div>

                {/* Weekly frequency mini-bars */}
                <div className="mt-4 pt-3 border-t border-[#2A2A2A]/40 relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Frequenza per giorno</span>
                    <span className="text-[10px] text-gray-600">{activeWeeks} settimane attive su {heatmapGrid.length}</span>
                  </div>
                  <div className="flex gap-2">
                    {dayNames.map((name, i) => {
                      const count = dayTotals[i];
                      const maxCount = Math.max(...dayTotals, 1);
                      const barPct = (count / maxCount) * 100;
                      const isFav = i === favDayIdx && count > 0;
                      return (
                        <div key={name} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full h-12 bg-[#1A1A1A] rounded-lg flex items-end justify-center overflow-hidden">
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${isFav ? "bg-gradient-to-t from-[#10B981] to-[#34D399] shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-gradient-to-t from-[#10B981]/30 to-[#10B981]/50"}`}
                              style={{ height: `${Math.max(barPct, count > 0 ? 8 : 0)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-medium ${isFav ? "text-[#10B981]" : "text-gray-600"}`}>{name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ═══ Progressione del Passo ═══ */}
          {(() => {
            // Prendi le ultime 20 corse ordinate per data, con pace valido
            const paceRuns = allRuns
              .filter(r => r.avg_pace && r.distance_km >= 2 && r.date)
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-20);

            // Converti pace "M:SS" in secondi
            const parsePace = (p: string) => {
              const parts = p.split(":");
              if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
              return 0;
            };
            const fmtPace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

            const pacePoints = paceRuns.map(r => ({
              date: r.date,
              pace: parsePace(r.avg_pace),
              km: r.distance_km,
              name: r.location || "",
            })).filter(p => p.pace > 0);

            if (pacePoints.length === 0) {
              return (
                <div className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#2A2A2A] rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                    Progressione del Passo
                  </h2>
                  <p className="text-center text-gray-500 text-sm py-8">Sincronizza le tue corse per vedere la progressione</p>
                </div>
              );
            }

            const paces = pacePoints.map(p => p.pace);
            const minPace = Math.min(...paces); // Più veloce (in basso nel grafico)
            const maxPace = Math.max(...paces); // Più lento (in alto nel grafico)
            const avgPace = Math.round(paces.reduce((s, p) => s + p, 0) / paces.length);
            const bestPaceVal = minPace;
            const recentAvg = pacePoints.length >= 5
              ? Math.round(pacePoints.slice(-5).reduce((s, p) => s + p.pace, 0) / 5)
              : avgPace;
            const olderAvg = pacePoints.length >= 10
              ? Math.round(pacePoints.slice(0, 5).reduce((s, p) => s + p.pace, 0) / 5)
              : avgPace;
            const improvement = olderAvg - recentAvg; // Positivo = migliorato

            // Distribuzione distanze
            const shortRuns = allRuns.filter(r => r.distance_km > 0 && r.distance_km < 5).length;
            const medRuns = allRuns.filter(r => r.distance_km >= 5 && r.distance_km < 10).length;
            const longRuns = allRuns.filter(r => r.distance_km >= 10 && r.distance_km < 20).length;
            const ultraRuns = allRuns.filter(r => r.distance_km >= 20).length;
            const totalCat = shortRuns + medRuns + longRuns + ultraRuns || 1;


            return (
              <div className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#2A2A2A] rounded-2xl p-6 relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#8B5CF6]/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#3B82F6]/4 rounded-full blur-3xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between mb-5 relative">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                      Progressione del Passo
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Evoluzione del passo medio sulle ultime {pacePoints.length} corse</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {improvement > 0 && (
                      <div className="bg-[#10B981]/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#10B981]" />
                        <span className="text-xs font-bold text-[#10B981]">-{fmtPace(improvement)}/km</span>
                      </div>
                    )}
                    {improvement < 0 && (
                      <div className="bg-[#F43F5E]/10 px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-bold text-[#F43F5E]">+{fmtPace(-improvement)}/km</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SVG Chart */}
                <PaceProgressionChart pacePoints={pacePoints} />

                {/* Date range */}
                <div className="flex justify-between mt-1 text-[9px] text-gray-600">
                  <span>{pacePoints[0]?.date}</span>
                  <span>{pacePoints[pacePoints.length - 1]?.date}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#2A2A2A]/60 relative">
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Best Pace</div>
                    <div className="text-lg font-black text-[#EAB308]">{fmtPace(bestPaceVal)}</div>
                    <div className="text-[10px] text-gray-600">/km</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Media</div>
                    <div className="text-lg font-black text-white">{fmtPace(avgPace)}</div>
                    <div className="text-[10px] text-gray-600">/km</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Ultime 5</div>
                    <div className="text-lg font-black text-[#8B5CF6]">{fmtPace(recentAvg)}</div>
                    <div className="text-[10px] text-gray-600">/km</div>
                  </div>
                  <div className="bg-[#121212]/80 rounded-xl p-3 text-center">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Trend</div>
                    <div className={`text-lg font-black ${improvement > 0 ? "text-[#10B981]" : improvement < 0 ? "text-[#F43F5E]" : "text-gray-400"}`}>
                      {improvement > 0 ? `−${improvement}s` : improvement < 0 ? `+${-improvement}s` : "="}
                    </div>
                    <div className="text-[10px] text-gray-600">{improvement > 0 ? "più veloce" : improvement < 0 ? "più lento" : "stabile"}</div>
                  </div>
                </div>

                {/* Distribuzione distanze */}
                <div className="mt-4 pt-3 border-t border-[#2A2A2A]/40 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Distribuzione Distanze</span>
                    <span className="text-[10px] text-gray-600">{allRuns.filter(r => r.distance_km > 0).length} corse totali</span>
                  </div>
                  <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
                    {shortRuns > 0 && <div className="bg-[#3B82F6] transition-all" style={{ width: `${(shortRuns / totalCat) * 100}%` }} />}
                    {medRuns > 0 && <div className="bg-[#8B5CF6] transition-all" style={{ width: `${(medRuns / totalCat) * 100}%` }} />}
                    {longRuns > 0 && <div className="bg-[#EC4899] transition-all" style={{ width: `${(longRuns / totalCat) * 100}%` }} />}
                    {ultraRuns > 0 && <div className="bg-[#EAB308] transition-all" style={{ width: `${(ultraRuns / totalCat) * 100}%` }} />}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "< 5 km", count: shortRuns, color: "bg-[#3B82F6]" },
                      { label: "5-10 km", count: medRuns, color: "bg-[#8B5CF6]" },
                      { label: "10-20 km", count: longRuns, color: "bg-[#EC4899]" },
                      { label: "20+ km", count: ultraRuns, color: "bg-[#EAB308]" },
                    ].map((cat, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${cat.color} flex-shrink-0`} />
                        <span className="text-[10px] text-gray-400">{cat.label}</span>
                        <span className="text-[10px] font-bold text-white">{cat.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Training Zones */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Zone di Allenamento</h2>
                <p className="text-xs text-gray-500 mt-0.5">FC Max: <span className="text-white font-medium">{maxHr} bpm</span></p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <div className="space-y-3">
              {zones.map((z, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 text-center"><span className="text-xs font-bold text-gray-400">{z.zone}</span></div>
                  <div className="w-28 flex-shrink-0">
                    <div className="text-sm font-bold text-gray-200">{z.label}</div>
                  </div>
                  <div className="flex-1 h-2.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${z.bar}`} style={{ width: `${20 * (i + 1)}%` }} />
                  </div>
                  <div className="w-24 text-right text-sm font-medium text-gray-300">{z.range} <span className="text-gray-500 text-xs">bpm</span></div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#2A2A2A] grid grid-cols-4 gap-3 text-center">
              {[
                { label: "Età", value: activeProfile?.age ? `${activeProfile.age}` : "—" },
                { label: "Sesso", value: activeProfile?.sex === "M" ? "M" : activeProfile?.sex === "F" ? "F" : "—" },
                { label: "Peso", value: activeProfile?.weight_kg ? `${activeProfile.weight_kg} kg` : "—" },
                { label: "Altezza", value: activeProfile?.height_cm ? `${activeProfile.height_cm} cm` : "—" },
              ].map((s, i) => (
                <div key={i} className="bg-[#121212] rounded-xl p-3">
                  <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                  <div className="text-base font-bold text-white">{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 80/20 Rule */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Regola 80/20</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Lente (Z1-Z2 ≤ {SLOW_MAX_HR} bpm) vs Veloci (Z3-Z5 &gt; {SLOW_MAX_HR} bpm)
                </p>
              </div>
              <div className="flex bg-[#121212] rounded-lg p-0.5">
                {([7, 14] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRulePeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                      rulePeriod === p ? "bg-[#3B82F6] text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {p}g
                  </button>
                ))}
              </div>
            </div>
            <EightyTwentyRule runs={allRuns} period={rulePeriod} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Jarvis AI Toggle */}
          <div className="bg-gradient-to-br from-[#181818] to-[#141414] border border-[#2A2A2A] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#C0FF00]/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-4 relative">
              <div className="w-10 h-10 rounded-xl bg-[#C0FF00]/10 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#C0FF00]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Jarvis AI</h2>
                <p className="text-xs text-gray-500">Assistente vocale</p>
              </div>
            </div>
            <button
              onClick={() => setJarvisEnabled(!jarvisEnabled)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                jarvisEnabled
                  ? "bg-[#C0FF00]/15 border border-[#C0FF00]/30 text-[#C0FF00] hover:bg-[#C0FF00]/25"
                  : "bg-[#1E1E1E] border border-[#2A2A2A] text-gray-400 hover:text-white hover:border-[#C0FF00]/30"
              }`}
            >
              <Bot className="w-4 h-4" />
              {jarvisEnabled ? "Jarvis Attivo ✓" : "Attiva Jarvis"}
            </button>
            {jarvisEnabled && (
              <p className="text-[10px] text-gray-500 mt-3 text-center">
                Clicca di nuovo per disattivare. L'orb apparirà sulla dashboard.
              </p>
            )}
          </div>

          {/* Strava Integration */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#FC4C02]/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#FC4C02]" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Strava</h2>
            </div>
            <div className="space-y-3">
              <button onClick={handleStravaConnect} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FC4C02] hover:bg-[#E34402] rounded-xl text-sm font-bold text-white transition-colors">
                <Link2 className="w-4 h-4" /> Connetti Strava
              </button>
              <button onClick={handleStravaSync} disabled={syncing} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl text-sm font-bold text-gray-300 transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizzazione..." : "Sincronizza Corse"}
              </button>
              {syncResult && (
                <p className={`text-xs font-medium text-center ${syncResult.includes("Errore") ? "text-rose-400" : "text-emerald-400"}`}>{syncResult}</p>
              )}
            </div>
          </div>

          {/* Personal Records */}
          <div className="bg-[#181818] border border-[#2A2A2A] rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-6">Personal Records</h2>
            {efforts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                <Award className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sincronizza le tue corse per vedere i Personal Record
              </div>
            ) : (
              <div className="space-y-3">
                {efforts.map((pr, i) => (
                  <div key={i} onClick={() => pr.run_id && navigate(`/activities/${pr.run_id}`)} className="flex items-center justify-between p-3.5 bg-[#121212] border border-[#2A2A2A] rounded-xl hover:border-[#3B82F6]/50 transition-colors group cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">{pr.distance}</div>
                      <div className="text-lg font-bold text-white group-hover:text-[#3B82F6] transition-colors">{pr.time}</div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-300 mb-0.5">{pr.pace}</div>
                        <div className="text-xs text-gray-500">{pr.date}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#3B82F6] transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
