import { newConditioningBlockId } from '@/lib/workoutModality';

export const CROSSFIT_DETAILS_VERSION = 1 as const;

export type CrossfitWodSubtype =
  | 'amrap'
  | 'emom'
  | 'for_time'
  | 'classic_benchmark_tabata';

export interface ManualExerciseLine {
  id: string;
  name: string;
}

/** Calentamiento general / skill antes del WOD principal (no es un «tipo» de WOD). */
export interface CrossfitWarmupSkillDraft {
  exercises: ManualExerciseLine[];
  note: string;
}

export interface AmrapBlockDraft {
  id: string;
  duration: string;
  exercises: ManualExerciseLine[];
  rounds_completed: string;
}

export type CrossfitLogDraft =
  | {
      subtype: 'amrap';
      wod_name: string;
      /** Opcional: tiempo total de los AMRAPs */
      global_amraps_total_time: string;
      blocks: AmrapBlockDraft[];
      warmup_skill: CrossfitWarmupSkillDraft | null;
    }
  | {
      subtype: 'emom';
      block_id: string;
      wod_name: string;
      total_emom_time: string;
      exercises: ManualExerciseLine[];
      warmup_skill: CrossfitWarmupSkillDraft | null;
    }
  | {
      subtype: 'for_time';
      block_id: string;
      wod_name: string;
      time_cap: string;
      rounds_to_complete: string;
      exercises: ManualExerciseLine[];
      final_time: string;
      warmup_skill: CrossfitWarmupSkillDraft | null;
    }
  | {
      subtype: 'classic_benchmark_tabata';
      block_id: string;
      wod_name: string;
      target_time: string;
      exercises: ManualExerciseLine[];
      final_real_time: string;
      warmup_skill: CrossfitWarmupSkillDraft | null;
    };

export const CROSSFIT_SUBTYPE_LABELS: { id: CrossfitWodSubtype; label: string; short: string }[] = [
  { id: 'amrap', label: 'AMRAP', short: 'AMRAP' },
  { id: 'emom', label: 'EMOM', short: 'EMOM' },
  { id: 'for_time', label: 'For Time', short: 'For Time' },
  { id: 'classic_benchmark_tabata', label: 'Clásico / Benchmark / Tabata', short: 'Clásico' },
];

function emptyManualLine(): ManualExerciseLine {
  return { id: newConditioningBlockId(), name: '' };
}

export function emptyAmrapBlock(): AmrapBlockDraft {
  return {
    id: newConditioningBlockId(),
    duration: '',
    exercises: [],
    rounds_completed: '',
  };
}

export function emptyWarmupSkillDraft(): CrossfitWarmupSkillDraft {
  return { exercises: [], note: '' };
}

export function crossfitWarmupHasContent(w: CrossfitWarmupSkillDraft | null): boolean {
  if (w === null) return false;
  return w.exercises.some((e) => e.name.trim()) || w.note.trim().length > 0;
}

export function emptyCrossfitDraft(subtype: CrossfitWodSubtype): CrossfitLogDraft {
  switch (subtype) {
    case 'amrap':
      return {
        subtype: 'amrap',
        wod_name: '',
        global_amraps_total_time: '',
        blocks: [emptyAmrapBlock()],
        warmup_skill: null,
      };
    case 'emom':
      return {
        subtype: 'emom',
        block_id: newConditioningBlockId(),
        wod_name: '',
        total_emom_time: '',
        exercises: [],
        warmup_skill: null,
      };
    case 'for_time':
      return {
        subtype: 'for_time',
        block_id: newConditioningBlockId(),
        wod_name: '',
        time_cap: '',
        rounds_to_complete: '',
        exercises: [],
        final_time: '',
        warmup_skill: null,
      };
    case 'classic_benchmark_tabata':
      return {
        subtype: 'classic_benchmark_tabata',
        block_id: newConditioningBlockId(),
        wod_name: '',
        target_time: '',
        exercises: [],
        final_real_time: '',
        warmup_skill: null,
      };
  }
}

/** Serialización persistida en workout_logs.crossfit_details */
function serializeWarmupSkillPayload(draft: CrossfitLogDraft): Record<string, unknown> {
  if (draft.warmup_skill === null) return {};
  return {
    warmup_skill: {
      exercises: draft.warmup_skill.exercises.map((e) => ({ id: e.id, name: e.name })),
      note: draft.warmup_skill.note,
    },
  };
}

