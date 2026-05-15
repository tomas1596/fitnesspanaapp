import type { CrossfitLogDraft } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft } from '@/lib/functionalSessionDraft';
import type { WorkoutModalityId } from '@/lib/workoutModality';

/** Valores persistentes en `exercises_library.category` */
export const EXERCISE_LIBRARY_CATEGORIES = ['Musculación', 'CrossFit', 'Funcional'] as const;
export type ExerciseLibraryCategory = (typeof EXERCISE_LIBRARY_CATEGORIES)[number];

/** `muscle_group` por defecto al guardar movimientos del WOD (sin grupo explícito). */
export const LIBRARY_CONDITIONING_MUSCLE_GROUP = 'Otros';

export function modalityToLibraryCategory(m: WorkoutModalityId): ExerciseLibraryCategory {
  switch (m) {
    case 'crossfit':
      return 'CrossFit';
    case 'funcional':
      return 'Funcional';
    default:
      return 'Musculación';
  }
}

/** Tags en `modalities[]` coherentes con `category`. */
export function modalityTagsForLibraryCategory(cat: ExerciseLibraryCategory): WorkoutModalityId[] {
  switch (cat) {
    case 'CrossFit':
      return ['crossfit'];
    case 'Funcional':
      return ['funcional'];
    default:
      return ['musculacion'];
  }
}

function pushName(acc: Map<string, string>, raw: string) {
  const t = raw.trim();
  if (!t) return;
  const key = t.toLowerCase();
  if (!acc.has(key)) acc.set(key, t);
}

export function collectCrossfitDraftManualNames(draft: CrossfitLogDraft): string[] {
  const acc = new Map<string, string>();
  if (draft.warmup_skill) {
    for (const e of draft.warmup_skill.exercises) pushName(acc, e.name);
  }
  if (draft.subtype === 'amrap') {
    for (const b of draft.blocks) {
      for (const e of b.exercises) pushName(acc, e.name);
    }
  } else {
    for (const e of draft.exercises) pushName(acc, e.name);
  }
  return [...acc.values()];
}

export function collectFunctionalDraftManualNames(draft: FunctionalSessionDraft): string[] {
  const acc = new Map<string, string>();
  for (const p of draft.phases) {
    for (const e of p.exercises) pushName(acc, e.name);
  }
  return [...acc.values()];
}
