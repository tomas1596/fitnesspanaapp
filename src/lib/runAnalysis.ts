export type LatLng = { lat: number; lng: number; t: number; alt?: number | null };

const ELEV_NOISE_M = 4;

/** Suma de ascensos (GPS), ignorando ruido entre muestras. */
export function computePositiveElevationGainM(points: LatLng[]): number {
  let sum = 0;
  let last: number | null = null;
  for (const p of points) {
    if (p.alt == null || !Number.isFinite(p.alt)) continue;
    if (last == null) {
      last = p.alt;
      continue;
    }
    const d = p.alt - last;
    if (d > ELEV_NOISE_M) {
      sum += d;
      last = p.alt;
    } else if (d < -ELEV_NOISE_M) {
      last = p.alt;
    }
  }
  return Math.round(sum);
}

/** Suavizado tipo media móvil para visualización (no altera el cálculo de distancia en vivo). */
function smoothRouteMovingAverage(points: LatLng[], radius: number): LatLng[] {
  if (points.length < 3 || radius < 1) return points;
  const n = points.length;
  const out: LatLng[] = [];
  for (let i = 0; i < n; i += 1) {
    const i0 = Math.max(0, i - radius);
    const i1 = Math.min(n - 1, i + radius);
    let slat = 0;
    let slng = 0;
    let cnt = 0;
    for (let j = i0; j <= i1; j += 1) {
      slat += points[j].lat;
      slng += points[j].lng;
      cnt += 1;
    }
    const mid = points[i];
    out.push({
      lat: slat / cnt,
      lng: slng / cnt,
      t: mid.t,
      alt: mid.alt,
    });
  }
  return out;
}

/** Ruta más fluida para polilíneas en el mapa (varias pasadas de media móvil). */
export function smoothRouteForDisplay(points: LatLng[], passes = 2, radius = 2): LatLng[] {
  if (points.length < 4) return points;
  let pts = points;
  for (let p = 0; p < passes; p += 1) {
    pts = smoothRouteMovingAverage(pts, radius);
  }
  return pts;
}

export const distM = (a: LatLng, b: LatLng) => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

export function cumulativeRouteDistancesM(points: LatLng[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + distM(points[i - 1], points[i]));
  }
  return out;
}

export function positionAtRouteDistanceM(
  points: LatLng[],
  cum: number[],
  dM: number,
): { lat: number; lng: number } | null {
  if (points.length === 0) return null;
  if (dM <= 0) return { lat: points[0].lat, lng: points[0].lng };
  const lastD = cum[cum.length - 1];
  if (dM >= lastD) {
    const p = points[points.length - 1];
    return { lat: p.lat, lng: p.lng };
  }
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < dM) i += 1;
  const d0 = cum[i];
  const d1 = cum[i + 1];
  if (d1 <= d0) return { lat: points[i].lat, lng: points[i].lng };
  const ratio = (dM - d0) / (d1 - d0);
  const a = points[i];
  const b = points[i + 1];
  return {
    lat: a.lat + ratio * (b.lat - a.lat),
    lng: a.lng + ratio * (b.lng - a.lng),
  };
}

/** Marcadores 1 km, 2 km… sobre la polilínea. */
export function getKmMilestonePositions(points: LatLng[]): { km: number; lat: number; lng: number }[] {
  if (points.length < 2) return [];
  const cum = cumulativeRouteDistancesM(points);
  const total = cum[cum.length - 1];
  const n = Math.floor(total / 1000);
  const out: { km: number; lat: number; lng: number }[] = [];
  for (let k = 1; k <= n; k += 1) {
    const pos = positionAtRouteDistanceM(points, cum, k * 1000);
    if (pos) out.push({ km: k, ...pos });
  }
  return out;
}

const timeAtDistance = (points: LatLng[], cum: number[], dM: number): number => {
  if (points.length === 0) return 0;
  if (dM <= 0) return points[0].t;
  const lastD = cum[cum.length - 1];
  if (dM >= lastD) return points[points.length - 1].t;
  let i = 0;
  while (i < cum.length - 1 && cum[i + 1] < dM) i += 1;
  const d0 = cum[i];
  const d1 = cum[i + 1];
  if (d1 <= d0) return points[i].t;
  const ratio = (dM - d0) / (d1 - d0);
  return points[i].t + ratio * (points[i + 1].t - points[i].t);
};

