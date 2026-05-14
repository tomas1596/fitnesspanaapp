/**
 * Acento de marca para estilos inline: equivale al hex activo (`#39FF14` o `#FF1493`)
 * porque `applyBrandTheme` escribe `--brand-color` en el `<html>` según `profiles.theme`.
 *
 * Útil cuando las clases Tailwind `bg-primary` / `text-primary` no bastan (SVG inline, shadows, Leaflet…).
 *
 * @deprecated `NRC_GREEN` — mismo token; nombre histórico antes del tema VIP rosa.
 */
export const BRAND_COLOR = 'var(--brand-color)';
export const NRC_GREEN = BRAND_COLOR;

export const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export const fmtPace = (sPerKm: number) => {
  if (!isFinite(sPerKm) || sPerKm <= 0) return "--'--\"";
  const m = Math.floor(sPerKm / 60);
  const sec = Math.floor(sPerKm % 60);
  return `${m}'${String(sec).padStart(2, '0')}"`;
};
