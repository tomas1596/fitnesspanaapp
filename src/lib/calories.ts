/** Estimación kcal sin sensor: km × 70 × 1.03 */
export function estimateRunCalories(distanceKm: number): number {
  if (!isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.round(distanceKm * 70 * 1.03);
}

/** Pasos estimados a partir de la distancia (sin podómetro). */
export function estimateRunSteps(distanceKm: number): number {
  if (!isFinite(distanceKm) || distanceKm <= 0) return 0;
  return Math.round(distanceKm * 1450);
}
