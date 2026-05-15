import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Play, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { GymRoutineBlockViewer } from '@/components/GymRoutineBlockViewer';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import {
  parseGymRoutineWorkoutData,
  type GymRoutineWorkoutPayload,
} from '@/lib/gymRoutineWorkoutData';
import type { WorkoutTemplateRoutineCategory } from '@/lib/workoutTemplatesConditioning';
import { newConditioningBlockId } from '@/lib/workoutModality';

interface CoachTemplateRow {
  id: string;
  name: string;
  routine_category: WorkoutTemplateRoutineCategory;
  structured_payload: Json | null;
  coach_notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Modalidad activa en la biblioteca del panel (pestaña inicial del picker). */
  libraryModalityFilter: WorkoutModalityId;
  onApply: (data: { title: string; coach_notes: string; payload: GymRoutineWorkoutPayload }) => void;
}

function routineCategoryFromWorkoutModality(m: WorkoutModalityId): WorkoutTemplateRoutineCategory {
  if (m === 'crossfit') return 'crossfit';
  if (m === 'funcional') return 'funcional';
  return 'musculacion';
}

export function CoachTemplatePickerSheet({
  open,
  onClose,
  libraryModalityFilter,
  onApply,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<CoachTemplateRow[]>([]);
  const [routineListCategory, setRoutineListCategory] =
    useState<WorkoutTemplateRoutineCategory>('musculacion');
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selected, setSelected] = useState<CoachTemplateRow | null>(null);
  const [resolvedPayload, setResolvedPayload] = useState<GymRoutineWorkoutPayload | null>(null);
  const [resolving, setResolving] = useState(false);

  const loadTemplates = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workout_templates')
      .select('id, name, routine_category, structured_payload, coach_notes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'No se pudieron cargar plantillas', description: error.message, variant: 'destructive' });
      setTemplates([]);
      return;
    }
    const mapped: CoachTemplateRow[] = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      routine_category:
        row.routine_category === 'crossfit' || row.routine_category === 'funcional'
          ? row.routine_category
          : 'musculacion',
      structured_payload: row.structured_payload ?? null,
      coach_notes: row.coach_notes ?? null,
    }));
    setTemplates(mapped);
  };

  useEffect(() => {
    if (open) {
      void loadTemplates();
      setView('list');
      setSelected(null);
      setResolvedPayload(null);
      setRoutineListCategory(routineCategoryFromWorkoutModality(libraryModalityFilter));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id, libraryModalityFilter]);

  const filteredTemplates = templates.filter((t) => t.routine_category === routineListCategory);

  const routineCategoryTabCls = (cat: WorkoutTemplateRoutineCategory) =>
    cn(
      'flex-1 rounded-lg py-2 text-xs font-semibold transition-colors',
      routineListCategory === cat ? 'text-black' : 'bg-transparent text-muted-foreground',
    );

  const openTemplateDetail = async (t: CoachTemplateRow) => {
    setSelected(t);
    setView('detail');
    setResolving(true);
    setResolvedPayload(null);
    try {
      if (t.structured_payload) {
        const p = parseGymRoutineWorkoutData(t.routine_category as WorkoutModalityId, t.structured_payload);
        setResolvedPayload(p);
        setResolving(false);
        return;
      }
      if (t.routine_category === 'musculacion') {
        const { data: rows } = await supabase
          .from('template_exercises')
          .select('name, muscle_group, position')
          .eq('template_id', t.id)
          .order('position');
        const exercises = (rows || []).map((r) => ({
          id: newConditioningBlockId(),
          name: String(r.name ?? ''),
          muscle_group: String(r.muscle_group ?? ''),
        }));
        setResolvedPayload({
          v: 1,
          modality: 'musculacion',
          exercises: exercises.length ? exercises : [{ id: newConditioningBlockId(), name: '', muscle_group: '' }],
        });
      } else {
        toast({
          title: 'Plantilla incompleta',
          description: 'Esta plantilla no tiene datos para previsualizar.',
          variant: 'destructive',
        });
        setResolvedPayload(null);
      }
    } catch {
      setResolvedPayload(null);
    } finally {
      setResolving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('workout_templates').delete().eq('id', id);
    void loadTemplates();
    setView('list');
    setSelected(null);
    setResolvedPayload(null);
  };

  const handleApply = () => {
    if (!selected || !resolvedPayload) return;
    onApply({
      title: selected.name.trim(),
      coach_notes: selected.coach_notes?.trim() ?? '',
      payload: resolvedPayload,
    });
    onClose();
  };

  const previewPayload = useMemo(() => resolvedPayload, [resolvedPayload]);

  const routinesTitle = view === 'list' ? 'Mis plantillas' : selected?.name ?? '';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-none bg-background p-5"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-left text-xl text-foreground">
            {view !== 'list' && (
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  setSelected(null);
                  setResolvedPayload(null);
                }}
                className="rounded-lg p-1 hover:bg-accent"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {routinesTitle}
          </SheetTitle>
        </SheetHeader>

        {view === 'list' && (
          <div className="space-y-3">
            <div
              className="flex gap-1 rounded-2xl bg-card p-1"
              style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)' }}
            >
              {(['musculacion', 'crossfit', 'funcional'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={routineCategoryTabCls(cat)}
                  style={routineListCategory === cat ? { backgroundColor: 'var(--brand-color)' } : {}}
                  onClick={() => setRoutineListCategory(cat)}
                >
                  {cat === 'musculacion' ? 'Musculación' : cat === 'crossfit' ? 'CrossFit' : 'Funcional'}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredTemplates.length === 0 && (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  No hay plantillas en esta categoría. Marcá «Guardar también en mis plantillas» al guardar una rutina.
                </p>
              )}
              {filteredTemplates.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-xl bg-card p-3">
                  <button
                    type="button"
                    onClick={() => void openTemplateDetail(t)}
                    className="flex flex-1 items-center justify-between text-left"
                  >
                    <span className="font-medium text-foreground">{t.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTemplate(t.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'detail' && selected ? (
          <div className="space-y-3">
            {selected.coach_notes?.trim() ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-foreground">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Notas / instrucciones
                </p>
                <p className="whitespace-pre-wrap">{selected.coach_notes.trim()}</p>
              </div>
            ) : null}

            <div className="max-h-[min(52vh,520px)] overflow-y-auto rounded-xl border border-border/40 bg-background/80 p-2">
              {resolving ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cargando vista previa…</p>
              ) : previewPayload ? (
                <GymRoutineBlockViewer
                  payload={previewPayload}
                  title={selected.name}
                  dayNumber={1}
                  hideDayBanner
                  hideCoachNotesSection
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Sin datos para mostrar.</p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleApply}
              disabled={!resolvedPayload || resolving}
              className="h-14 w-full rounded-2xl border-0 bg-primary text-base font-semibold text-primary-foreground shadow-none hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
            >
              <Play className="mr-2 h-4 w-4" /> Aplicar al editor
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
