export function formatCoord(value: number, digits = 5): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

/** "48.85840, 2.29450" */
export function formatLatLng(lat: number, lng: number): string {
  return `${formatCoord(lat)}, ${formatCoord(lng)}`;
}

/** "48.85840° N, 2.29450° E" */
export function formatCoordLabel(lat: number, lng: number): string {
  const latLabel = `${formatCoord(Math.abs(lat))}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngLabel = `${formatCoord(Math.abs(lng))}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latLabel}, ${lngLabel}`;
}

const RELATIVE_STEPS: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60_000, divisor: 1000, unit: 'second' },
  { limit: 3_600_000, divisor: 60_000, unit: 'minute' },
  { limit: 86_400_000, divisor: 3_600_000, unit: 'hour' },
  { limit: 604_800_000, divisor: 86_400_000, unit: 'day' },
  { limit: 2_592_000_000, divisor: 604_800_000, unit: 'week' },
  { limit: 31_536_000_000, divisor: 2_592_000_000, unit: 'month' },
  { limit: Number.POSITIVE_INFINITY, divisor: 31_536_000_000, unit: 'year' },
];

/** Human-friendly relative time, e.g. "3 days ago". */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const delta = timestamp - now;
  const abs = Math.abs(delta);
  if (abs < 45_000) return 'just now';
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const step of RELATIVE_STEPS) {
    if (abs < step.limit) {
      const value = Math.round(delta / step.divisor);
      return formatter.format(value, step.unit);
    }
  }
  return new Date(timestamp).toLocaleDateString();
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/** Clamp a zoom level into a sane range for Leaflet. */
export function clampZoom(zoom: number, min = 1, max = 19): number {
  return Math.min(max, Math.max(min, zoom));
}
