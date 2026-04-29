/**
 * Pace / time / duration formatting helpers.
 *
 * Extracted from DashboardView so any view can format pace consistently
 * without duplicating tiny parsers. Pure functions, no React.
 */

/** "5:42" → 342 (sec/km). Returns 0 on bad input. */
export function parsePaceToSecs(pace: string): number {
  if (!pace) return 0;
  const parts = pace.split(':');
  if (parts.length !== 2) return 0;
  const m = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  if (isNaN(m) || isNaN(s)) return 0;
  return m * 60 + s;
}

/** 342 → "5:42". Returns "--" on non-positive input. */
export function secsToPaceStr(secs: number): string {
  if (secs <= 0) return '--';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse "h:mm:ss" or "mm:ss" → seconds. Returns null on bad input. */
export function hmsToSecs(s: string): number | null {
  if (!s) return null;
  const parts = s.split(':').map((x) => parseInt(x, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** 75.5 → "1h 15m". Minutes input. */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** 25.42 minutes → "25:25" or "1:23:45". For PB / race time displays. */
export function fmtPbTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.round((minutes * 60) % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
