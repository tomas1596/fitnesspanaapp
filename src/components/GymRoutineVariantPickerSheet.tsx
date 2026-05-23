import { useCallback, useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gymVariantDisplayLabel } from '@/lib/gymRoutineVariants';
import { gymRoutineExercisePreviewLine } from '@/lib/gymRoutineWorkoutData';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayNumber: number;
  routines: Tables<'gym_routines'>[];
  title?: string;
  /** Si se pasa, marca variantes con resultado registrado para la fecha activa. */
  loggedRoutineIds?: Set<string>;
  onSelect: (routine: Tables<'gym_routines'>) => void;
  /** Solo coach: crear otra variante en el mismo día. */
  onAddVariant?: () => void;
  /** Solo Panel Coach: habilita borrado rápido de variantes. */
  coachMode?: boolean;
  /** Refresco de grilla tras eliminar (ej. loadRoutines del coach). */
  onRoutinesRefresh?: () => void;
};

export function GymRoutineVariantPickerSheet({
  open,
  onOpenChange,
  dayNumber,
  routines,
  title = 'Elige tu variante para hoy',
  loggedRoutineIds,
  onSelect,
  onAddVariant,
  coachMode = false,
  onRoutinesRefresh,
}: Props) {
  const { toast } = useToast();
  const [visibleRoutines, setVisibleRoutines] = useState(routines);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setVisibleRoutines(routines);
  }, [open, routines]);

  const handleDelete = useCallback(
    async (variantId: string) => {
      if (!coachMode || deletingId) return;
      setDeletingId(variantId);
      try {
        const { error } = await supabase.from('gym_routines').delete().eq('id', variantId);
        if (error) throw error;

        const next = visibleRoutines.filter((r) => r.id !== variantId);
        setVisibleRoutines(next);
        toast({ title: 'Variante eliminada' });
        onRoutinesRefresh?.();

        if (next.length === 0) onOpenChange(false);
      } catch (e) {
        const msg =
          e != null && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error';
        toast({ title: 'No se pudo eliminar', description: msg, variant: 'destructive' });
      } finally {
        setDeletingId(null);
      }
    },
    [coachMode, deletingId, visibleRoutines, toast, onRoutinesRefresh, onOpenChange],
  );

  const isDeleting = deletingId !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'flex max-h-[70vh] flex-col gap-3 overflow-hidden rounded-t-3xl border border-border/60 px-4 pb-6 pt-4',
          "[html[data-brand='pink']_&]:border-[#ff007f]/28",
        )}
      >
        <SheetHeader className="flex-shrink-0 border-b border-border/40 pb-3 text-left">
          <SheetTitle className="text-lg font-bold tracking-tight">{title}</SheetTitle>
          <p className="text-xs font-medium text-muted-foreground">Día {dayNumber}</p>
        </SheetHeader>
        <div
          className={cn(
            'min-h-0 flex-1 space-y-2 overflow-y-auto',
            isDeleting && 'pointer-events-none opacity-60',
          )}
        >
          {visibleRoutines.map((routine) => {
            const logged = loggedRoutineIds?.has(routine.id);
            const label = gymVariantDisplayLabel(routine);
            const exercisePreview = gymRoutineExercisePreviewLine(
              routine.modality as WorkoutModalityId,
              routine.workout_data,
            );
            const rowDeleting = deletingId === routine.id;

            if (coachMode) {
              return (
                <div
                  key={routine.id}
                  className={cn(
                    'flex items-stretch gap-0 overflow-hidden rounded-2xl border',
                    logged
                      ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                      : 'border-border/50 bg-card',
                    rowDeleting && 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onSelect(routine)}
                    className={cn(
                      'flex min-w-0 flex-1 items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors active:scale-[0.98]',
                      !logged && 'hover:bg-accent/60',
                      logged && 'hover:bg-emerald-500/10',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Día {routine.day_number}</p>
                      {exercisePreview ? (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                          {exercisePreview}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    aria-label={`Eliminar ${label}`}
                    className="flex shrink-0 items-center self-stretch border-l border-border/40 p-2 text-red-500/70 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(routine.id);
                    }}
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              );
            }

            return (
              <button
                key={routine.id}
                type="button"
                onClick={() => onSelect(routine)}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors active:scale-[0.98]',
                  logged
                    ? 'border-emerald-500/40 bg-emerald-500/[0.06] hover:bg-emerald-500/10'
                    : 'border-border/50 bg-card hover:bg-accent/60',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Día {routine.day_number}</p>
                  {exercisePreview ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-400">
                      {exercisePreview}
                    </p>
                  ) : null}
                </div>
                {logged ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Registrado
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {onAddVariant ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shrink-0 rounded-2xl"
            disabled={isDeleting}
            onClick={onAddVariant}
          >
            Agregar otra variante
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
