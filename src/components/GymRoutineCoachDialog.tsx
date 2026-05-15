import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CrossfitWodLogPanel } from '@/components/CrossfitWodLogPanel';
import { FunctionalSessionLogPanel } from '@/components/FunctionalSessionLogPanel';
import { ExerciseNameSuggestInput } from '@/components/ExerciseNameSuggestInput';
import { cn } from '@/lib/utils';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import { WORKOUT_MODALITY_OPTIONS } from '@/lib/workoutModality';
import {
  defaultPayloadForModality,
  emptyMusculacionExerciseLine,
  parseGymRoutineWorkoutData,
  serializeGymRoutinePayload,
  type GymRoutineMusculacionExercise,
  type GymRoutineWorkoutPayload,
} from '@/lib/gymRoutineWorkoutData';
import type { CrossfitLogDraft } from '@/lib/crossfitWodDraft';
import type { FunctionalSessionDraft } from '@/lib/functionalSessionDraft';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { insertCoachGymSnapshotTemplate } from '@/lib/coachWorkoutTemplates';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Brazos', 'Hombros', 'Core'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachProfileId: string;
  /** auth.users.id del coach (plantillas en workout_templates.user_id). */
  coachAuthUserId: string | null;
  /** Modalidades permitidas para este coach (labels del perfil). */
  gymModalities: string[];
  /** Modalidad activa en la biblioteca. */
  modality: WorkoutModalityId;
  dayNumber: number;
  /** Rutina existente o null para nueva. */
  existing: Tables<'gym_routines'> | null;
  onSaved: () => void;
  /** Rellena el editor una vez al abrir (p. ej. plantilla del coach). */
  templatePrefill?: { title: string; coach_notes: string; payload: GymRoutineWorkoutPayload } | null;
  onTemplatePrefillConsumed?: () => void;
};

