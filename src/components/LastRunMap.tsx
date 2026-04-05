import { useMemo } from "react";
import Map, { Source, Layer, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import polylineDecode from "@mapbox/polyline";
import { MapPin, Zap, Clock, TrendingUp } from "lucide-react";
import type { Run } from "../types/api";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface LastRunMapProps {
  run: Run | null;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function LastRunMap({ run }: LastRunMapProps) {
  const { routeGeoJson, bounds, startCoord } = useMemo(() => {
    if (!run?.polyline && !run?.start_latlng) {
      return { routeGeoJson: null, bounds: null, startCoord: null };
    }

    let coordinates: [number, number][] = [];

    if (run.polyline) {
      const decoded = polylineDecode.decode(run.polyline); // [[lat, lng], ...]
      coordinates = decoded.map(([lat, lng]) => [lng, lat] as [number, number]);
    } else if (run.start_latlng) {
      const [lat, lng] = run.start_latlng;
      coordinates = [[lng, lat]];
    }

    if (coordinates.length === 0) return { routeGeoJson: null, bounds: null, startCoord: null };

    const lngs = coordinates.map((c) => c[0]);
    const lats = coordinates.map((c) => c[1]);
    const padLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 0.3, 0.003);
    const padLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.3, 0.003);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs) - padLng, Math.min(...lats) - padLat],
      [Math.max(...lngs) + padLng, Math.max(...lats) + padLat],
    ];

    const routeGeoJson =
      coordinates.length > 1
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                geometry: {
                  type: "LineString" as const,
                  coordinates,
                },
                properties: {},
              },
            ],
          }
        : null;

    return {
      routeGeoJson,
      bounds,
      startCoord: coordinates[0],
    };
  }, [run]);

  if (!run) {
    return (
      <div className="bg-bg-card border border-[#1E293B] rounded-xl flex items-center justify-center h-full">
        <div className="text-center text-text-muted">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Sincronizza corse per vedere la mappa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden h-full border border-[#1E293B]">
      {/* Map */}
      {bounds ? (
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          initialViewState={{
            bounds,
            fitBoundsOptions: { padding: 32, maxZoom: 16 },
          }}
          interactive={false}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          {/* Glow effect (background thicker line) */}
          {routeGeoJson && (
            <Source type="geojson" data={routeGeoJson}>
              <Layer
                id="route-glow"
                type="line"
                paint={{
                  "line-color": "#C0FF00",
                  "line-width": 8,
                  "line-opacity": 0.2,
                  "line-blur": 4,
                }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
              <Layer
                id="route-line"
                type="line"
                paint={{
                  "line-color": "#C0FF00",
                  "line-width": 3,
                  "line-opacity": 0.95,
                }}
                layout={{ "line-cap": "round", "line-join": "round" }}
              />
            </Source>
          )}

          {/* Start marker */}
          {startCoord && (
            <Marker longitude={startCoord[0]} latitude={startCoord[1]} anchor="center">
              <div className="w-3 h-3 rounded-full bg-[#C0FF00] border-2 border-black shadow-lg" />
            </Marker>
          )}
        </Map>
      ) : (
        <div className="w-full h-full bg-[#0F172A] flex items-center justify-center">
          <MapPin className="w-6 h-6 text-text-muted" />
        </div>
      )}

      {/* Top-left: label */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C0FF00] animate-pulse" />
        <span className="text-[10px] font-bold text-[#C0FF00] uppercase tracking-wider">Ultima Corsa</span>
      </div>

      {/* Bottom overlay: run stats */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 py-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-[#94A3B8] mb-1">
              {formatDate(run.date)}
              {run.location && <span className="ml-2 text-[#475569]">· {run.location}</span>}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-[#C0FF00]" />
                <span className="text-white font-black text-lg">{run.distance_km.toFixed(1)}</span>
                <span className="text-[#64748B] text-xs">km</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#14B8A6]" />
                <span className="text-[#14B8A6] font-bold text-sm">{run.avg_pace}/km</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#64748B]" />
                <span className="text-[#64748B] text-xs">{formatDuration(run.duration_minutes)}</span>
              </div>
              {run.avg_hr && (
                <div className="flex items-center gap-1">
                  <span className="text-[#F43F5E] text-xs">♥</span>
                  <span className="text-[#F43F5E] text-xs font-bold">{run.avg_hr} bpm</span>
                </div>
              )}
            </div>
          </div>
          {run.elevation_gain > 0 && (
            <div className="text-right">
              <div className="text-[9px] text-[#475569] uppercase tracking-wider">Dislivello</div>
              <div className="text-white text-sm font-bold">+{run.elevation_gain}m</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
