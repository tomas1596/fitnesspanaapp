/**
 * Envío de patrones hápticos (vibración) con fallback silencioso si no existe API.
 */

function reducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function vibrateSafe(pattern: number | number[]): void {
  if (reducedMotionPreferred()) return;
  try {
    if (typeof navigator === 'undefined') return;
    const vib = navigator.vibrate;
    if (typeof vib !== 'function') return;
    vib.call(navigator, pattern);
  } catch {
    /* sin vibración disponible */
  }
}

/** Navegación (Bottom Nav): pulsación muy sutil. */
export function hapticsNavTap(): void {
  vibrateSafe(15);
}

/** Timer: tap en Play/Pause. */
export function hapticsTimerTransport(): void {
  vibrateSafe(50);
}

/** Timer: nuevo bloque de fase (prep → trabajo, trabajo → descanso, …). Patrón distintivo. */
export function hapticsTimerPhaseAdvance(): void {
  vibrateSafe([50, 100, 50]);
}

/** Cuenta atrás antes del final de fase — corto para no molestar demasiado. */
export function hapticsTimerCountdownPulse(): void {
  vibrateSafe(35);
}

/** Acción guardada correctamente (registro gimnasio, etc.). */
export function hapticsSuccess(): void {
  vibrateSafe(100);
}
