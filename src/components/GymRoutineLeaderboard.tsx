import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import { parseGymRoutineWorkoutData } from '@/lib/gymRoutineWorkoutData';
import type { CrossfitWodSubtype } from '@/lib/crossfitWodDraft';
import {
  formatGymLeaderboardResult,
  sortGymLeaderboardRows,
  type GymLeaderboardRow,
} from '@/lib/gymRoutineQuickResult';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${a}${b}`.toUpperCase();
}

function dedupeBestRank(sorted: GymLeaderboardRow[]): GymLeaderboardRow[] {
  const out: GymLeaderboardRow[] = [];
  const seen = new Set<string>();
  for (const r of sorted) {
    if (seen.has(r.user_id)) continue;
    seen.add(r.user_id);
    out.push(r);
  }
  return out;
}

/** Comparación estricta auth.uid ↔ fila del ranking (solo ahí se muestran editar/borrar). */
function isLeaderboardRowOwnedByViewer(rowUserId: string, viewerId: string | null): boolean {
  if (viewerId == null || viewerId === '') return false;
  const a = String(rowUserId).trim();
  const b = String(viewerId).trim();
  return a.length > 0 && b.length > 0 && a === b;
}

type Props = {
  routine: Tables<'gym_routines'>;
  workoutDate: string;
  currentUserId: string | null;
  /** Incrementar para forzar recarga tras crear/editar/eliminar resultado propio. */
  refreshNonce?: number;
  onEditOwnResult?: () => void;
  onDeleteOwnResult?: () => void;
};

export function GymRoutineLeaderboard({
  routine,
  workoutDate,
  currentUserId,
  refreshNonce = 0,
  onEditOwnResult,
  onDeleteOwnResult,
}: Props) {
  const [rows, setRows] = useState<GymLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);

  const modality = routine.modality as WorkoutModalityId;
  const cfSubtype: CrossfitWodSubtype | null =
    modality === 'crossfit'
      ? (() => {
          const p = parseGymRoutineWorkoutData('crossfit', routine.workout_data);
          return p.modality === 'crossfit' ? p.draft.subtype : null;
        })()
      : null;

  useEffect(() => {
    if (modality !== 'crossfit' && modality !== 'funcional') return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_gym_routine_leaderboard', {
          p_gym_routine_id: routine.id,
          p_workout_date: workoutDate,
        });
        if (cancelled) return;
        if (error) {
          console.error(error);
          setRows([]);
          return;
        }
        const raw = (data ?? []) as GymLeaderboardRow[];
        const ranked =
          modality === 'crossfit' || modality === 'funcional'
            ? dedupeBestRank(sortGymLeaderboardRows(raw, modality, cfSubtype))
            : [];
        setRows(ranked);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routine.id, workoutDate, modality, cfSubtype, refreshNonce]);

  if (modality !== 'crossfit' && modality !== 'funcional') return null;

  return (
    <div
      className={cn(
        'workout-gym-leaderboard flex min-h-0 flex-shrink-0 flex-col rounded-2xl border border-border/50 bg-muted/25 p-3 dark:bg-muted/15',
        "[html[data-brand='pink']_&]:border-[#ff007f]/25 dark:[html[data-brand='pink']_&]:border-pink-700/35",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Ranking del día</p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
        Misma rutina ({workoutDate}) entre quienes entrenan con tu coach.
      </p>

      {loading ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Todavía no hay resultados para esta fecha.</p>
      ) : (
        <div className="mt-2 max-h-[min(38vh,13.5rem)] overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
          <ul className="space-y-1">
            {rows.map((r, idx) => {
              const isOwnRow = isLeaderboardRowOwnedByViewer(r.user_id, currentUserId);
              const label = formatGymLeaderboardResult(r);
              const dn = r.display_name?.trim() || 'Sin nombre';
              const showActions =
                isOwnRow && (typeof onEditOwnResult === 'function' || typeof onDeleteOwnResult === 'function');
              return (
                <li
                  key={r.user_id}
                  className={cn(
                    'workout-gym-lb-row flex items-center gap-1.5 rounded-lg border border-transparent bg-card/70 px-2 py-1',
                    isOwnRow && 'workout-gym-lb-own border-primary/45 bg-primary/8',
                  )}
                >
                  <span className="w-5 shrink-0 text-center text-[10px] font-bold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="workout-gym-lb-avatar flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initialsFromName(dn)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold leading-tight text-foreground">
                      {dn}
                      {isOwnRow ? (
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-primary">Vos</span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] font-medium leading-tight text-muted-foreground">{label}</p>
                  </div>
                  {showActions ? (
                    <div className="flex shrink-0 gap-0">
                      {typeof onEditOwnResult === 'function' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                          aria-label="Editar mi resultado"
                          onClick={() => onEditOwnResult()}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {typeof onDeleteOwnResult === 'function' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive"
                          aria-label="Eliminar mi resultado"
                          onClick={() => onDeleteOwnResult()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
