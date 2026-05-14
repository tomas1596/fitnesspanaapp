import { useCallback, useSyncExternalStore } from 'react';
import { getBrandThemeEventName } from '@/lib/brandTheme';

function readBrandColorHex(): string {
  if (typeof document === 'undefined') return '#39FF14';
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--brand-color').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return '#39FF14';
}

/**
 * Hex actual de `--brand-color` (sincronizado al cambiar tema de marca / foco de ventana).
 * Útil para APIs que no aceptan `var(...)` (p. ej. algunos `pathOptions` de Leaflet).
 */
export function useBrandColorHex(): string {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const ev = getBrandThemeEventName();
    window.addEventListener(ev, onStoreChange);
    window.addEventListener('focus', onStoreChange);
    return () => {
      window.removeEventListener(ev, onStoreChange);
      window.removeEventListener('focus', onStoreChange);
    };
  }, []);

  return useSyncExternalStore(subscribe, readBrandColorHex, () => '#39FF14');
}
