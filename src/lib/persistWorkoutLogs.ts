import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';
import {
  deriveCrossfitBlockSections,
  serializeCrossfitDetails,
  deriveCrossfitTotalTimeColumn,
  crossfitWodTitle,
  type CrossfitLogDraft,
} from '@/lib/crossfitWodDraft';
import {
  deriveFunctionalBlockSections,
  serializeFunctionalDetails,
  type FunctionalSessionDraft,
} from '@/lib/functionalSessionDraft';
import { parseWorkoutBlockSections } from '@/lib/workoutModality';
import {
  applyCrossfitResultadoText,
  applyFunctionalResultadoText,
  stripCrossfitDraftResults,
  stripFunctionalDraftResults,
} from '@/lib/gymRoutineQuickResult';

async function syncConditioningMovementsToLog(client: SupabaseClient, userId: string, logId: string) {
  const { data: logMeta } = await client
    .from('workout_logs')
    .select('block_sections')
    .eq('id', logId)
    .eq('user_id', userId)
    .maybeSingle();
  const sections = parseWorkoutBlockSections(logMeta?.block_sections);

  const { data: rows } = await client
    .from('exercises')
    .select('id, name, muscle_group, conditioning_block_id')
    .eq('user_id', userId)
    .eq('workout_log_id', logId)
    .order('position');

  const sectionIds = new Set(sections.map((s) => s.id));
  const snapBlocks = sections.map((s) => ({
    id: s.id,
    target_time: s.target_time,
    movements: (rows ?? [])
      .filter((r) => r.conditioning_block_id === s.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        muscle_group: r.muscle_group,
      })),
  }));
  const unassigned = (rows ?? [])
    .filter((r) => !r.conditioning_block_id || !sectionIds.has(r.conditioning_block_id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      muscle_group: r.muscle_group,
    }));

  await client
    .from('workout_logs')
    .update({
      movements: { schema: 'blocks_v1', blocks: snapBlocks, unassigned },
    })
    .eq('id', logId)
    .eq('user_id', userId);
}

export async function upsertConditioningWorkoutLogFromDrafts(
  client: SupabaseClient,
  args: {
    userId: string;
    dateStr: string;
    modality: 'crossfit' | 'funcional';
    crossfitDraft?: CrossfitLogDraft;
    functionalDraft?: FunctionalSessionDraft;
  },
): Promise<{ data: Tables<'workout_logs'> | null; error: Error | null }> {
  const { userId, dateStr, modality } = args;
  let row: Tables<'workout_logs'>['Insert'];

  if (modality === 'crossfit') {
    const d = args.crossfitDraft!;
    const block_sections_payload = deriveCrossfitBlockSections(d).map((b, i) => ({
      id: b.id,
      sort_order: i,
      target_time: b.target_time.trim(),
    }));
    row = {
      user_id: userId,
      workout_date: dateStr,
      modality,
      gym_routine_id: null,
      total_time: deriveCrossfitTotalTimeColumn(d),
      target_time: null,
      wod_title: crossfitWodTitle(d) || null,
      round_count: null,
      split_times: [],
      block_sections: block_sections_payload,
      crossfit_details: serializeCrossfitDetails(d),
      circuit_name: null,
      work_rest_note: null,
      functional_details: {},
    };
  } else {
    const draft = args.functionalDraft!;
    row = {
      user_id: userId,
      workout_date: dateStr,
      modality,
      gym_routine_id: null,
      total_time: draft.total_session_time.trim() || null,
      target_time: null,
      wod_title: null,
      round_count: null,
      split_times: [],
      block_sections: deriveFunctionalBlockSections(draft).map((b, i) => ({
        id: b.id,
        sort_order: i,
        target_time: b.target_time.trim(),
      })),
      crossfit_details: {},
      functional_details: serializeFunctionalDetails(draft),
      circuit_name: draft.session_name.trim() || null,
      work_rest_note: null,
    };
  }

  const { data, error } = await client
    .from('workout_logs')
    .upsert(row, { onConflict: 'user_id,workout_date,modality,gym_routine_id' })
    .select()
    .single();

  if (error || !data) {
    return { data: null, error: error ?? new Error('upsert workout_logs failed') };
  }

  await client
    .from('exercises')
    .update({ workout_log_id: data.id })
    .eq('user_id', userId)
    .eq('workout_date', dateStr)
    .eq('modality', modality);

  const draftBlocks =
    modality === 'crossfit'
      ? deriveCrossfitBlockSections(args.crossfitDraft!)
      : deriveFunctionalBlockSections(args.functionalDraft!);
  const defaultBlockId = draftBlocks[0]?.id;
  if (defaultBlockId) {
    await client
      .from('exercises')
      .update({ conditioning_block_id: defaultBlockId })
      .eq('user_id', userId)
      .eq('workout_date', dateStr)
      .eq('modality', modality)
      .is('conditioning_block_id', null);
  }

  await syncConditioningMovementsToLog(client, userId, data.id);
  return { data, error: null };
}

