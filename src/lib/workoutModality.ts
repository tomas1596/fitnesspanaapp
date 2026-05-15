export type WorkoutModalityId = 'musculacion' | 'crossfit' | 'funcional';

export const WORKOUT_MODALITY_OPTIONS: { id: WorkoutModalityId; label: string }[] = [
  { id: 'musculacion', label: 'Musculación' },
  { id: 'crossfit', label: 'CrossFit' },
  { id: 'funcional', label: 'Funcional' },
];

export function isStrengthModality(m: WorkoutModalityId): boolean {
  return m === 'musculacion';
}

/** Biblioteca: `{}` o ausencia = mixto universal; `mixto` en array = universal. */
export function libraryMatchesModality(
  modalities: string[] | null | undefined,
  active: WorkoutModalityId,
): boolean {
  const arr = modalities ?? [];
  if (arr.length === 0) return true;
  if (arr.includes('mixto')) return true;
  return arr.includes(active);
}

export function formatDurationSec(sec: number): string {
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
  }
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export type LastPerfHint = { mode: 'strength'; weight: number; reps: number };

export type WorkoutSplitEntry = { label: string; time: string };

export function parseWorkoutSplitTimes(raw: unknown): WorkoutSplitEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item !== 'object' || item === null) return { label: '', time: '' };
    const o = item as Record<string, unknown>;
    return {
      label: typeof o.label === 'string' ? o.label : '',
      time: typeof o.time === 'string' ? o.time : '',
    };
  });
}

export type WorkoutMovementSnap = { id: string; name: string; muscle_group: string };

export function parseWorkoutMovements(raw: unknown): WorkoutMovementSnap[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkoutMovementSnap[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    const name = typeof o.name === 'string' ? o.name : '';
    const muscle_group = typeof o.muscle_group === 'string' ? o.muscle_group : '';
    if (!name.trim()) continue;
    out.push({ id, name, muscle_group });
  }
  return out;
}

export type WodBlockSectionMeta = { id: string; sort_order: number; target_time: string };

export function newConditioningBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** workout_logs.block_sections JSON */
export function parseWorkoutBlockSections(raw: unknown): WodBlockSectionMeta[] {
  if (!Array.isArray(raw)) return [];
  const out: WodBlockSectionMeta[] = [];
  let i = 0;
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id : newConditioningBlockId();
    const target_time = typeof o.target_time === 'string' ? o.target_time : '';
    const sort_order = typeof o.sort_order === 'number' ? o.sort_order : i;
    out.push({ id, target_time, sort_order });
    i++;
  }
  return out.sort((a, b) => a.sort_order - b.sort_order);
}

export type MovementBlockSnap = {
  id: string;
  target_time: string;
  movements: WorkoutMovementSnap[];
};

export type MovementSnapshotV1 = {
  schema: 'blocks_v1';
  blocks: MovementBlockSnap[];
  unassigned: WorkoutMovementSnap[];
};

export function parseMovementSnapshot(raw: unknown): MovementSnapshotV1 | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== 'blocks_v1') return null;
  const blocksRaw = o.blocks;
  const unRaw = o.unassigned;
  const blocks: MovementBlockSnap[] = [];
  if (Array.isArray(blocksRaw)) {
    for (const b of blocksRaw) {
      if (typeof b !== 'object' || b === null) continue;
      const br = b as Record<string, unknown>;
      const id = typeof br.id === 'string' ? br.id : '';
      const target_time = typeof br.target_time === 'string' ? br.target_time : '';
      const movements = parseWorkoutMovements(br.movements);
      blocks.push({ id, target_time, movements });
    }
  }
  const unassigned = Array.isArray(unRaw) ? parseWorkoutMovements(unRaw) : [];
  return { schema: 'blocks_v1', blocks, unassigned };
}

/** Lista plana (snapshot legacy) o une todos los bloques del snapshot v1 */
export function flattenMovementSnapshot(raw: unknown): WorkoutMovementSnap[] {
  const snap = parseMovementSnapshot(raw);
  if (snap) {
    const all = [...snap.unassigned];
    for (const b of snap.blocks) all.push(...b.movements);
    return all;
  }
  return parseWorkoutMovements(raw);
}