export type KmSplit = { km: number; paceSecPerKm: number; timeSec: number };

export function computeKmSplits(points: LatLng[]): KmSplit[] {
  if (points.length < 2) return [];
  const cum = cumulativeRouteDistancesM(points);
  const totalM = cum[cum.length - 1];
  const fullKm = Math.floor(totalM / 1000);
  const splits: KmSplit[] = [];
  for (let k = 1; k <= fullKm; k += 1) {
    const d0 = (k - 1) * 1000;
    const d1 = k * 1000;
    const t0 = timeAtDistance(points, cum, d0);
    const t1 = timeAtDistance(points, cum, d1);
    const timeSec = (t1 - t0) / 1000;
    const paceSecPerKm = timeSec > 0 ? timeSec : 0;
    splits.push({ km: k, paceSecPerKm, timeSec });
  }
  return splits;
}

export type PerfPoint = {
  distKm: number;
  paceSecPerKm: number;
  elevM: number;
};

/** Límite de puntos en la serie de rendimiento (Recharts + rutas largas). */
const MAX_PERF_CHART_POINTS = 300;

function downsamplePerfSeriesForChart(series: PerfPoint[], maxPoints: number): PerfPoint[] {
  if (series.length <= maxPoints || series.length <= 1) return series;
  const n = series.length;
  const out: PerfPoint[] = [];
  for (let j = 0; j < maxPoints; j += 1) {
    const idx = Math.round((j / (maxPoints - 1)) * (n - 1));
    out.push(series[idx]);
  }
  return out;
}

/** Pace along the route + elevation profile (linear from gain if no per-point alt). */
export function buildPerformanceSeries(
  points: LatLng[],
  elevationGainM: number | null,
): PerfPoint[] {
  if (points.length < 2) return [];
  const cum = cumulativeRouteDistancesM(points);
  const totalM = cum[cum.length - 1];
  const gain = elevationGainM != null && isFinite(elevationGainM) ? elevationGainM : 0;

  const raw: PerfPoint[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const dd = cum[i] - cum[i - 1];
    const dt = (points[i].t - points[i - 1].t) / 1000;
    let paceSecPerKm = 0;
    if (dd > 0.3 && dt > 0) paceSecPerKm = (dt / dd) * 1000;
    else paceSecPerKm = i > 1 ? raw[raw.length - 1].paceSecPerKm : 0;
    const distKm = cum[i] / 1000;
    const elevM = totalM > 0 ? (cum[i] / totalM) * gain : 0;
    raw.push({ distKm, paceSecPerKm, elevM });
  }

  const window = 3;
  const smoothed = raw.map((p, idx) => {
    let sum = 0;
    let cnt = 0;
    for (let w = -Math.floor(window / 2); w <= Math.floor(window / 2); w += 1) {
      const j = idx + w;
      if (j >= 0 && j < raw.length && raw[j].paceSecPerKm > 0) {
        sum += raw[j].paceSecPerKm;
        cnt += 1;
      }
    }
    const pace = cnt > 0 ? sum / cnt : p.paceSecPerKm;
    return { ...p, paceSecPerKm: pace > 0 ? pace : p.paceSecPerKm };
  });

  return downsamplePerfSeriesForChart(smoothed, MAX_PERF_CHART_POINTS);
}

export function fastestSplitPace(splits: KmSplit[]): number | null {
  if (splits.length === 0) return null;
  return Math.min(...splits.map((s) => s.paceSecPerKm).filter((p) => p > 0));
}

/** Lee parciales persistidos en `activities.splits` (JSON). */
export function parseStoredSplits(raw: unknown): KmSplit[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: KmSplit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (o.km == null || o.paceSecPerKm == null || o.timeSec == null) continue;
    out.push({
      km: Number(o.km),
      paceSecPerKm: Number(o.paceSecPerKm),
      timeSec: Number(o.timeSec),
    });
  }
  return out.length > 0 ? out : null;
}
