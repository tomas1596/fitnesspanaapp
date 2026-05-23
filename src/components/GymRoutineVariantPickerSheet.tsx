import { Check } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { gymVariantDisplayLabel } from '@/lib/gymRoutineVariants';
import { gymRoutineExercisePreviewLine } from '@/lib/gymRoutineWorkoutData';
import type { WorkoutModalityId } from '@/lib/workoutModality';

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
}: Props) {
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
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {routines.map((routine) => {
            const logged = loggedRoutineIds?.has(routine.id);
            const label = gymVariantDisplayLabel(routine);
            const exercisePreview = gymRoutineExercisePreviewLine(
              routine.modality as WorkoutModalityId,
              routine.workout_data,
            );
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
          <Button type="button" variant="outline" className="h-11 w-full shrink-0 rounded-2xl" onClick={onAddVariant}>
            Agregar otra variante
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
