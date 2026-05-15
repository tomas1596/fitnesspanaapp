import type { CrossfitLogDraft, CrossfitWodSubtype } from '@/lib/crossfitWodDraft';
import { hydrateCrossfitDetails } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft, FunctionalPhaseDraft } from '@/lib/functionalSessionDraft';
import { hydrateFunctionalDetails } from '@/lib/functionalSessionDraft';

/** Segundos desde "mm:ss", "m:ss" o "h:mm:ss". */
export function parseTimeLikeToSeconds(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const norm = t.replace(',', '.');
  const parts = norm.split(':').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 || parts.length === 3) {
    const nums = parts.map((p) => Number.parseInt(p, 10));
    if (nums.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) return nums[0] * 60 + nums[1];
    return nums[0] * 3600 + nums[1] * 60 + nums[2];
  }
  return null;
}

export function stripCrossfitDraftResults(draft: CrossfitLogDraft): CrossfitLogDraft {
  const d = JSON.parse(JSON.stringify(draft)) as CrossfitLogDraft;
  switch (d.subtype) {
    case 'amrap':
      d.global_amraps_total_time = '';
      for (const b of d.blocks) b.rounds_completed = '';
      break;
    case 'for_time':
      d.final_time = '';
      break;
    case 'classic_benchmark_tabata':
      d.final_real_time = '';
      break;
    default:
      break;
  }
  return d;
}

/** Resultado del alumno sobre el borrador del coach (no modifica el cap de EMOM). */
export function applyCrossfitResultadoText(
  draft: CrossfitLogDraft,
  resultado: string,
): { draft: CrossfitLogDraft; inferredRoundCount: number | null } {
  const d = JSON.parse(JSON.stringify(draft)) as CrossfitLogDraft;
  const raw = resultado.trim();
  let inferredRoundCount: number | null = null;
  if (!raw) return { draft: d, inferredRoundCount };

  const digitOnly = /^\d+$/.test(raw);
  const n = digitOnly ? Number.parseInt(raw, 10) : NaN;

  switch (d.subtype) {
    case 'amrap':
      if (digitOnly && Number.isFinite(n)) {
        inferredRoundCount = n;
        if (d.blocks[0]) d.blocks[0].rounds_completed = String(n);
      } else {
        d.global_amraps_total_time = raw;
      }
      break;
    case 'for_time':
      d.final_time = raw;
      break;
    case 'classic_benchmark_tabata':
      d.final_real_time = raw;
      break;
    default:
      break;
  }

  return { draft: d, inferredRoundCount };
}

export function stripFunctionalDraftResults(draft: FunctionalSessionDraft): FunctionalSessionDraft {
  const d = JSON.parse(JSON.stringify(draft)) as FunctionalSessionDraft;
  d.total_session_time = '';
  for (const ph of d.phases) {
    stripFunctionalPhaseResults(ph);
  }
  return d;
}

function stripFunctionalPhaseResults(ph: FunctionalPhaseDraft): void {
  switch (ph.method) {
    case 'rounds_circuit':
      ph.round_count = '';
      break;
    case 'time_intervals':
      ph.rounds = '';
      break;
    default:
      break;
  }
}

export function applyFunctionalResultadoText(
  draft: FunctionalSessionDraft,
  resultado: string,
): { draft: FunctionalSessionDraft; inferredRoundCount: number | null } {
  const d = JSON.parse(JSON.stringify(draft)) as FunctionalSessionDraft;
  const raw = resultado.trim();
  let inferredRoundCount: number | null = null;
  if (!raw) return { draft: d, inferredRoundCount };

  const sec = parseTimeLikeToSeconds(raw);
  if (sec != null) {
    d.total_session_time = raw;
    return { draft: d, inferredRoundCount };
  }

  if (/^\d+$/.test(raw)) {
    const n = Number.parseInt(raw, 10);
    inferredRoundCount = n;
    const target = d.phases.find((p) => p.method === 'rounds_circuit');
    if (target && target.method === 'rounds_circuit') {
      target.round_count = String(n);
    } else {
      d.total_session_time = raw;
    }
    return { draft: d, inferredRoundCount };
  }

  d.total_session_time = raw;
  return { draft: d, inferredRoundCount };
}