export function serializeCrossfitDetails(draft: CrossfitLogDraft): Record<string, unknown> {
  const base = { version: CROSSFIT_DETAILS_VERSION, subtype: draft.subtype };
  let core: Record<string, unknown>;
  switch (draft.subtype) {
    case 'amrap':
      core = {
        ...base,
        wod_name: draft.wod_name,
        global_amraps_total_time: draft.global_amraps_total_time,
        amrap_blocks: draft.blocks.map((b) => ({
          id: b.id,
          duration: b.duration,
          exercises: b.exercises.map((e) => ({ id: e.id, name: e.name })),
          rounds_completed: b.rounds_completed,
        })),
      };
      break;
    case 'emom':
      core = {
        ...base,
        block_id: draft.block_id,
        wod_name: draft.wod_name,
        total_emom_time: draft.total_emom_time,
        exercises: draft.exercises.map((e) => ({ id: e.id, name: e.name })),
      };
      break;
    case 'for_time':
      core = {
        ...base,
        block_id: draft.block_id,
        wod_name: draft.wod_name,
        time_cap: draft.time_cap,
        rounds_to_complete: draft.rounds_to_complete,
        exercises: draft.exercises.map((e) => ({ id: e.id, name: e.name })),
        final_time: draft.final_time,
      };
      break;
    case 'classic_benchmark_tabata':
      core = {
        ...base,
        block_id: draft.block_id,
        wod_name: draft.wod_name,
        target_time: draft.target_time,
        exercises: draft.exercises.map((e) => ({ id: e.id, name: e.name })),
        final_real_time: draft.final_real_time,
      };
      break;
  }
  return { ...core, ...serializeWarmupSkillPayload(draft) };
}

export function parseManualLines(raw: unknown): ManualExerciseLine[] {
  if (!Array.isArray(raw)) return [];
  const out: ManualExerciseLine[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : newConditioningBlockId();
    const name = typeof o.name === 'string' ? o.name : '';
    out.push({ id, name });
  }
  return out;
}

function mergeWarmupIntoDraft(o: Record<string, unknown>, draft: CrossfitLogDraft): CrossfitLogDraft {
  if (!('warmup_skill' in o)) return { ...draft, warmup_skill: null };
  const rawWs = o.warmup_skill;
  if (rawWs === null || rawWs === undefined) return { ...draft, warmup_skill: null };
  if (typeof rawWs !== 'object') return { ...draft, warmup_skill: null };
  const w = rawWs as Record<string, unknown>;
  return {
    ...draft,
    warmup_skill: {
      exercises: parseManualLines(w.exercises),
      note: typeof w.note === 'string' ? w.note : '',
    },
  };
}

export function hydrateCrossfitDetails(raw: unknown): CrossfitLogDraft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const subtype = o.subtype as CrossfitWodSubtype | undefined;
  if (
    subtype !== 'amrap' &&
    subtype !== 'emom' &&
    subtype !== 'for_time' &&
    subtype !== 'classic_benchmark_tabata'
  ) {
    return null;
  }

  if (subtype === 'amrap') {
    const blocksRaw =
      Array.isArray(o.amrap_blocks) ? o.amrap_blocks : Array.isArray(o.blocks) ? o.blocks : [];
    const blocks: AmrapBlockDraft[] = [];
    for (const br of blocksRaw) {
      if (typeof br !== 'object' || br === null) continue;
      const b = br as Record<string, unknown>;
      blocks.push({
        id: typeof b.id === 'string' ? b.id : newConditioningBlockId(),
        duration: typeof b.duration === 'string' ? b.duration : '',
        exercises: parseManualLines(b.exercises),
        rounds_completed: typeof b.rounds_completed === 'string' ? b.rounds_completed : '',
      });
    }
    return mergeWarmupIntoDraft(o, {
      subtype: 'amrap',
      wod_name: typeof o.wod_name === 'string' ? o.wod_name : '',
      global_amraps_total_time:
        typeof o.global_amraps_total_time === 'string' ? o.global_amraps_total_time : '',
      blocks: blocks.length > 0 ? blocks : [emptyAmrapBlock()],
    });
  }

  if (subtype === 'emom') {
    return mergeWarmupIntoDraft(o, {
      subtype: 'emom',
      block_id: typeof o.block_id === 'string' ? o.block_id : newConditioningBlockId(),
      wod_name: typeof o.wod_name === 'string' ? o.wod_name : '',
      total_emom_time: typeof o.total_emom_time === 'string' ? o.total_emom_time : '',
      exercises: parseManualLines(o.exercises),
    });
  }

  if (subtype === 'for_time') {
    return mergeWarmupIntoDraft(o, {
      subtype: 'for_time',
      block_id: typeof o.block_id === 'string' ? o.block_id : newConditioningBlockId(),
      wod_name: typeof o.wod_name === 'string' ? o.wod_name : '',
      time_cap: typeof o.time_cap === 'string' ? o.time_cap : '',
      rounds_to_complete: typeof o.rounds_to_complete === 'string' ? o.rounds_to_complete : '',
      exercises: parseManualLines(o.exercises),
      final_time: typeof o.final_time === 'string' ? o.final_time : '',
    });
  }

  return mergeWarmupIntoDraft(o, {
    subtype: 'classic_benchmark_tabata',
    block_id: typeof o.block_id === 'string' ? o.block_id : newConditioningBlockId(),
    wod_name: typeof o.wod_name === 'string' ? o.wod_name : '',
    target_time: typeof o.target_time === 'string' ? o.target_time : '',
    exercises: parseManualLines(o.exercises),
    final_real_time: typeof o.final_real_time === 'string' ? o.final_real_time : '',
  });
}

