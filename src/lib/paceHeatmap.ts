import { distM, type LatLng } from '@/lib/runAnalysis';

/** Verde neón → amarillo vivo → rojo cereza (estilo carrera). */
const RGB_GREEN: [number, number, number] = [57, 255, 20];
const RGB_YELLOW: [number, number, number] = [255, 235, 59];
const RGB_RED: [number, number, number] = [220, 20, 60];

/** Ventana fija: ritmo medio de los últimos 2 minutos (ms). */
export const PACE_ROLLING_WINDOW_MS = 120_000;

export type PaceHeatTheme = 'dark' | 'light';

function boostContrast(rgb: [number, number, number], lightMode: boolean): [number, number, number] {
  if (!lightMode) return rgb;
  return rgb.map((c) => Math.min(255, Math.round(c * 1.08 + (c > 128 ? 8 : 0)))) as [number, number, number];
}

export type PaceHeatSegment = { positions: [number, number][]; color: string };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** De verde (ritmo bajo / rápido) a rojo (ritmo alto / lento), pasando por amarillo. */
export function paceToRgb(
  pace: number,
  minP: number,
  maxP: number,
  theme: PaceHeatTheme = 'dark',
): [number, number, number] {
  const t = maxP <= minP ? 0.5 : (pace - minP) / (maxP - minP);
  const u = Math.max(0, Math.min(1, t));
  let rgb: [number, number, number];
  if (u <= 0.5) {
    const k = u * 2;
    rgb = [
      lerp(RGB_GREEN[0], RGB_YELLOW[0], k),
      lerp(RGB_GREEN[1], RGB_YELLOW[1], k),
      lerp(RGB_GREEN[2], RGB_YELLOW[2], k),
    ];
  } else {
    const k = (u - 0.5) * 2;
    rgb = [
      lerp(RGB_YELLOW[0], RGB_RED[0], k),
      lerp(RGB_YELLOW[1], RGB_RED[1], k),
      lerp(RGB_YELLOW[2], RGB_RED[2], k),
    ];
  }
  return boostContrast(rgb, theme === 'light');
}

export function paceToHexForChart(
  pace: number,
  minP: number,
  maxP: number,
  theme: PaceHeatTheme = 'light',
): string {
  const [r, g, b] = paceToRgb(pace, minP, maxP, theme);
  return rgbToHex(r, g, b);
}

function medianSegmentPace(points: LatLng[]): number {
  const paces: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const dd = distM(points[i - 1], points[i]);
    const dt = (points[i].t - points[i - 1].t) / 1000;
    if (dd > 0.5 && dt > 0) paces.push((dt / dd) * 1000);
  }
  if (paces.length === 0) return 300;
  paces.sort((a, b) => a - b);
  return paces[Math.floor(paces.length / 2)];
}

function segmentPaceSecPerKm(points: LatLng[], i: number, ref: number): number {
  const a = points[i - 1];
  const b = points[i];
  const dd = distM(a, b);
  const dt = (b.t - a.t) / 1000;
  if (dd > 0.5 && dt > 0) return (dt / dd) * 1000;
  return ref;
}

/**
 * Ritmo medio (s/km) sobre la ruta en la ventana de los últimos `windowMs`
 * milisegundos terminando en el punto `endIdx`.
 */
export function rollingAveragePaceSecPerKm(
  points: LatLng[],
  endIdx: number,
  windowMs: number = PACE_ROLLING_WINDOW_MS,
): number {
  if (endIdx < 1) return 300;
  const tEnd = points[endIdx].t;
  const tCut = tEnd - windowMs;
  let start = 0;
  for (let i = 0; i <= endIdx; i += 1) {
    if (points[i].t >= tCut) {
      start = i;
      break;
    }
  }
  let dist = 0;
  for (let i = start; i < endIdx; i += 1) {
    dist += distM(points[i], points[i + 1]);
  }
  const dtMs = points[endIdx].t - points[start].t;
  const dt = dtMs / 1000;
  const ref = medianSegmentPace(points);
  if (dist < 8 || dt < 1) {
    return segmentPaceSecPerKm(points, endIdx, ref);
  }
  return (dt / dist) * 1000;
}

/**
 * Un mini-segmento Leaflet por cada par adyacente (punto[i]→punto[i+1]),
 * color por ritmo medio móvil (últimos 2 min) en el punto final del tramo
 * (muy sensible a cambios de ritmo).
 */
export function segmentRouteByPaceGradient(
  points: LatLng[],
  refPaceSecPerKm: number,
  theme: PaceHeatTheme = 'dark',
): PaceHeatSegment[] {
  if (points.length < 2) return [];

  const ref =
    refPaceSecPerKm > 0 && isFinite(refPaceSecPerKm) ? refPaceSecPerKm : medianSegmentPace(points);

  const rollingPaces: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const p = rollingAveragePaceSecPerKm(points, i, PACE_ROLLING_WINDOW_MS);
    rollingPaces.push(Number.isFinite(p) && p > 0 ? p : segmentPaceSecPerKm(points, i, ref));
  }

  const pMin = Math.min(...rollingPaces, ref);
  const pMax = Math.max(...rollingPaces, ref);
  const span = Math.max(pMax - pMin, 4);
  /** Rango ajustado muy estrecho para que pequeños cambios de ritmo muevan el color. */
  const pad = Math.max(1, span * 0.012);
  const lo = pMin - pad;
  const hi = pMax + pad;

  const out: PaceHeatSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const pace = rollingPaces[i - 1];
    const hex = rgbToHex(...paceToRgb(pace, lo, hi, theme));
    out.push({
      positions: [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      color: hex,
    });
  }
  return out;
}
