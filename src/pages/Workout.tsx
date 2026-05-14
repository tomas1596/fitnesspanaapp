import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, ChevronLeft, ChevronRight,
  Calendar as CalendarIcon, Library, FileText, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ExerciseCard from '@/components/ExerciseCard';
import DailyReportSheet from '@/components/DailyReportSheet';
import TemplatesSheet from '@/components/TemplatesSheet';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExerciseSet {
  id: string;
  set_number: number;
  reps: number;
  weight: number;
  rir: number;
  to_failure: boolean;
}

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  sets: ExerciseSet[];
}

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Brazos', 'Hombros', 'Core'];
const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

const Workout = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [calOpen, setCalOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [enableEmptyDay, setEnableEmptyDay] = useState(false);

  // Inline add form
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  // Names already in the library (lower-cased for comparison)
  const [libraryNamesLower, setLibraryNamesLower] = useState<Set<string>>(new Set());

  // History hints per exercise name
  const [lastPerfMap, setLastPerfMap] = useState<Record<string, { weight: number; reps: number }>>({});

  // Which exercise should auto-focus its weight input
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const dateStr = formatDateISO(selectedDate);
  const todayStr = formatDateISO(new Date());
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

  const formattedDate = selectedDate.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const goDay = (offset: number) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset);
      return d;
    });
    setEnableEmptyDay(false);
  };

  // ── Fetch last performances for a list of exercise names ──────────────────
  const fetchLastPerformances = useCallback(
    async (names: string[]): Promise<Record<string, { weight: number; reps: number }>> => {
      if (!user || names.length === 0) return {};
      const { data: exData } = await supabase
        .from('exercises')
        .select('id, name, workout_date')
        .eq('user_id', user.id)
        .in('name', names)
        .lt('workout_date', dateStr)          // only past sessions
        .order('workout_date', { ascending: false });

      if (!exData?.length) return {};

      const latestIdByName = new Map<string, string>();
      for (const ex of exData) {
        if (!latestIdByName.has(ex.name)) latestIdByName.set(ex.name, ex.id);
      }

      const ids = [...latestIdByName.values()];
      const { data: setsData } = await supabase
        .from('exercise_sets')
        .select('exercise_id, weight, reps')
        .in('exercise_id', ids)
        .order('set_number', { ascending: false });

      const result: Record<string, { weight: number; reps: number }> = {};
      for (const [name, exId] of latestIdByName.entries()) {
        const lastSet = setsData?.find((s) => s.exercise_id === exId);
        if (lastSet && (lastSet.weight > 0 || lastSet.reps > 0)) {
          result[name] = { weight: Number(lastSet.weight), reps: lastSet.reps };
        }
      }
      return result;
    },
    [user, dateStr],
  );

  // ── Fetch exercises for the selected date ─────────────────────────────────
  const fetchExercises = useCallback(async () => {
    if (!user) return;
    const { data: exercisesData, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_date', dateStr)
      .order('position');
    if (error) { console.error(error); setHydrated(true); return; }

    const exercisesWithSets: Exercise[] = [];
    for (const ex of exercisesData || []) {
      const { data: setsData } = await supabase
        .from('exercise_sets').select('*').eq('exercise_id', ex.id).order('set_number');
      exercisesWithSets.push({
        id: ex.id, name: ex.name, muscle_group: ex.muscle_group,
        sets: (setsData || []).map((s) => ({
          id: s.id, set_number: s.set_number, reps: s.reps, weight: Number(s.weight),
          rir: s.rir ?? 0, to_failure: s.to_failure ?? false,
        })),
      });
    }
    setExercises(exercisesWithSets);
    setHydrated(true);

    // Load history for today's exercises
    if (exercisesWithSets.length > 0) {
      const names = [...new Set(exercisesWithSets.map((e) => e.name))];
      fetchLastPerformances(names).then(setLastPerfMap);
    }
  }, [user, dateStr, fetchLastPerformances]);

  useEffect(() => { setHydrated(false); fetchExercises(); }, [fetchExercises]);

  const fetchActiveDates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('exercises').select('workout_date').eq('user_id', user.id);
    setActiveDates(new Set((data || []).map((d) => d.workout_date)));
  }, [user]);

  // fetchActiveDates is called explicitly after every add/delete that touches the DB.
  // Depending on exercises.length was unreliable: it fired *before* the DB write completed.
  useEffect(() => { fetchActiveDates(); }, [fetchActiveDates]);

  // Keep a fast Set of library names for checkbox visibility check
  const fetchLibraryNames = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('exercises_library')
      .select('name')
      .eq('user_id', user.id);
    setLibraryNamesLower(new Set((data || []).map((r) => r.name.toLowerCase())));
  }, [user]);

  useEffect(() => { fetchLibraryNames(); }, [fetchLibraryNames]);

  // ── Trigger auto-focus (reset after 1.5 s so re-adding a set later won't re-focus) ──
  const triggerFocus = (exerciseId: string) => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    setFocusExerciseId(exerciseId);
    focusTimerRef.current = setTimeout(() => setFocusExerciseId(null), 1500);
  };

  // ── Add exercise from inline form ─────────────────────────────────────────
  const confirmAddExercise = async () => {
    if (!user || !newExName.trim() || !newExGroup) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Exercise = {
      id: tempId, name: newExName.trim(), muscle_group: newExGroup, sets: [],
    };
    setExercises((prev) => [...prev, optimistic]);

    const name = newExName.trim();
    const group = newExGroup;
    const shouldSave = saveToLibrary;
    setNewExName(''); setNewExGroup(''); setAddingExercise(false);

    const { data, error } = await supabase.from('exercises').insert({
      user_id: user.id, name, muscle_group: group,
      workout_date: dateStr, position: exercises.length,
    }).select().single();

    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      return;
    }

    setExercises((prev) => prev.map((e) => e.id === tempId ? { ...e, id: data.id } : e));
    fetchActiveDates();

    // Save to library if requested (upsert to avoid duplicate errors)
    if (shouldSave) {
      supabase.from('exercises_library').upsert(
        { user_id: user.id, name, muscle_group: group },
        { onConflict: 'user_id,name' },
      ).then(() => fetchLibraryNames());
    }

    // Refresh history for this exercise name
    fetchLastPerformances([name]).then((perf) =>
      setLastPerfMap((prev) => ({ ...prev, ...perf })),
    );

    // Auto-add first set and focus weight
    await addSet(data.id);
    triggerFocus(data.id);
  };

  // ── Add exercise from library ─────────────────────────────────────────────
  const handleAddExerciseFromLibrary = async (name: string, muscleGroup: string) => {
    if (!user) return;
    setEnableEmptyDay(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Exercise = { id: tempId, name, muscle_group: muscleGroup, sets: [] };
    setExercises((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from('exercises').insert({
      user_id: user.id, name, muscle_group: muscleGroup,
      workout_date: dateStr, position: exercises.length,
    }).select().single();

    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      return;
    }

    setExercises((prev) => prev.map((e) => e.id === tempId ? { ...e, id: data.id } : e));
    fetchActiveDates();

    // Refresh history for the added exercise
    fetchLastPerformances([name]).then((perf) =>
      setLastPerfMap((prev) => ({ ...prev, ...perf })),
    );

    // Auto-add first set and focus weight
    await addSet(data.id);
    triggerFocus(data.id);
  };

  // ── Set operations ────────────────────────────────────────────────────────
  const addSet = async (exerciseId: string) => {
    if (!user) return;
    const exercise = exercises.find((e) => e.id === exerciseId);
    const nextNum = (exercise?.sets.length || 0) + 1;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ExerciseSet = {
      id: tempId, set_number: nextNum, reps: 0, weight: 0, rir: 0, to_failure: false,
    };
    setExercises((prev) =>
      prev.map((e) => e.id === exerciseId ? { ...e, sets: [...e.sets, optimistic] } : e),
    );

    const { data, error } = await supabase.from('exercise_sets').insert({
      exercise_id: exerciseId, user_id: user.id, set_number: nextNum, reps: 0, weight: 0,
    }).select().single();

    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises((prev) =>
        prev.map((e) => e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== tempId) } : e),
      );
      return;
    }
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.map((s) => s.id === tempId ? { ...s, id: data.id } : s) }
          : e,
      ),
    );
  };

  const updateSet = async (
    setId: string,
    field: 'reps' | 'weight' | 'rir' | 'to_failure',
    value: number | boolean,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex, sets: ex.sets.map((s) => s.id === setId ? { ...s, [field]: value } : s),
      })),
    );
    if (setId.startsWith('temp-')) return;
    await supabase.from('exercise_sets').update({ [field]: value } as never).eq('id', setId);
  };

  const deleteSet = async (setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.id !== setId) })),
    );
    if (setId.startsWith('temp-')) return;
    supabase.from('exercise_sets').delete().eq('id', setId).then(({ error }) => {
      if (error) toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    });
  };

  const deleteExercise = async (exerciseId: string) => {
    const remaining = exercises.filter((e) => e.id !== exerciseId);
    setExercises(remaining);

    // Optimistically remove the calendar dot when the last exercise for this date is gone.
    // This gives instant visual feedback without waiting for the DB round-trip.
    if (remaining.length === 0) {
      setActiveDates((prev) => {
        const next = new Set(prev);
        next.delete(dateStr);
        return next;
      });
    }

    if (exerciseId.startsWith('temp-')) return;

    // Await both deletes so fetchActiveDates sees the DB in its final state.
    await supabase.from('exercise_sets').delete().eq('exercise_id', exerciseId);
    const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    }
    // Re-sync the full activeDates set from the DB (handles multi-delete edge cases).
    fetchActiveDates();
  };

  const renameExercise = async (exerciseId: string, newName: string) => {
    setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, name: newName } : e));
    if (exerciseId.startsWith('temp-')) return;
    await supabase.from('exercises').update({ name: newName }).eq('id', exerciseId);
  };

  const applyTemplate = async (templateExercises: { name: string; muscle_group: string }[]) => {
    if (!user) return;
    const currentIds = exercises.map((e) => e.id).filter((id) => !id.startsWith('temp-'));
    if (currentIds.length > 0) {
      await supabase.from('exercise_sets').delete().in('exercise_id', currentIds);
      await supabase.from('exercises').delete().in('id', currentIds);
    }
    const rows = templateExercises.map((ex, i) => ({
      user_id: user.id, name: ex.name, muscle_group: ex.muscle_group,
      workout_date: dateStr, position: i,
    }));
    const { error } = await supabase.from('exercises').insert(rows);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Plantilla cargada', description: `${rows.length} ejercicios agregados.` });
    setEnableEmptyDay(true);
    fetchExercises();
    fetchActiveDates();
  };

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const renderCalendar = () => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));

    const monthLabel = viewMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return (
      <div className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            className="rounded-lg p-1 hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium capitalize text-foreground">{monthLabel}</span>
          <button
            onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            className="rounded-lg p-1 hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
          {['L','M','X','J','V','S','D'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = formatDateISO(d);
            const isSel = ds === dateStr;
            const hasData = activeDates.has(ds);
            const isFuture = ds > todayStr;
            return (
              <button
                key={i}
                disabled={isFuture}
                onClick={() => { setSelectedDate(d); setCalOpen(false); setEnableEmptyDay(false); }}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors',
                  isFuture && 'text-muted-foreground/30',
                  !isFuture && !hasData && !isSel && 'text-foreground hover:bg-accent',
                  hasData && !isSel && 'bg-primary text-primary-foreground font-semibold',
                  isSel && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                  isSel && !hasData && 'text-foreground',
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const showEmptyPastState =
    hydrated && exercises.length === 0 && isPast && !enableEmptyDay && !addingExercise;
  const showWorkoutUI = !showEmptyPastState;

  return (
    <div className="min-h-screen bg-background px-4 pb-24">
      <div className="mx-auto max-w-lg">
        <PageScreenHeader
          title="Entrenamiento"
          right={
            <Button
              onClick={() => setTemplatesOpen(true)}
              variant="ghost"
              className="h-9 rounded-xl border border-border/50 bg-card/80 px-3 text-sm font-medium text-foreground backdrop-blur-sm hover:bg-accent"
            >
              <Library className="mr-1.5 h-4 w-4 text-primary/60" /> Mi Biblioteca
            </Button>
          }
        />

        {/* Date selector */}
        <div className="mb-5 flex items-center justify-center rounded-2xl border border-border/40 bg-card/70 px-2 py-2 backdrop-blur-sm">
          <Popover
            open={calOpen}
            onOpenChange={(v) => {
              setCalOpen(v);
              if (v) {
                const d = new Date(selectedDate); d.setDate(1); setViewMonth(d);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span className="capitalize">{isToday ? 'Hoy · ' : ''}{formattedDate}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto rounded-2xl border-border bg-card p-0"
              align="center"
            >
              {renderCalendar()}
            </PopoverContent>
          </Popover>
        </div>

        {showEmptyPastState ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-xs font-medium text-muted-foreground/60">No registraste entrenamiento este día</p>
            <Button
              onClick={() => setEnableEmptyDay(true)}
              variant="ghost"
              className="mt-3 h-9 rounded-xl border border-border/40 bg-card/70 px-4 text-sm font-medium text-primary backdrop-blur-sm hover:bg-accent"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Cargar rutina
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                id={ex.id}
                name={ex.name}
                muscleGroup={ex.muscle_group}
                sets={ex.sets}
                lastPerformance={lastPerfMap[ex.name]}
                autoFocusWeight={focusExerciseId === ex.id}
                onAddSet={addSet}
                onUpdateSet={updateSet}
                onDeleteSet={deleteSet}
                onDeleteExercise={() => deleteExercise(ex.id)}
                onRenameExercise={(newName) => renameExercise(ex.id, newName)}
              />
            ))}

            {hydrated && exercises.length === 0 && !addingExercise && (isToday || enableEmptyDay) && (
              <p className="py-12 text-center text-xs font-medium text-muted-foreground/50 tracking-wide">
                Agrega tu primer ejercicio para comenzar
              </p>
            )}

            {/* Inline add-exercise form */}
            {addingExercise ? (
              <div className="space-y-3 rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold tracking-tight text-foreground">Nuevo ejercicio</h4>
                  <button
                    onClick={() => {
                      setAddingExercise(false);
                      setNewExName('');
                      setNewExGroup('');
                    }}
                    className="rounded-lg p-1 text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <Input
                  placeholder="Nombre del ejercicio"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newExGroup && confirmAddExercise()}
                  className="h-12 rounded-xl border-none bg-accent text-foreground"
                  autoFocus
                />

                <Select value={newExGroup} onValueChange={setNewExGroup}>
                  <SelectTrigger className="h-12 rounded-xl border-none bg-accent text-foreground">
                    <SelectValue placeholder="Grupo muscular" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card text-foreground">
                    {MUSCLE_GROUPS.map((g) => (
                      <SelectItem
                        key={g}
                        value={g}
                        className="text-foreground focus:bg-accent focus:text-foreground"
                      >
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Save to library checkbox — only visible when name isn't already saved */}
                {newExName.trim() !== '' &&
                  !libraryNamesLower.has(newExName.trim().toLowerCase()) && (
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-accent px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={saveToLibrary}
                      onChange={(e) => setSaveToLibrary(e.target.checked)}
                      className="h-4 w-4 rounded"
                      style={{ accentColor: 'var(--brand-color)' }}
                    />
                    <span className="text-sm text-foreground">Guardar en mi biblioteca</span>
                  </label>
                )}

                <Button
                  onClick={confirmAddExercise}
                  disabled={!newExName.trim() || !newExGroup}
                  className="h-12 w-full rounded-xl font-semibold"
                >
                  Confirmar
                </Button>
              </div>
            ) : (
              (isToday || enableEmptyDay || exercises.length > 0) && (
                <Button
                  onClick={() => setAddingExercise(true)}
                  className="h-14 w-full rounded-2xl text-base font-bold tracking-tight"
                  style={{
                    boxShadow: '0 0 20px rgba(34,197,94,0.35), 0 4px 16px rgba(0,0,0,0.2)',
                  }}
                >
                  <Plus className="mr-2 h-5 w-5" /> Agregar Ejercicio
                </Button>
              )
            )}
          </div>
        )}

        {showWorkoutUI && (exercises.length > 0 || isToday) && (
          <button
            onClick={() => setReportOpen(true)}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card/70 p-5 backdrop-blur-sm transition-colors hover:bg-accent/70"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary/70" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold tracking-tight text-foreground">Ver Reporte del Día</p>
                <p className="text-xs text-muted-foreground/60">Bitácora, nutrición y descanso</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </button>
        )}
      </div>

      <DailyReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        dateStr={dateStr}
        exercises={exercises}
      />

      <TemplatesSheet
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onApplyTemplate={applyTemplate}
        onAddExercise={handleAddExerciseFromLibrary}
      />
    </div>
  );
};

export default Workout;
