import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, ListChecks, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ExerciseCard from '@/components/ExerciseCard';
import DailyReportSheet from '@/components/DailyReportSheet';
import TemplatesSheet from '@/components/TemplatesSheet';
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

  // inline add form
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('');

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
    setSelectedDate(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + offset);
      return d;
    });
    setEnableEmptyDay(false);
  };

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
        sets: (setsData || []).map(s => ({
          id: s.id, set_number: s.set_number, reps: s.reps, weight: Number(s.weight),
          rir: s.rir ?? 0, to_failure: s.to_failure ?? false,
        })),
      });
    }
    setExercises(exercisesWithSets);
    setHydrated(true);
  }, [user, dateStr]);

  useEffect(() => { setHydrated(false); fetchExercises(); }, [fetchExercises]);

  // Load active workout dates (for calendar markers)
  const fetchActiveDates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('exercises').select('workout_date').eq('user_id', user.id);
    setActiveDates(new Set((data || []).map(d => d.workout_date)));
  }, [user]);

  useEffect(() => { fetchActiveDates(); }, [fetchActiveDates, exercises.length]);

  const confirmAddExercise = async () => {
    if (!user || !newExName.trim() || !newExGroup) return;
    // Optimistic
    const tempId = `temp-${Date.now()}`;
    const optimistic: Exercise = { id: tempId, name: newExName.trim(), muscle_group: newExGroup, sets: [] };
    setExercises(prev => [...prev, optimistic]);
    const name = newExName.trim();
    const group = newExGroup;
    setNewExName(''); setNewExGroup(''); setAddingExercise(false);

    const { data, error } = await supabase.from('exercises').insert({
      user_id: user.id, name, muscle_group: group,
      workout_date: dateStr, position: exercises.length,
    }).select().single();
    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises(prev => prev.filter(e => e.id !== tempId));
      return;
    }
    setExercises(prev => prev.map(e => e.id === tempId ? { ...e, id: data.id } : e));
  };

  const addSet = async (exerciseId: string) => {
    if (!user) return;
    const exercise = exercises.find(e => e.id === exerciseId);
    const nextNum = (exercise?.sets.length || 0) + 1;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ExerciseSet = { id: tempId, set_number: nextNum, reps: 0, weight: 0, rir: 0, to_failure: false };
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, sets: [...e.sets, optimistic] } : e));

    const { data, error } = await supabase.from('exercise_sets').insert({
      exercise_id: exerciseId, user_id: user.id, set_number: nextNum, reps: 0, weight: 0,
    }).select().single();
    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== tempId) } : e));
      return;
    }
    setExercises(prev => prev.map(e => e.id === exerciseId
      ? { ...e, sets: e.sets.map(s => s.id === tempId ? { ...s, id: data.id } : s) }
      : e));
  };

  const updateSet = async (setId: string, field: 'reps' | 'weight' | 'rir' | 'to_failure', value: number | boolean) => {
    setExercises(prev => prev.map(ex => ({
      ...ex, sets: ex.sets.map(s => s.id === setId ? { ...s, [field]: value } : s),
    })));
    if (setId.startsWith('temp-')) return;
    await supabase.from('exercise_sets').update({ [field]: value } as never).eq('id', setId);
  };

  const deleteSet = async (setId: string) => {
    setExercises(prev => prev.map(ex => ({ ...ex, sets: ex.sets.filter(s => s.id !== setId) })));
    if (setId.startsWith('temp-')) return;
    supabase.from('exercise_sets').delete().eq('id', setId).then(({ error }) => {
      if (error) toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    });
  };

  const deleteExercise = async (exerciseId: string) => {
    setExercises(prev => prev.filter(e => e.id !== exerciseId));
    if (exerciseId.startsWith('temp-')) return;
    (async () => {
      await supabase.from('exercise_sets').delete().eq('exercise_id', exerciseId);
      await supabase.from('exercises').delete().eq('id', exerciseId);
    })();
  };

  const renameExercise = async (exerciseId: string, newName: string) => {
    setExercises(prev => prev.map(e => e.id === exerciseId ? { ...e, name: newName } : e));
    if (exerciseId.startsWith('temp-')) return;
    await supabase.from('exercises').update({ name: newName }).eq('id', exerciseId);
  };

  const applyTemplate = async (templateExercises: { name: string; muscle_group: string }[]) => {
    if (!user) return;
    const currentIds = exercises.map(e => e.id).filter(id => !id.startsWith('temp-'));
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
  };

  // Calendar grid
  const renderCalendar = () => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7; // monday-first
    const days: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));

    const monthLabel = viewMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return (
      <div className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="rounded-lg p-1 hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium capitalize text-foreground">{monthLabel}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="rounded-lg p-1 hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
          {['L','M','X','J','V','S','D'].map(d => <div key={d}>{d}</div>)}
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

  const showEmptyPastState = hydrated && exercises.length === 0 && isPast && !enableEmptyDay && !addingExercise;
  const showWorkoutUI = !showEmptyPastState;

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Entrenamiento</h1>
          <Button
            onClick={() => setTemplatesOpen(true)}
            variant="ghost"
            className="h-9 rounded-xl bg-card px-3 text-sm font-medium text-foreground hover:bg-accent"
          >
            <ListChecks className="mr-1.5 h-4 w-4 text-primary" /> Mis Rutinas
          </Button>
        </div>

        {/* Date selector with calendar popover (centered, no arrows) */}
        <div className="mb-4 flex items-center justify-center rounded-2xl bg-card px-2 py-2">
          <Popover open={calOpen} onOpenChange={(v) => { setCalOpen(v); if (v) { const d = new Date(selectedDate); d.setDate(1); setViewMonth(d); } }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span className="capitalize">{isToday ? 'Hoy · ' : ''}{formattedDate}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-2xl border-border bg-card p-0" align="center">
              {renderCalendar()}
            </PopoverContent>
          </Popover>
        </div>

        {showEmptyPastState ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No registraste entrenamiento</p>
            <Button
              onClick={() => setEnableEmptyDay(true)}
              variant="ghost"
              className="mt-3 h-9 rounded-xl bg-card px-4 text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Cargar rutina
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                id={ex.id}
                name={ex.name}
                muscleGroup={ex.muscle_group}
                sets={ex.sets}
                onAddSet={addSet}
                onUpdateSet={updateSet}
                onDeleteSet={deleteSet}
                onDeleteExercise={() => deleteExercise(ex.id)}
                onRenameExercise={(newName) => renameExercise(ex.id, newName)}
              />
            ))}

            {hydrated && exercises.length === 0 && !addingExercise && (isToday || enableEmptyDay) && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-card">
                  <Plus className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Agrega tu primer ejercicio</p>
              </div>
            )}

            {addingExercise ? (
              <div className="space-y-2 rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">Nuevo ejercicio</h4>
                  <button
                    onClick={() => { setAddingExercise(false); setNewExName(''); setNewExGroup(''); }}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
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
                      <SelectItem key={g} value={g} className="text-foreground focus:bg-accent focus:text-foreground">
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
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
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Ver Reporte del Día</p>
                <p className="text-xs text-muted-foreground">Bitácora, nutrición y descanso</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
      />
    </div>
  );
};

export default Workout;
