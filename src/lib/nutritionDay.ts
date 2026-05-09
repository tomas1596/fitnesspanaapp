/** Local calendar date YYYY-MM-DD (user's timezone). */
export function todayLocalYMD(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Inclusive ISO range for a calendar day in the user's local timezone. */
export function localDayBoundsISO(ymd: string): { start: string; end: string } {
  const [y, mo, day] = ymd.split('-').map(Number);
  const start = new Date(y, mo - 1, day, 0, 0, 0, 0);
  const end = new Date(y, mo - 1, day, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}
