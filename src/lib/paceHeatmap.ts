import { distM, type LatLng } from '@/lib/runAnalysis';

/** Verde neón → amarillo vivo → rojo cereza (estilo carrera). */
const RGB_GREEN: [number, number, number] = [57, 255, 20];
const RGB_YELLOW: [number, number, number] = [255, 235, 59];
const RGB_RED: [number, number, number] = [220, 20, 60];

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
 * Un mini-segmento Leaflet por cada par adyacente (punto[i]→punto[i+1]),
 * color sólido por velocidad/ritmo de ese tramo (degradé continuo al unirlos).
 */
export function segmentRouteByPaceGradient(
  points: LatLng[],
  refPaceSecPerKm: number,
  theme: PaceHeatTheme = 'dark',
): PaceHeatSegment[] {
  if (points.length < 2) return [];

  const ref = refPaceSecPerKm > 0 && isFinite(refPaceSecPerKm) ? refPaceSecPerKm : medianSegmentPace(points);
  const paces: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    paces.push(segmentPaceSecPerKm(points, i, ref));
  }

  const pMin = Math.min(...paces, ref);
  const pMax = Math.max(...paces, ref);
  const pad = Math.max(3, (pMax - pMin) * 0.08);
  const lo = pMin - pad;
  const hi = pMax + pad;

  const out: PaceHeatSegment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const pace = paces[i - 1];
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
