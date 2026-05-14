/**
 * Acento de marca para estilos inline: `var(--brand-color)` (rosa neón en el tema global).
 * @deprecated `NRC_GREEN` — mismo valor; nombre histórico.
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
