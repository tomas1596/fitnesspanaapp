import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import {
  LIBRARY_CONDITIONING_MUSCLE_GROUP,
  modalityTagsForLibraryCategory,
  type ExerciseLibraryCategory,
} from '@/lib/exerciseLibraryNaming';

type Client = SupabaseClient<Database>;

/** Inserta sólo ejercicios cuyo nombre (case-insensitive) aún no está en biblioteca para el usuario. */
export async function insertMissingExerciseLibraryEntries(
  client: Client,
  userId: string,
  entries: { name: string; muscle_group: string }[],
  category: ExerciseLibraryCategory,
): Promise<void> {
  const uniq = new Map<string, { name: string; muscle_group: string }>();
  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    const mg = String(e.muscle_group ?? '').trim() || LIBRARY_CONDITIONING_MUSCLE_GROUP;
    uniq.set(name.toLowerCase(), { name, muscle_group: mg });
  }
  if (uniq.size === 0) return;

  const { data: have } = await client.from('exercises_library').select('name').eq('user_id', userId);

  const haveSet = new Set((have ?? []).map((r) => r.name.trim().toLowerCase()).filter(Boolean));
  const toInsert = [...uniq.values()].filter((e) => !haveSet.has(e.name.toLowerCase()));
  if (toInsert.length === 0) return;

  const tags = modalityTagsForLibraryCategory(category);
  const { error } = await client.from('exercises_library').insert(
    toInsert.map((e) => ({
      user_id: userId,
      name: e.name,
      muscle_group: e.muscle_group,
      category,
      modalities: tags,
    })),
  );
  if (error) console.error('exercises_library insert', error);
}
