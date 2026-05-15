import { newConditioningBlockId, parseWorkoutBlockSections } from '@/lib/workoutModality';
import { parseManualLines, type ManualExerciseLine } from '@/lib/crossfitWodDraft';

export type FunctionalExerciseLine = ManualExerciseLine;

export const FUNCTIONAL_DETAILS_VERSION = 1 as const;

export type FunctionalPhaseType = 'warmup' | 'main' | 'core' | 'cooldown';
export type FunctionalExecutionMethod = 'free' | 'rounds_circuit' | 'time_intervals' | 'tabata';

export type FunctionalPhaseDraft =
  | {
      id: string;
      phase_type: FunctionalPhaseType;
      method: 'free';
      exercises: FunctionalExerciseLine[];
      note: string;
    }
  | {
      id: string;
      phase_type: FunctionalPhaseType;
      method: 'rounds_circuit';
      round_count: string;
      exercises: FunctionalExerciseLine[];
    }
  | {
      id: string;
      phase_type: FunctionalPhaseType;
      method: 'time_intervals';
      work_time: string;
      rest_time: string;
      rounds: string;
      exercises: FunctionalExerciseLine[];
    }
  | {
      id: string;
      phase_type: FunctionalPhaseType;
      method: 'tabata';
      exercises: FunctionalExerciseLine[];
      tabata_note: string;
    };

export interface FunctionalSessionDraft {
  session_name: string;
  total_session_time: string;
  phases: FunctionalPhaseDraft[];
}

export const FUNCTIONAL_PHASE_LABELS: { id: FunctionalPhaseType; label: string }[] = [
  { id: 'warmup', label: 'Calentamiento' },
  { id: 'main', label: 'Parte principal' },
  { id: 'core', label: 'Core' },
  { id: 'cooldown', label: 'Enfriamiento' },
];

export const FUNCTIONAL_METHOD_LABELS: { id: FunctionalExecutionMethod; label: string; short: string }[] = [
  { id: 'free', label: 'Libre', short: 'Libre' },
  { id: 'rounds_circuit', label: 'Circuito por rondas', short: 'Rondas' },
  { id: 'time_intervals', label: 'Circuito por tiempo (intervalos)', short: 'Intervalos' },
  { id: 'tabata', label: 'Tabata', short: 'Tabata' },
];

export function emptyFunctionalSessionDraft(): FunctionalSessionDraft {
  return { session_name: '', total_session_time: '', phases: [] };
}

export function emptyFunctionalPhase(method: FunctionalExecutionMethod = 'free'): FunctionalPhaseDraft {
  const id = newConditioningBlockId();
  switch (method) {
    case 'free':
      return { id, phase_type: 'main', method: 'free', exercises: [], note: '' };
    case 'rounds_circuit':
      return { id, phase_type: 'main', method: 'rounds_circuit', round_count: '', exercises: [] };
    case 'time_intervals':
      return {
        id,
        phase_type: 'main',
        method: 'time_intervals',
        work_time: '',
        rest_time: '',
        rounds: '',
        exercises: [],
      };
    case 'tabata':
      return { id, phase_type: 'main', method: 'tabata', exercises: [], tabata_note: '' };
  }
}

export function sessionHasManualExercises(d: FunctionalSessionDraft): boolean {
  return d.phases.some((p) => p.exercises.some((e) => e.name.trim()));
}

/** Subtítulo para `block_sections.target_time` (selector en tarjetas). */
export function phaseBlockSubtitle(p: FunctionalPhaseDraft): string {
  const phaseLbl = FUNCTIONAL_PHASE_LABELS.find((x) => x.id === p.phase_type)?.label ?? '';
  const methodLbl = FUNCTIONAL_METHOD_LABELS.find((x) => x.id === p.method)?.short ?? '';
  let detail = '';
  switch (p.method) {
    case 'free':
      detail = p.note.trim().slice(0, 48);
      break;
    case 'rounds_circuit':
      detail = p.round_count.trim() ? `${p.round_count.trim()} rondas` : '';
      break;
    case 'time_intervals': {
      const parts = [
        p.work_time.trim(),
        p.rest_time.trim(),
        p.rounds.trim() ? `${p.rounds.trim()} tandas` : '',
      ].filter(Boolean);
      detail = parts.join(' · ');
      break;
    }
    case 'tabata':
      detail = '20″/10″ × 8';
      break;
  }
  return [phaseLbl, methodLbl, detail].filter(Boolean).join(' · ');
}

export function deriveFunctionalBlockSections(
  draft: FunctionalSessionDraft,
): { id: string; target_time: string }[] {
  return draft.phases.map((p) => ({
    id: p.id,
    target_time: phaseBlockSubtitle(p),
  }));
}

export function serializeFunctionalDetails(draft: FunctionalSessionDraft): Record<string, unknown> {
  return {
    version: FUNCTIONAL_DETAILS_VERSION,
    session_name: draft.session_name,
    total_session_time: draft.total_session_time,
    phases: draft.phases.map(serializePhase),
  };
}

