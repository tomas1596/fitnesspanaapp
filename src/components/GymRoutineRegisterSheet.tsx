import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ExerciseCard, { type ExerciseSetRow } from '@/components/ExerciseCard';
import { cn } from '@/lib/utils';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import { parseGymRoutineWorkoutData } from '@/lib/gymRoutineWorkoutData';
import type { CrossfitLogDraft, CrossfitWodSubtype } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft } from '@/lib/functionalSessionDraft';
import {
  persistGymConditioningQuickResult,
  persistMusculacionGymRegistration,
} from '@/lib/persistWorkoutLogs';
import { useToast } from '@/hooks/use-toast';
import { modalityToLibraryCategory } from '@/lib/exerciseLibraryNaming';
import { insertMissingExerciseLibraryEntries } from '@/lib/exerciseLibrarySync';
import { insertConditioningRoutineTemplate } from '@/lib/workoutTemplatesConditioning';
import { sanitizeTimeDigitColonInput } from '@/lib/workoutNumericInput';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  dateStr: string;
  routine: Tables<'gym_routines'> | null;
  onRecorded: () => void;
  /** Precarga resultado rápido (CrossFit / Funcional en gimnasio). */
  initialQuickResult?: { resultado: string; notas: string } | null;
  variant?: 'register' | 'edit';
};

function newStrengthSetRow(sn: number): ExerciseSetRow {
  return {
    id: crypto.randomUUID(),
    set_number: sn,
    reps: 0,
    weight: 0,
    rir: 0,
    to_failure: false,
    time_seconds: 0,
    rounds: 0,
  };
}

function crossfitResultPlaceholder(subtype: CrossfitWodSubtype): string {
  switch (subtype) {
    case 'amrap':
      return 'Ej. 6 rondas o 14:30 si cronometraste tiempo total';
    case 'for_time':
      return 'Ej. 11:45 (tiempo total)';
    case 'emom':
      return 'Ej. 18:00 tiempo total o 12 si son rondas completadas';
    case 'classic_benchmark_tabata':
      return 'Ej. tiempo total o reps totales';
    default:
      return 'Tiempo o rondas';
  }
}

type MuscleLocalEx = {
  gymLineId: string;
  name: string;
  muscle_group: string;
  sets: ExerciseSetRow[];
};

