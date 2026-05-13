/**
 * Brand accent — apunta a la CSS custom property para que el Modo VIP Rosa
 * (y cualquier otro tema futuro) se refleje automáticamente en todos los
 * componentes que usen este valor en inline styles.
 */
export const NRC_GREEN = 'var(--brand-color)';

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