function serializePhase(p: FunctionalPhaseDraft): Record<string, unknown> {
  const base = { id: p.id, phase_type: p.phase_type, method: p.method };
  switch (p.method) {
    case 'free':
      return { ...base, exercises: p.exercises, note: p.note };
    case 'rounds_circuit':
      return { ...base, round_count: p.round_count, exercises: p.exercises };
    case 'time_intervals':
      return {
        ...base,
        work_time: p.work_time,
        rest_time: p.rest_time,
        rounds: p.rounds,
        exercises: p.exercises,
      };
    case 'tabata':
      return { ...base, exercises: p.exercises, tabata_note: p.tabata_note };
  }
}

function parsePhaseType(raw: unknown): FunctionalPhaseType {
  if (raw === 'warmup' || raw === 'main' || raw === 'core' || raw === 'cooldown') return raw;
  return 'main';
}

function parseMethod(raw: unknown): FunctionalExecutionMethod | null {
  if (raw === 'free' || raw === 'rounds_circuit' || raw === 'time_intervals' || raw === 'tabata') return raw;
  return null;
}

export function hydrateFunctionalDetails(raw: unknown): FunctionalSessionDraft | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const session_name = typeof o.session_name === 'string' ? o.session_name : '';
  const total_session_time = typeof o.total_session_time === 'string' ? o.total_session_time : '';
  const phasesRaw = o.phases;
  if (!Array.isArray(phasesRaw)) return null;
  const phases: FunctionalPhaseDraft[] = [];
  for (const pr of phasesRaw) {
    if (typeof pr !== 'object' || pr === null) continue;
    const p = pr as Record<string, unknown>;
    const id = typeof p.id === 'string' && p.id.trim() ? p.id : newConditioningBlockId();
    const phase_type = parsePhaseType(p.phase_type);
    const method = parseMethod(p.method);
    if (!method) continue;
    const exercises = parseManualLines(p.exercises);
    switch (method) {
      case 'free':
        phases.push({
          id,
          phase_type,
          method: 'free',
          exercises,
          note: typeof p.note === 'string' ? p.note : '',
        });
        break;
      case 'rounds_circuit':
        phases.push({
          id,
          phase_type,
          method: 'rounds_circuit',
          round_count: typeof p.round_count === 'string' ? p.round_count : '',
          exercises,
        });
        break;
      case 'time_intervals':
        phases.push({
          id,
          phase_type,
          method: 'time_intervals',
          work_time: typeof p.work_time === 'string' ? p.work_time : '',
          rest_time: typeof p.rest_time === 'string' ? p.rest_time : '',
          rounds: typeof p.rounds === 'string' ? p.rounds : '',
          exercises,
        });
        break;
      case 'tabata':
        phases.push({
          id,
          phase_type,
          method: 'tabata',
          exercises,
          tabata_note: typeof p.tabata_note === 'string' ? p.tabata_note : '',
        });
        break;
    }
  }
  return { session_name, total_session_time, phases };
}

export function migrateLegacyFunctionalToDraft(opts: {
  circuit_name: string | null;
  total_time: string | null;
  work_rest_note: string | null;
  round_count: number | null;
  block_sections: unknown;
}): FunctionalSessionDraft {
  const sections = parseWorkoutBlockSections(opts.block_sections);
  const session_name = opts.circuit_name ?? '';
  const total_session_time = opts.total_time ?? '';
  const globalBits = [
    opts.work_rest_note?.trim(),
    opts.round_count != null ? `Tandas: ${opts.round_count}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  if (sections.length === 0) {
    return { session_name, total_session_time, phases: [] };
  }

  const phases: FunctionalPhaseDraft[] = sections.map((sec, i) => ({
    id: sec.id,
    phase_type: 'main',
    method: 'free',
    exercises: [],
    note: [
      sec.target_time.trim() ? `Objetivo coach: ${sec.target_time}` : '',
      i === 0 ? globalBits : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  return { session_name, total_session_time, phases };
}

export function hydrateOrMigrateFunctionalDetails(
  functional_details: unknown,
  legacy: Parameters<typeof migrateLegacyFunctionalToDraft>[0],
): FunctionalSessionDraft {
  const cd =
    typeof functional_details === 'object' &&
    functional_details !== null &&
    Object.keys(functional_details as object).length > 0
      ? hydrateFunctionalDetails(functional_details)
      : null;
  if (cd) return cd;
  return migrateLegacyFunctionalToDraft(legacy);
}

export function functionalPhaseWithMethod(
  prev: FunctionalPhaseDraft,
  method: FunctionalExecutionMethod,
): FunctionalPhaseDraft {
  const exercises = prev.exercises;
  const id = prev.id;
  const phase_type = prev.phase_type;
  switch (method) {
    case 'free':
      return { id, phase_type, method: 'free', exercises, note: '' };
    case 'rounds_circuit':
      return { id, phase_type, method: 'rounds_circuit', round_count: '', exercises };
    case 'time_intervals':
      return {
        id,
        phase_type,
        method: 'time_intervals',
        work_time: '',
        rest_time: '',
        rounds: '',
        exercises,
      };
    case 'tabata':
      return { id, phase_type, method: 'tabata', exercises, tabata_note: '' };
  }
}