export function GymRoutineRegisterSheet({
  open,
  onClose,
  userId,
  dateStr,
  routine,
  onRecorded,
  initialQuickResult = null,
  variant = 'register',
}: Props) {
  const { toast } = useToast();
  const [registering, setRegistering] = useState(false);
  const [resultado, setResultado] = useState('');
  const [notas, setNotas] = useState('');

  const [coachCf, setCoachCf] = useState<CrossfitLogDraft | null>(null);
  const [coachFn, setCoachFn] = useState<FunctionalSessionDraft | null>(null);
  const [muscleState, setMuscleState] = useState<MuscleLocalEx[]>([]);

  const modality = (routine?.modality ?? 'musculacion') as WorkoutModalityId;

  useEffect(() => {
    if (!open || !routine) {
      setResultado('');
      setNotas('');
      setCoachCf(null);
      setCoachFn(null);
      setMuscleState([]);
      return;
    }
    const parsed = parseGymRoutineWorkoutData(modality, routine.workout_data);
    if (parsed.modality === 'crossfit') {
      setCoachCf(parsed.draft);
      setCoachFn(null);
      setMuscleState([]);
    } else if (parsed.modality === 'funcional') {
      setCoachFn(parsed.draft);
      setCoachCf(null);
      setMuscleState([]);
    } else {
      setCoachCf(null);
      setCoachFn(null);
      setMuscleState(
        parsed.exercises
          .filter((e) => e.name.trim() && e.muscle_group.trim())
          .map((e) => ({
            gymLineId: e.id,
            name: e.name.trim(),
            muscle_group: e.muscle_group.trim(),
            sets: [newStrengthSetRow(1)],
          })),
      );
    }

    if (parsed.modality === 'crossfit' || parsed.modality === 'funcional') {
      if (initialQuickResult) {
        setResultado(initialQuickResult.resultado);
        setNotas(initialQuickResult.notas);
      } else {
        setResultado('');
        setNotas('');
      }
    } else {
      setResultado('');
      setNotas('');
    }
  }, [open, routine, modality, initialQuickResult]);

  const cfSubtype = coachCf?.subtype ?? null;

  const resultadoLabel = useMemo(() => {
    if (modality === 'funcional') return 'Resultado (tiempo mm:ss o rondas)';
    if (modality === 'crossfit' && cfSubtype) return `Resultado (${crossfitResultPlaceholder(cfSubtype)})`;
    return 'Resultado';
  }, [modality, cfSubtype]);

  const handleRegisterConditioning = async (target: 'crossfit' | 'funcional') => {
    if (!routine?.id) return;
    if (!resultado.trim() && !notas.trim()) {
      toast({
        title: 'Completá resultado o notas',
        description: 'Necesitamos al menos el resultado o una nota.',
        variant: 'destructive',
      });
      return;
    }

    setRegistering(true);
    try {
      const { error } = await persistGymConditioningQuickResult(supabase, {
        userId,
        dateStr,
        modality: target,
        gymRoutineId: routine.id,
        coachCrossfitDraft: target === 'crossfit' ? coachCf! : undefined,
        coachFunctionalDraft: target === 'funcional' ? coachFn! : undefined,
        resultadoText: resultado,
        notas,
      });
      if (error) throw error;

      const templateName =
        routine.title?.trim() ||
        `${target === 'crossfit' ? 'CrossFit' : 'Funcional'} · Día ${routine.day_number}`;
      const { error: tplErr } = await insertConditioningRoutineTemplate(supabase, userId, {
        name: templateName,
        modality: target,
        draft: target === 'crossfit' ? coachCf! : coachFn!,
      });
      if (tplErr) console.error('Mis Rutinas (conditioning)', tplErr);

      toast({ title: 'Resultado registrado', description: routine.title || `Día ${routine.day_number}` });
      onRecorded();
      onClose();
    } catch (e) {
      const msg =
        e != null && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error al guardar';
      toast({ title: 'No se pudo registrar', description: msg, variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  const patchMuscleSet = (
    gymLineId: string,
    setId: string,
    field: 'reps' | 'weight' | 'rir' | 'to_failure' | 'time_seconds' | 'rounds',
    value: number | boolean,
  ) => {
    setMuscleState((prev) =>
      prev.map((ex) => {
        if (ex.gymLineId !== gymLineId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
        };
      }),
    );
  };

  const addMuscleSet = (gymLineId: string) => {
    setMuscleState((prev) =>
      prev.map((ex) => {
        if (ex.gymLineId !== gymLineId) return ex;
        const nextNum = ex.sets.length + 1;
        return { ...ex, sets: [...ex.sets, newStrengthSetRow(nextNum)] };
      }),
    );
  };

  const deleteMuscleSet = (gymLineId: string, setId: string) => {
    setMuscleState((prev) =>
      prev.map((ex) => {
        if (ex.gymLineId !== gymLineId) return ex;
        const next = ex.sets.filter((s) => s.id !== setId);
        const renum = next.map((s, i) => ({ ...s, set_number: i + 1 }));
        return { ...ex, sets: renum.length ? renum : [newStrengthSetRow(1)] };
      }),
    );
  };

  const handleRegisterStrength = async () => {
    if (!routine?.id) return;

    const exercisesPayload: {
      name: string;
      muscle_group: string;
      sets: { weight: number; reps: number }[];
    }[] = [];

    for (const ex of muscleState) {
      const sets: { weight: number; reps: number }[] = [];
      for (const s of ex.sets) {
        const w = Number(s.weight);
        const r = Number(s.reps);
        if (!Number.isFinite(w) || !Number.isFinite(r) || r < 0) {
          toast({
            title: 'Series incompletas',
            description: `Completá peso y reps en todas las series de «${ex.name}».`,
            variant: 'destructive',
          });
          return;
        }
        sets.push({ weight: w, reps: Math.round(r) });
      }
      if (sets.length === 0) continue;
      exercisesPayload.push({ name: ex.name, muscle_group: ex.muscle_group, sets });
    }

    if (exercisesPayload.length === 0) {
      toast({ title: 'Sin ejercicios', variant: 'destructive' });
      return;
    }

    setRegistering(true);
    try {
      const { error } = await persistMusculacionGymRegistration(supabase, {
        userId,
        dateStr,
        wodTitle: routine.title?.trim() || `Gym · Día ${routine.day_number}`,
        exercises: exercisesPayload,
        gymRoutineId: routine.id,
      });
      if (error) throw error;

      const libEntries = exercisesPayload.map((e) => ({ name: e.name, muscle_group: e.muscle_group }));
      await insertMissingExerciseLibraryEntries(supabase, userId, libEntries, modalityToLibraryCategory('musculacion'));

      toast({ title: 'Resultado registrado', description: routine.title || `Día ${routine.day_number}` });
      onRecorded();
      onClose();
    } catch (e) {
      const msg =
        e != null && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error al guardar';
      toast({ title: 'No se pudo registrar', description: msg, variant: 'destructive' });
    } finally {
      setRegistering(false);
    }
  };

  if (!routine) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={cn(
          'flex max-h-[92vh] flex-col rounded-t-3xl border border-border/60 px-4 pb-6 pt-4',
          "[html[data-brand='pink']_&]:border-pink-800/45 [html[data-brand='pink']_&]:bg-zinc-950",
        )}
      >
        <SheetHeader className="flex-shrink-0 border-b border-border/40 pb-3 text-left">
          <SheetTitle className="text-lg font-bold tracking-tight">
            {variant === 'edit' ? 'Editar resultado' : 'Registrar'} ·{' '}
            {routine.title?.trim() || `Día ${routine.day_number}`}
          </SheetTitle>
          <p className="text-xs font-medium text-muted-foreground">{dateStr}</p>
        </SheetHeader>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {modality === 'crossfit' || modality === 'funcional' ? (
            <div className="space-y-4 pb-2">
              <p className="text-xs text-muted-foreground">
                Solo registramos tu resultado y notas; la planificación la armó tu coach.
              </p>
              <div className="space-y-2">
                <Label htmlFor="gym-res">{resultadoLabel}</Label>
                <Input
                  id="gym-res"
                  className="rounded-xl"
                  placeholder={
                    modality === 'crossfit' && cfSubtype ? crossfitResultPlaceholder(cfSubtype) : 'mm:ss o número de rondas'
                  }
                  value={resultado}
                  onChange={(e) => setResultado(sanitizeTimeDigitColonInput(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gym-notes">Notas</Label>
                <Textarea
                  id="gym-notes"
                  className="min-h-[88px] rounded-xl border-border/60"
                  placeholder="Sensaciones, escalas, parejas…"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              <p className="text-xs text-muted-foreground">
                Completá las series de cada ejercicio propuesto. Podés agregar series pero no quitar movimientos del
                plan.
              </p>
              {muscleState.map((ex) => (
                <ExerciseCard
                  key={ex.gymLineId}
                  id={ex.gymLineId}
                  name={ex.name}
                  muscleGroup={ex.muscle_group}
                  modality="musculacion"
                  sets={ex.sets}
                  hideExerciseMenu
                  onAddSet={addMuscleSet}
                  onUpdateSet={(setId, field, value) => patchMuscleSet(ex.gymLineId, setId, field, value)}
                  onDeleteSet={(setId) => deleteMuscleSet(ex.gymLineId, setId)}
                  onDeleteExercise={() => {}}
                  onRenameExercise={() => {}}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-border/40 pt-4">
          <Button
            type="button"
            disabled={
              registering ||
              (modality === 'musculacion' && muscleState.length === 0) ||
              (modality === 'crossfit' && !coachCf) ||
              (modality === 'funcional' && !coachFn)
            }
            className="h-12 w-full rounded-2xl font-semibold"
            onClick={() => {
              if (modality === 'musculacion') void handleRegisterStrength();
              else if (modality === 'crossfit') void handleRegisterConditioning('crossfit');
              else if (modality === 'funcional') void handleRegisterConditioning('funcional');
            }}
          >
            {registering ? 'Guardando…' : 'Guardar en mi bitácora'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