export async function persistGymConditioningQuickResult(
  client: SupabaseClient,
  args: {
    userId: string;
    dateStr: string;
    modality: 'crossfit' | 'funcional';
    gymRoutineId: string;
    coachCrossfitDraft?: CrossfitLogDraft;
    coachFunctionalDraft?: FunctionalSessionDraft;
    resultadoText: string;
    notas: string;
  },
): Promise<{ error: Error | null }> {
  const { userId, dateStr, modality, gymRoutineId } = args;
  const notasTrim = args.notas.trim();

  let row: Tables<'workout_logs'>['Insert'];

  if (modality === 'crossfit') {
    const coach = args.coachCrossfitDraft!;
    let draft = stripCrossfitDraftResults(coach);
    const resultadoTrim = args.resultadoText.trim();
    let inferredRounds: number | null = null;
    let total_time_col: string | null = null;

    if (draft.subtype === 'emom') {
      if (/^\d+$/.test(resultadoTrim)) {
        inferredRounds = Number.parseInt(resultadoTrim, 10);
      } else if (resultadoTrim) {
        total_time_col = resultadoTrim;
      }
    } else {
      const applied = applyCrossfitResultadoText(draft, resultadoTrim);
      draft = applied.draft;
      inferredRounds = applied.inferredRoundCount;
      total_time_col = deriveCrossfitTotalTimeColumn(draft);
    }

    const block_sections_payload = deriveCrossfitBlockSections(draft).map((b, i) => ({
      id: b.id,
      sort_order: i,
      target_time: b.target_time.trim(),
    }));

    row = {
      user_id: userId,
      workout_date: dateStr,
      modality,
      total_time: total_time_col,
      target_time: null,
      wod_title: crossfitWodTitle(draft) || null,
      round_count: inferredRounds,
      split_times: [],
      block_sections: block_sections_payload,
      crossfit_details: serializeCrossfitDetails(draft),
      circuit_name: null,
      work_rest_note: notasTrim || null,
      functional_details: {},
      movements: [],
      gym_routine_id: gymRoutineId,
    };
  } else {
    let fd = stripFunctionalDraftResults(args.coachFunctionalDraft!);
    const appliedFn = applyFunctionalResultadoText(fd, args.resultadoText);
    fd = appliedFn.draft;

    row = {
      user_id: userId,
      workout_date: dateStr,
      modality,
      total_time: fd.total_session_time.trim() || null,
      target_time: null,
      wod_title: null,
      round_count: appliedFn.inferredRoundCount,
      split_times: [],
      block_sections: deriveFunctionalBlockSections(fd).map((b, i) => ({
        id: b.id,
        sort_order: i,
        target_time: b.target_time.trim(),
      })),
      crossfit_details: {},
      functional_details: serializeFunctionalDetails(fd),
      circuit_name: fd.session_name.trim() || null,
      work_rest_note: notasTrim || null,
      movements: [],
      gym_routine_id: gymRoutineId,
    };
  }

  const { error } = await client
    .from('workout_logs')
    .upsert(row, { onConflict: 'user_id,workout_date,modality,gym_routine_id' })
    .select()
    .single();

  return { error: error ?? null };
}

export async function persistMusculacionGymRegistration(
  client: SupabaseClient,
  opts: {
    userId: string;
    dateStr: string;
    wodTitle: string | null;
    exercises: { name: string; muscle_group: string; sets: { weight: number; reps: number }[] }[];
    gymRoutineId?: string | null;
  },
): Promise<{ error: Error | null }> {
  const { userId, dateStr, wodTitle, exercises } = opts;

  const insertRow: Tables<'workout_logs'>['Insert'] = {
    user_id: userId,
    workout_date: dateStr,
    modality: 'musculacion',
    total_time: null,
    target_time: null,
    wod_title: wodTitle?.trim() || null,
    round_count: null,
    split_times: [],
    block_sections: [],
    movements: [],
    circuit_name: null,
    work_rest_note: null,
    crossfit_details: {},
    functional_details: {},
    gym_routine_id: opts.gymRoutineId ?? null,
  };

  const { data: logRow, error: upsertErr } = await client
    .from('workout_logs')
    .upsert(insertRow, { onConflict: 'user_id,workout_date,modality,gym_routine_id' })
    .select('id')
    .single();

  if (upsertErr || !logRow) {
    return { error: upsertErr ?? new Error('musculacion workout_logs upsert failed') };
  }

  const logId = logRow.id;

  await client
    .from('exercises')
    .delete()
    .eq('user_id', userId)
    .eq('workout_date', dateStr)
    .eq('modality', 'musculacion')
    .eq('workout_log_id', logId);

  const movementsSynced: { id: string; name: string; muscle_group: string }[] = [];

  let pos = 0;
  for (const exRow of exercises) {
    const name = exRow.name.trim();
    const muscle_group = exRow.muscle_group.trim();
    if (!name || !muscle_group || exRow.sets.length === 0) continue;

    const { data: ex, error: exErr } = await client
      .from('exercises')
      .insert({
        user_id: userId,
        name,
        muscle_group,
        modality: 'musculacion',
        workout_date: dateStr,
        position: pos,
        workout_log_id: logId,
        conditioning_block_id: null,
      })
      .select('id')
      .single();

    if (exErr || !ex) {
      return { error: exErr ?? new Error('insert exercise failed') };
    }

    movementsSynced.push({ id: ex.id, name, muscle_group });
    pos += 1;

    let sn = 1;
    for (const s of exRow.sets) {
      const { error: setErr } = await client.from('exercise_sets').insert({
        user_id: userId,
        exercise_id: ex.id,
        set_number: sn,
        reps: Math.max(0, Math.round(s.reps)),
        weight: s.weight,
      });
      if (setErr) return { error: setErr };
      sn += 1;
    }
  }

  if (movementsSynced.length === 0) {
    return { error: new Error('sin ejercicios válidos') };
  }

  await client
    .from('workout_logs')
    .update({ movements: movementsSynced })
    .eq('id', logId)
    .eq('user_id', userId);

  return { error: null };
}
