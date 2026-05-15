import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { GymRoutineWorkoutPayload } from '@/lib/gymRoutineWorkoutData';
import { serializeGymRoutinePayload } from '@/lib/gymRoutineWorkoutData';
import type { WorkoutModalityId } from '@/lib/workoutModality';

type Client = SupabaseClient<Database>;

/** Copia de rutina de gimnasio del coach en workout_templates (user_id = auth del coach). */
export async function insertCoachGymSnapshotTemplate(
  client: Client,
  coachAuthUserId: string,
  args: { name: string; coachNotes: string; workoutPayload: GymRoutineWorkoutPayload },
): Promise<{ error: Error | null }> {
  const name = args.name.trim();
  if (!name) return { error: new Error('Nombre vacío') };

  const modality = args.workoutPayload.modality as WorkoutModalityId;
  const routine_category =
    modality === 'crossfit' ? 'crossfit' : modality === 'funcional' ? 'funcional' : 'musculacion';

  const { error } = await client.from('workout_templates').insert({
    user_id: coachAuthUserId,
    name,
    routine_category,
    structured_payload: serializeGymRoutinePayload(args.workoutPayload) as Json,
    coach_notes: args.coachNotes.trim() || null,
  });

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