/** Migra logs CrossFit sin crossfit_details (solo columnas legacy). */
export function migrateLegacyCrossfitToDraft(opts: {
  wod_title: string | null;
  total_time: string | null;
  target_time: string | null;
  round_count: number | null;
  block_sections: unknown;
}): CrossfitLogDraft {
  const sections = Array.isArray(opts.block_sections) ? opts.block_sections : [];

  if (sections.length > 1) {
    const blocks: AmrapBlockDraft[] = sections.map((item: unknown, idx: number) => {
      if (typeof item !== 'object' || item === null) return emptyAmrapBlock();
      const s = item as Record<string, unknown>;
      return {
        id: typeof s.id === 'string' ? s.id : newConditioningBlockId(),
        duration: typeof s.target_time === 'string' ? s.target_time : '',
        exercises: [],
        rounds_completed:
          idx === 0 && opts.round_count != null ? String(opts.round_count) : '',
      };
    });
    return {
      subtype: 'amrap',
      wod_name: opts.wod_title ?? '',
      global_amraps_total_time: opts.total_time ?? '',
      blocks: blocks.length > 0 ? blocks : [emptyAmrapBlock()],
      warmup_skill: null,
    };
  }

  const singleTarget = typeof sections[0] === 'object' && sections[0] !== null
    ? String((sections[0] as Record<string, unknown>).target_time ?? '')
    : opts.target_time ?? '';

  return {
    subtype: 'classic_benchmark_tabata',
    block_id:
      typeof sections[0] === 'object' && sections[0] !== null && typeof (sections[0] as Record<string, unknown>).id === 'string'
        ? ((sections[0] as Record<string, unknown>).id as string)
        : newConditioningBlockId(),
    wod_name: opts.wod_title ?? '',
    target_time: singleTarget,
    exercises: [],
    final_real_time: opts.total_time ?? '',
    warmup_skill: null,
  };
}

/** Corrige incoherencia si hydrateCrossfitDetails devolviera algo con legacy — usar solo cuando raw crossfit_details vacío. */
export function hydrateOrMigrateCrossfitDetails(
  crossfit_details: unknown,
  legacy: Parameters<typeof migrateLegacyCrossfitToDraft>[0],
): CrossfitLogDraft {
  const cd =
    typeof crossfit_details === 'object' &&
    crossfit_details !== null &&
    Object.keys(crossfit_details as object).length > 0
      ? hydrateCrossfitDetails(crossfit_details)
      : null;
  if (cd) return cd;
  return migrateLegacyCrossfitToDraft(legacy);
}

export function crossfitWodTitle(draft: CrossfitLogDraft): string {
  return draft.wod_name.trim();
}

/** Columna workout_logs.total_time según sub-tipo (resultados / totales visibles en listados). */
export function deriveCrossfitTotalTimeColumn(draft: CrossfitLogDraft): string | null {
  switch (draft.subtype) {
    case 'amrap':
      return draft.global_amraps_total_time.trim() || null;
    case 'emom':
      return draft.total_emom_time.trim() || null;
    case 'for_time':
      return draft.final_time.trim() || null;
    case 'classic_benchmark_tabata':
      return draft.final_real_time.trim() || null;
  }
}

export type DerivedBlockSection = { id: string; target_time: string };

export function deriveCrossfitBlockSections(draft: CrossfitLogDraft): DerivedBlockSection[] {
  switch (draft.subtype) {
    case 'amrap':
      return draft.blocks.map((b) => ({ id: b.id, target_time: b.duration }));
    case 'emom':
      return [{ id: draft.block_id, target_time: draft.total_emom_time }];
    case 'for_time':
      return [{ id: draft.block_id, target_time: draft.time_cap }];
    case 'classic_benchmark_tabata':
      return [{ id: draft.block_id, target_time: draft.target_time }];
  }
}

export { emptyManualLine };
