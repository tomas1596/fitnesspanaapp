import { differenceInYears, isValid, parseISO } from 'date-fns';

/**
 * Edad en años cumplidos respecto a hoy (zona horaria local).
 * `dob` puede ser ISO date `YYYY-MM-DD` o `Date`.
 */
export function calculateAge(dob: string | Date | null | undefined): number | null {
  if (dob == null || dob === '') return null;
  const d = typeof dob === 'string' ? parseISO(dob.length <= 10 ? `${dob}T12:00:00` : dob) : dob;
  if (!isValid(d)) return null;
  return differenceInYears(new Date(), d);
}