export type GymLeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_time: string | null;
  round_count: number | null;
  work_rest_note: string | null;
  modality: string;
};

export function formatGymLeaderboardResult(row: GymLeaderboardRow): string {
  const parts: string[] = [];
  if (row.round_count != null && Number.isFinite(row.round_count)) {
    parts.push(`${row.round_count} rds`);
  }
  if (row.total_time?.trim()) parts.push(row.total_time.trim());
  if (parts.length > 0) return parts.join(' · ');
  const note = row.work_rest_note?.trim();
  if (note) return note.length > 48 ? `${note.slice(0, 45)}…` : note;
  return '—';
}

/** Orden para ranking del día (CrossFit / Funcional). */
export function sortGymLeaderboardRows(
  rows: GymLeaderboardRow[],
  modality: 'crossfit' | 'funcional',
  cfSubtype: CrossfitWodSubtype | null,
): GymLeaderboardRow[] {
  const copy = [...rows];

  const rankKey = (row: GymLeaderboardRow): [number, number, number] => {
    const timeSec = parseTimeLikeToSeconds(row.total_time ?? '') ?? Number.POSITIVE_INFINITY;
    const rounds = row.round_count ?? null;

    if (modality === 'funcional') {
      return [0, timeSec, rounds != null ? -rounds : 0];
    }

    if (cfSubtype === 'amrap') {
      const r = rounds != null ? -rounds : 0;
      return [1, r, timeSec];
    }

    return [2, timeSec, rounds != null ? -rounds : 0];
  };

  copy.sort((a, b) => {
    const ka = rankKey(a);
    const kb = rankKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  return copy;
}

/** Reconstruye resultado/notas del sheet rápido de gimnasio desde `workout_logs` guardado. */
export function deriveGymQuickResultFormFromLog(log: {
  modality: string;
  crossfit_details: unknown;
  functional_details: unknown;
  total_time: string | null;
  round_count: number | null;
  work_rest_note: string | null;
}): { resultado: string; notas: string } {
  const notas = log.work_rest_note?.trim() ?? '';
  const colFallback =
    log.round_count != null && Number.isFinite(log.round_count)
      ? String(log.round_count)
      : log.total_time?.trim() ?? '';

  if (log.modality === 'funcional') {
    const d = hydrateFunctionalDetails(log.functional_details);
    if (!d) return { resultado: colFallback, notas };
    const t = d.total_session_time.trim();
    const roundsPhase = d.phases.find((p) => p.method === 'rounds_circuit');
    const rc =
      roundsPhase && roundsPhase.method === 'rounds_circuit' ? roundsPhase.round_count.trim() : '';
    if (t) return { resultado: t, notas };
    if (/^\d+$/.test(rc)) return { resultado: rc, notas };
    return { resultado: colFallback, notas };
  }

  if (log.modality !== 'crossfit') return { resultado: colFallback, notas };

  const d = hydrateCrossfitDetails(log.crossfit_details);
  if (!d) return { resultado: colFallback, notas };

  switch (d.subtype) {
    case 'amrap': {
      const roundsFromBlock = d.blocks.map((b) => b.rounds_completed.trim()).find(Boolean) ?? '';
      const glob = d.global_amraps_total_time.trim();
      const resultado = roundsFromBlock || glob || colFallback;
      return { resultado, notas };
    }
    case 'for_time':
      return { resultado: d.final_time.trim() || colFallback, notas };
    case 'emom':
      if (log.round_count != null && Number.isFinite(log.round_count)) {
        return { resultado: String(log.round_count), notas };
      }
      return { resultado: log.total_time?.trim() || d.total_emom_time.trim() || '', notas };
    case 'classic_benchmark_tabata':
      return { resultado: d.final_real_time.trim() || colFallback, notas };
    default:
      return { resultado: colFallback, notas };
  }
}
