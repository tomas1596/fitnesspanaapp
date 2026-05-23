import type { Tables } from '@/integrations/supabase/types';

export type GymRoutineRow = Tables<'gym_routines'>;

/** Normaliza entrada del coach: vacío → null (rutina por defecto del día). */
export function normalizeGymVariantName(raw: string): string | null {
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/** Etiqueta visible de la variante en grillas y selectores. */
export function gymVariantDisplayLabel(routine: GymRoutineRow): string {
  const variant = routine.variant_name?.trim();
  if (variant) return variant;
  return routine.title?.trim() || 'Rutina';
}

export function gymRoutinesForDay(routines: GymRoutineRow[], dayNumber: number): GymRoutineRow[] {
  return routines.filter((r) => r.day_number === dayNumber);
}

export function groupGymRoutinesByDay(routines: GymRoutineRow[]): Map<number, GymRoutineRow[]> {
  const map = new Map<number, GymRoutineRow[]>();
  for (const r of routines) {
    const list = map.get(r.day_number) ?? [];
    list.push(r);
    map.set(r.day_number, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const av = a.variant_name?.trim() ?? '';
      const bv = b.variant_name?.trim() ?? '';
      if (!av && bv) return -1;
      if (av && !bv) return 1;
      return av.localeCompare(bv, 'es') || a.title.localeCompare(b.title, 'es');
    });
  }
  return map;
}
