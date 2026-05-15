import {
  differenceInCalendarDays,
  differenceInHours,
  format,
  formatDistanceToNow,
  isToday,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';

export type ActivityDotTone = 'live' | 'idle' | 'stale' | 'none';

/** Ventana Admin: menor a este lapso desde last_active_at ⇒ "En Línea". */
export const ADMIN_ONLINE_WINDOW_MS = 3 * 60 * 1000;

/** `true` si `raw` existe y está dentro de `maxAgeMs` respecto a `reference`. */
export function isActivityWithinAge(
  raw: string | null | undefined,
  maxAgeMs: number,
  reference: Date,
): boolean {
  if (!raw) return false;
  try {
    const d = parseISO(raw);
    if (!Number.isFinite(d.getTime())) return false;
    const elapsed = reference.getTime() - d.getTime();
    const skewAllowanceMs = 30_000;
    if (elapsed < -skewAllowanceMs) return false;
    return elapsed < maxAgeMs;
  } catch {
    return false;
  }
}

/** Texto amigable (es) para admins. */
export function formatLastActiveLabel(raw: string | null | undefined): string {
  if (!raw) return 'Sin registro';
  try {
    const d = parseISO(raw);
    if (!Number.isFinite(d.getTime())) return 'Sin registro';
    if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true, locale: es });
    const days = differenceInCalendarDays(new Date(), d);
    if (days <= 7) return formatDistanceToNow(d, { addSuffix: true, locale: es });
    return format(d, 'd MMM yyyy', { locale: es });
  } catch {
    return 'Sin registro';
  }
}

/** Estado visual: <24 h verde, 24 h–7 d gris, ≥7 d rojizo; sin fecha neutro. */
export function lastActiveDotTone(raw: string | null | undefined): ActivityDotTone {
  if (!raw) return 'none';
  try {
    const d = parseISO(raw);
    if (!Number.isFinite(d.getTime())) return 'none';
    const h = differenceInHours(new Date(), d);
    if (h < 0) return 'idle';
    if (h < 24) return 'live';
    const days = differenceInCalendarDays(new Date(), d);
    if (days >= 7) return 'stale';
    return 'idle';
  } catch {
    return 'none';
  }
}

export function compareLastActive(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 'recent' | 'oldest',
): number {
  const ts = (v: string | null | undefined) => {
    if (!v) return null;
    const t = parseISO(v).getTime();
    return Number.isFinite(t) ? t : null;
  };
  const va = ts(a);
  const vb = ts(b);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  const cmp = vb - va;
  return direction === 'recent' ? cmp : -cmp;
}
