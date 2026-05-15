import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { CrossfitLogDraft } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft } from '@/lib/functionalSessionDraft';
import { GYM_ROUTINE_DATA_VERSION, type GymRoutineWorkoutPayload } from '@/lib/gymRoutineWorkoutData';

export type WorkoutTemplateRoutineCategory = 'musculacion' | 'crossfit' | 'funcional';

export type ConditioningTemplateStoredPayload =
  | { v: typeof GYM_ROUTINE_DATA_VERSION; modality: 'crossfit'; draft: CrossfitLogDraft }
  | { v: typeof GYM_ROUTINE_DATA_VERSION; modality: 'funcional'; draft: FunctionalSessionDraft };

type Client = SupabaseClient<Database>;

export function parseConditioningTemplatePayload(raw: unknown): ConditioningTemplateStoredPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== GYM_ROUTINE_DATA_VERSION) return null;
  if (o.modality !== 'crossfit' && o.modality !== 'funcional') return null;
  if (!o.draft || typeof o.draft !== 'object') return null;
  return o as ConditioningTemplateStoredPayload;
}

export function conditioningPayloadToViewerPayload(p: ConditioningTemplateStoredPayload): GymRoutineWorkoutPayload {
  if (p.modality === 'crossfit') {
    return { v: GYM_ROUTINE_DATA_VERSION, modality: 'crossfit', draft: p.draft };
  }
  return { v: GYM_ROUTINE_DATA_VERSION, modality: 'funcional', draft: p.draft };
}

export async function insertConditioningRoutineTemplate(
  client: Client,
  userId: string,
  args: {
    name: string;
    modality: 'crossfit' | 'funcional';
    draft: CrossfitLogDraft | FunctionalSessionDraft;
  },
): Promise<{ error: Error | null }> {
  const trimmed = args.name.trim();
  if (!trimmed) return { error: new Error('Nombre vacío') };

  const payload: ConditioningTemplateStoredPayload =
    args.modality === 'crossfit'
      ? { v: GYM_ROUTINE_DATA_VERSION, modality: 'crossfit', draft: args.draft as CrossfitLogDraft }
      : { v: GYM_ROUTINE_DATA_VERSION, modality: 'funcional', draft: args.draft as FunctionalSessionDraft };

  const { error } = await client.from('workout_templates').insert({
    user_id: userId,
    name: trimmed,
    routine_category: args.modality === 'crossfit' ? 'crossfit' : 'funcional',
    structured_payload: payload as unknown as Json,
  });

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