function MusculacionRoutineEditor({
  exercises,
  onChange,
}: {
  exercises: GymRoutineMusculacionExercise[];
  onChange: (next: GymRoutineMusculacionExercise[]) => void;
}) {
  const patchAt = (idx: number, patch: Partial<GymRoutineMusculacionExercise>) => {
    onChange(exercises.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };

  const removeAt = (idx: number) => {
    const next = exercises.filter((_, i) => i !== idx);
    onChange(next.length ? next : [emptyMusculacionExerciseLine()]);
  };

  const addLine = () => onChange([...exercises, emptyMusculacionExerciseLine()]);

  return (
    <div className="space-y-4">
      {exercises.map((line, idx) => (
        <div
          key={line.id}
          className={cn(
            'space-y-3 rounded-xl border border-border/50 bg-card/80 p-4',
            "[html[data-brand='pink']_&]:border-pink-700/35 [html[data-brand='pink']_&]:bg-zinc-950/85",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Ejercicio {idx + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Quitar ejercicio"
              onClick={() => removeAt(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <ExerciseNameSuggestInput
            modality="musculacion"
            placeholder="Nombre"
            value={line.name}
            onChange={(v) => patchAt(idx, { name: v })}
            className="[&_input]:rounded-xl [&_input]:border-border/60"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Grupo muscular</Label>
              <Select
                value={line.muscle_group || undefined}
                onValueChange={(v) => patchAt(idx, { muscle_group: v })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Elegí grupo" />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Prescripción (opcional)</Label>
              <Input
                className="rounded-xl"
                value={line.prescription_note ?? ''}
                placeholder="Ej. 4×8 · descanso 90s"
                onChange={(e) => patchAt(idx, { prescription_note: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" className="w-full rounded-xl" onClick={addLine}>
        <Plus className="mr-2 h-4 w-4" /> Agregar ejercicio
      </Button>
    </div>
  );
}

export function GymRoutineCoachDialog({
  open,
  onOpenChange,
  coachProfileId,
  coachAuthUserId,
  gymModalities,
  modality,
  dayNumber,
  existing,
  onSaved,
  templatePrefill = null,
  onTemplatePrefillConsumed,
}: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [dayDraft, setDayDraft] = useState(dayNumber);
  const [payload, setPayload] = useState<GymRoutineWorkoutPayload>(() => defaultPayloadForModality(modality));
  const [coachNotes, setCoachNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveAlsoAsTemplate, setSaveAlsoAsTemplate] = useState(false);
  /** Evita que el efecto de «existing» borre el contenido recién aplicado desde una plantilla. */
  const skipExistingResetAfterPrefillRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setSaveAlsoAsTemplate(false);
      skipExistingResetAfterPrefillRef.current = false;
      return;
    }

    if (templatePrefill) {
      setTitle(templatePrefill.title);
      setCoachNotes(templatePrefill.coach_notes);
      setPayload(templatePrefill.payload);
      setDayDraft(dayNumber);
      skipExistingResetAfterPrefillRef.current = true;
      onTemplatePrefillConsumed?.();
      return;
    }

    if (skipExistingResetAfterPrefillRef.current) {
      return;
    }

    const row = existing;
    if (row) {
      setTitle(row.title || `Día ${dayNumber}`);
      setDayDraft(row.day_number);
      setCoachNotes(row.coach_notes ?? '');
      setPayload(parseGymRoutineWorkoutData(modality as WorkoutModalityId, row.workout_data));
    } else {
      setTitle(`Día ${dayNumber}`);
      setDayDraft(dayNumber);
      setCoachNotes('');
      setPayload(defaultPayloadForModality(modality));
    }
  }, [open, existing, dayNumber, modality, templatePrefill, onTemplatePrefillConsumed]);

  const modalityOk = useMemo(() => {
    const label = WORKOUT_MODALITY_OPTIONS.find((o) => o.id === modality)?.label;
    return label ? gymModalities.includes(label) : false;
  }, [gymModalities, modality]);

  const handleSave = async () => {
    if (!modalityOk) {
      toast({
        title: 'Modalidad no habilitada',
        description: 'Actualizá las modalidades del gimnasio en Admin o en tu perfil.',
        variant: 'destructive',
      });
      return;
    }

    let workoutPayload = payload;
    if (payload.modality === 'musculacion') {
      const filled = payload.exercises.filter((e) => e.name.trim() && e.muscle_group.trim());
      if (filled.length === 0) {
        toast({ title: 'Agregá al menos un ejercicio', variant: 'destructive' });
        return;
      }
      workoutPayload = { ...payload, exercises: filled };
    }

    setSaving(true);
    try {
      const row = {
        coach_id: coachProfileId,
        modality,
        day_number: dayDraft,
        title: title.trim() || `Día ${dayDraft}`,
        workout_data: serializeGymRoutinePayload(workoutPayload),
        coach_notes: coachNotes.trim(),
      };
      const { error } = await supabase.from('gym_routines').upsert(row, {
        onConflict: 'coach_id,modality,day_number',
      });
      if (error) throw error;

      if (saveAlsoAsTemplate && coachAuthUserId) {
        const tplRes = await insertCoachGymSnapshotTemplate(supabase, coachAuthUserId, {
          name: row.title,
          coachNotes: coachNotes.trim(),
          workoutPayload,
        });
        if (tplRes.error) {
          toast({
            title: 'Rutina guardada',
            description: `No se guardó la plantilla: ${tplRes.error.message}`,
            variant: 'destructive',
          });
        }
      }

      toast({ title: 'Rutina guardada', description: row.title });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e != null && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error';
      toast({ title: 'No se pudo guardar', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('gym_routines').delete().eq('id', existing.id);
      if (error) throw error;
      toast({ title: 'Rutina eliminada' });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e != null && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Error';
      toast({ title: 'No se pudo eliminar', description: msg, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const crossDraft = payload.modality === 'crossfit' ? payload.draft : null;
  const funcDraft = payload.modality === 'funcional' ? payload.draft : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0',
          "[html[data-brand='pink']_&]:border-pink-800/45 [html[data-brand='pink']_&]:bg-zinc-950",
        )}
      >
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle className="text-left">
            {existing ? 'Editar rutina' : 'Nueva rutina'} ·{' '}
            {WORKOUT_MODALITY_OPTIONS.find((o) => o.id === modality)?.label} · Día {dayNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gym-routine-title">Título</Label>
              <Input
                id="gym-routine-title"
                className="rounded-xl"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {!existing?.id ? (
              <div className="space-y-2">
                <Label>Día de la semana</Label>
                <Select value={String(dayDraft)} onValueChange={(v) => setDayDraft(Number.parseInt(v, 10))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Día" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Día {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {!modalityOk ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Esta modalidad no está marcada en las opciones de tu gimnasio. Podés guardar igualmente si fuiste
                habilitado recién — si falla, pedí al admin que actualice tus modalidades.
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="gym-routine-coach-notes">Instrucciones / notas del coach</Label>
              <Textarea
                id="gym-routine-coach-notes"
                className="min-h-[88px] rounded-xl"
                placeholder="Calentamiento sugerido, técnica, escalas, objetivo del día…"
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Esto se muestra destacado en la pizarra del alumno (solo lectura).
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3 dark:bg-muted/10">
              <Checkbox
                id="coach-save-as-template"
                checked={saveAlsoAsTemplate}
                disabled={!coachAuthUserId}
                onCheckedChange={(v) => setSaveAlsoAsTemplate(v === true)}
              />
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="coach-save-as-template" className="cursor-pointer text-sm font-medium leading-snug">
                  Guardar también en mis plantillas
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Copia esta rutina en tu biblioteca para reutilizarla después desde «Ver mis plantillas».
                </p>
              </div>
            </div>

            {payload.modality === 'crossfit' && crossDraft ? (
              <CrossfitWodLogPanel
                draft={crossDraft}
                showSaveButton={false}
                onSave={() => {}}
                onChange={(next: CrossfitLogDraft) =>
                  setPayload({ v: 1, modality: 'crossfit', draft: next })
                }
                onSubtypeChange={(_, next) => setPayload({ v: 1, modality: 'crossfit', draft: next })}
              />
            ) : null}

            {payload.modality === 'funcional' && funcDraft ? (
              <FunctionalSessionLogPanel
                draft={funcDraft}
                showSaveButton={false}
                onSave={() => {}}
                onChange={(next: FunctionalSessionDraft) =>
                  setPayload({ v: 1, modality: 'funcional', draft: next })
                }
              />
            ) : null}

            {payload.modality === 'musculacion' ? (
              <MusculacionRoutineEditor
                exercises={payload.exercises}
                onChange={(next) => setPayload({ v: 1, modality: 'musculacion', exercises: next })}
              />
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/50 px-5 py-4 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {existing?.id ? (
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={deleting || saving}
                onClick={() => void handleDelete()}
              >
                {deleting ? '…' : 'Eliminar'}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button type="button" className="rounded-xl" disabled={saving || deleting} onClick={() => void handleSave()}>
              {saving ? 'Guardando…' : 'Guardar rutina'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
