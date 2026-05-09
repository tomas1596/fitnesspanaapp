/** NRC-style accent (fluorescent green) */
export const NRC_GREEN = '#22FF55';

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
