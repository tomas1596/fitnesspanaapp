import type { Json } from '@/integrations/supabase/types';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import type { CrossfitLogDraft } from '@/lib/crossfitWodDraft';
import { emptyCrossfitDraft, hydrateOrMigrateCrossfitDetails, serializeCrossfitDetails } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft } from '@/lib/functionalSessionDraft';
import {
  emptyFunctionalSessionDraft,
  hydrateOrMigrateFunctionalDetails,
  serializeFunctionalDetails,
} from '@/lib/functionalSessionDraft';
import { newConditioningBlockId } from '@/lib/workoutModality';

export const GYM_ROUTINE_DATA_VERSION = 1 as const;

export type GymRoutineMusculacionExercise = {
  id: string;
  name: string;
  muscle_group: string;
  /** Prescripción libre (ej. 4×8 @ RPE 8). */
  prescription_note?: string;
};

export type GymRoutineWorkoutPayload =
  | { v: typeof GYM_ROUTINE_DATA_VERSION; modality: 'crossfit'; draft: CrossfitLogDraft }
  | { v: typeof GYM_ROUTINE_DATA_VERSION; modality: 'funcional'; draft: FunctionalSessionDraft }
  | { v: typeof GYM_ROUTINE_DATA_VERSION; modality: 'musculacion'; exercises: GymRoutineMusculacionExercise[] };

export function emptyMusculacionExerciseLine(): GymRoutineMusculacionExercise {
  return { id: newConditioningBlockId(), name: '', muscle_group: '', prescription_note: '' };
}

export function defaultPayloadForModality(m: WorkoutModalityId): GymRoutineWorkoutPayload {
  switch (m) {
    case 'crossfit':
      return { v: GYM_ROUTINE_DATA_VERSION, modality: 'crossfit', draft: emptyCrossfitDraft('amrap') };
    case 'funcional':
      return {
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'funcional',
        draft: emptyFunctionalSessionDraft(),
      };
    case 'musculacion':
      return {
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'musculacion',
        exercises: [emptyMusculacionExerciseLine()],
      };
    default:
      return {
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'musculacion',
        exercises: [emptyMusculacionExerciseLine()],
      };
  }
}

function reviveCrossfitDraft(raw: unknown): CrossfitLogDraft {
  return hydrateOrMigrateCrossfitDetails(raw, {
    wod_title: null,
    total_time: null,
    target_time: null,
    round_count: null,
    block_sections: [],
  });
}

function reviveFunctionalDraft(raw: unknown): FunctionalSessionDraft {
  return hydrateOrMigrateFunctionalDetails(raw, {
    circuit_name: null,
    total_time: null,
    work_rest_note: null,
    round_count: null,
    block_sections: [],
  });
}

/** Interpreta `workout_data` guardado en DB (payload completo o legacy: solo el borrador CF/Func). */
export function parseGymRoutineWorkoutData(
  modality: WorkoutModalityId,
  workout_data: Json | null | undefined,
): GymRoutineWorkoutPayload {
  const raw = workout_data as Record<string, unknown> | null | undefined;
  if (raw && typeof raw === 'object' && raw.v === GYM_ROUTINE_DATA_VERSION && typeof raw.modality === 'string') {
    const m = raw.modality as WorkoutModalityId;
    if (m === 'crossfit' && raw.draft != null) {
      return { v: GYM_ROUTINE_DATA_VERSION, modality: 'crossfit', draft: reviveCrossfitDraft(raw.draft) };
    }
    if (m === 'funcional' && raw.draft != null) {
      return { v: GYM_ROUTINE_DATA_VERSION, modality: 'funcional', draft: reviveFunctionalDraft(raw.draft) };
    }
    if (m === 'musculacion' && Array.isArray(raw.exercises)) {
      const exercises: GymRoutineMusculacionExercise[] = [];
      for (const item of raw.exercises) {
        if (typeof item !== 'object' || item === null) continue;
        const o = item as Record<string, unknown>;
        const name = typeof o.name === 'string' ? o.name : '';
        const muscle_group = typeof o.muscle_group === 'string' ? o.muscle_group : '';
        const id = typeof o.id === 'string' ? o.id : newConditioningBlockId();
        const prescription_note =
          typeof o.prescription_note === 'string' ? o.prescription_note : '';
        if (!name.trim() && !muscle_group.trim()) continue;
        exercises.push({
          id,
          name,
          muscle_group,
          prescription_note: prescription_note.trim() || undefined,
        });
      }
      return {
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'musculacion',
        exercises: exercises.length ? exercises : [emptyMusculacionExerciseLine()],
      };
    }
  }

  if (modality === 'crossfit') {
    return {
      v: GYM_ROUTINE_DATA_VERSION,
      modality: 'crossfit',
      draft: reviveCrossfitDraft(workout_data),
    };
  }
  if (modality === 'funcional') {
    return {
      v: GYM_ROUTINE_DATA_VERSION,
      modality: 'funcional',
      draft: reviveFunctionalDraft(workout_data),
    };
  }

  return defaultPayloadForModality('musculacion');
}

export function serializeGymRoutinePayload(payload: GymRoutineWorkoutPayload): Json {
  if (payload.modality === 'crossfit') {
    const canonicalDraft = serializeCrossfitDetails(payload.draft);
    return JSON.parse(
      JSON.stringify({
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'crossfit',
        draft: canonicalDraft,
      }),
    ) as Json;
  }
  if (payload.modality === 'funcional') {
    const canonicalDraft = serializeFunctionalDetails(payload.draft);
    return JSON.parse(
      JSON.stringify({
        v: GYM_ROUTINE_DATA_VERSION,
        modality: 'funcional',
        draft: canonicalDraft,
      }),
    ) as Json;
  }
  return JSON.parse(JSON.stringify(payload)) as Json;
}
