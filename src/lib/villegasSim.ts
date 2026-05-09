import type { LatLng } from '@/lib/runAnalysis';

/** Centro aproximado General Villegas (Buenos Aires). */
export const VILLEGAS_CENTER = { lat: -35.033, lng: -63.013 };

/** ~20 puntos por km (uno cada 50 m). */
const STEP_METERS = 50;
const STEPS_PER_KM = 20;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

function toDeg(r: number) {
  return (r * 180) / Math.PI;
}

/** Punto a distancia `distanceM` y rumbo `bearingDeg` (0 = N) desde (lat, lng). */
export function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceM: number) {
  const R = 6371000;
  const br = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);
  const δ = distanceM / R;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(br));
  const λ2 = λ1 + Math.atan2(Math.sin(br) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

/** Ritmo aleatorio entre 4'30'' y 6'00'' por km (inclusive). */
export function randomPaceSecPerKmVillegas(): number {
  return 270 + Math.floor(Math.random() * 91);
}

/**
 * Genera exactamente 1 km de puntos GPS: 20 pasos de 50 m con `t` (ms) creciente.
 * Variación leve de ritmo por paso y rumbo que se desvía para evitar línea recta.
 */
export function generateVillegasKmExtension(origin: LatLng, paceSecThisKm: number): LatLng[] {
  let bearingDeg = Math.random() * 360;
  const out: LatLng[] = [];
  let cur = { lat: origin.lat, lng: origin.lng, t: origin.t };

  for (let step = 0; step < STEPS_PER_KM; step += 1) {
    const paceJitter = 1 + (Math.random() - 0.5) * 0.12;
    const dtMs = (paceSecThisKm * 1000 * (1 / STEPS_PER_KM)) * paceJitter;
    bearingDeg += (Math.random() - 0.5) * 5;

    const dest = destinationPoint(cur.lat, cur.lng, bearingDeg, STEP_METERS);
    cur = {
      lat: dest.lat,
      lng: dest.lng,
      t: cur.t + dtMs,
    };
    out.push(cur);
  }

  return out;
}

export function randomSeedNearVillegas(): LatLng {
  return {
    lat: VILLEGAS_CENTER.lat + (Math.random() - 0.5) * 0.018,
    lng: VILLEGAS_CENTER.lng + (Math.random() - 0.5) * 0.018,
    t: Date.now(),
  };
}
