import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, ChevronLeft, ChevronRight,
  Calendar as CalendarIcon, Dumbbell, Trophy, FileText, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import ExerciseCard, { type ExerciseSetRow } from '@/components/ExerciseCard';
import DailyReportSheet from '@/components/DailyReportSheet';
import TemplatesSheet from '@/components/TemplatesSheet';
import { PersonalRecordsSheet } from '@/components/PersonalRecordsSheet';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { WorkoutModalityTabs } from '@/components/WorkoutModalityTabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { LastPerfHint, WorkoutModalityId } from '@/lib/workoutModality';
import { parseWorkoutBlockSections, newConditioningBlockId } from '@/lib/workoutModality';
import type { Tables } from '@/integrations/supabase/types';
import {
  FunctionalSessionLogPanel,
  defaultFunctionalSessionDraft,
} from '@/components/FunctionalSessionLogPanel';
import {
  deriveFunctionalBlockSections,
  hydrateOrMigrateFunctionalDetails,
  serializeFunctionalDetails,
  type FunctionalPhaseDraft,
  type FunctionalSessionDraft,
} from '@/lib/functionalSessionDraft';
import { CrossfitWodLogPanel, defaultCrossfitDraft } from '@/components/CrossfitWodLogPanel';
import {
  type CrossfitLogDraft,
  type CrossfitWodSubtype,
  type AmrapBlockDraft,
  serializeCrossfitDetails,
  hydrateOrMigrateCrossfitDetails,
  deriveCrossfitBlockSections,
  crossfitWodTitle,
  deriveCrossfitTotalTimeColumn,
  emptyCrossfitDraft,
} from '@/lib/crossfitWodDraft';

const WORKOUT_MODALITY_LS_KEY = 'fitnesspana.workout.activeModalidad';

function readStoredWorkoutModality(): WorkoutModalityId {
  try {
    const v = localStorage.getItem(WORKOUT_MODALITY_LS_KEY);
    if (v === 'musculacion' || v === 'crossfit' || v === 'funcional') return v;
  } catch {
    /* ignore */
  }
  return 'musculacion';
}

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Brazos', 'Hombros', 'Core'];
const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

/** Botones EJERCICIOS / PR: fondos semánticos (día / noche / VIP rosa). */
const WORKOUT_HEADER_QUICK_BTN_LAYOUT = cn(
  'flex min-h-[52px] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors duration-200 sm:w-[5.25rem]',
);
const WORKOUT_HEADER_QUICK_BTN_THEME = cn(
  'border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
  'dark:border-border dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground',
  "[html[data-brand='pink']_&]:border-pink-600/35 [html[data-brand='pink']_&]:bg-zinc-900/92 [html[data-brand='pink']_&]:text-pink-300 [html[data-brand='pink']_&]:shadow-none",
  "[html[data-brand='pink']_&]:hover:bg-zinc-800 [html[data-brand='pink']_&]:hover:text-pink-200",
  "dark:[html[data-brand='pink']_&]:border-pink-800/50 dark:[html[data-brand='pink']_&]:bg-zinc-950/80 dark:[html[data-brand='pink']_&]:text-fuchsia-100",
  "dark:[html[data-brand='pink']_&]:hover:bg-pink-950/55 dark:[html[data-brand='pink']_&]:hover:text-pink-100",
  'active:scale-[0.98]',
);
const WORKOUT_HEADER_QUICK_LABEL = cn(
  'line-clamp-2 w-full px-0.5 text-center text-[9px] font-semibold uppercase leading-[1.15] tracking-wide',
);

/** Contenedor único WOD/circuito + lista de movimientos (día / noche / VIP). */
const CONDITIONING_BLOCK_SHELL = cn(
  'space-y-3 rounded-2xl border border-border/50 bg-card p-3 shadow-sm',
  'dark:bg-card/80',
  "[html[data-brand='pink']_&]:border-pink-700/35 [html[data-brand='pink']_&]:!bg-gradient-to-b [html[data-brand='pink']_&]:from-zinc-950/95 [html[data-brand='pink']_&]:to-zinc-900/96",
  "dark:[html[data-brand='pink']_&]:border-pink-800/45 dark:[html[data-brand='pink']_&]:from-zinc-950/90 dark:[html[data-brand='pink']_&]:to-card/90",
);

const CONDITIONING_EXERCISE_CARD_CLASS = cn(
  'rounded-xl border border-border/40 bg-muted/20 p-4 shadow-none backdrop-blur-none',
  'dark:bg-muted/10',
  "[html[data-brand='pink']_&]:border-pink-700/28 [html[data-brand='pink']_&]:bg-zinc-900/50",
  "dark:[html[data-brand='pink']_&]:border-pink-800/35 dark:[html[data-brand='pink']_&]:bg-zinc-900/45",
);

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  modality: WorkoutModalityId;
  workout_log_id: string | null;
  conditioning_block_id: string | null;
  sets: ExerciseSetRow[];
}

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
  const [activeModalidad, setActiveModalidadState] = useState<WorkoutModalityId>(() =>
    readStoredWorkoutModality(),
  );
  const setActiveModalidad = useCallback((m: WorkoutModalityId) => {
    setActiveModalidadState(m);
    try {
      localStorage.setItem(WORKOUT_MODALITY_LS_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  // Inline add form
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  // Names already in the library (lower-cased for comparison)
  const [libraryNamesLower, setLibraryNamesLower] = useState<Set<string>>(new Set());

  // History hints per exercise name
  const [lastPerfMap, setLastPerfMap] = useState<Record<string, LastPerfHint>>({});

  // Which exercise should auto-focus its weight input
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reportOpen, setReportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [prSheetOpen, setPrSheetOpen] = useState(false);

  const [workoutLogs, setWorkoutLogs] = useState<Tables<'workout_logs'>[]>([]);
  const [crossfitDraft, setCrossfitDraft] = useState<CrossfitLogDraft>(() => defaultCrossfitDraft());
  const [functionalSessionDraft, setFunctionalSessionDraft] = useState<FunctionalSessionDraft>(() =>
    defaultFunctionalSessionDraft(),
  );
  const [blockSaving, setBlockSaving] = useState<'crossfit' | 'funcional' | null>(null);

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
    async (names: string[]): Promise<Record<string, LastPerfHint>> => {
      if (!user || names.length === 0) return {};
      const { data: exData } = await supabase
        .from('exercises')
        .select('id, name, workout_date, modality')
        .eq('user_id', user.id)
        .in('name', names)
        .lt('workout_date', dateStr)
        .order('workout_date', { ascending: false });

      if (!exData?.length) return {};

      const latestIdByName = new Map<string, string>();
      const latestModalityByName = new Map<string, WorkoutModalityId>();
      for (const ex of exData) {
        if (!latestIdByName.has(ex.name)) {
          latestIdByName.set(ex.name, ex.id);
          latestModalityByName.set(ex.name, (ex.modality as WorkoutModalityId) || 'musculacion');
        }
      }

      const ids = [...latestIdByName.values()];
      const { data: setsData } = await supabase
        .from('exercise_sets')
        .select('exercise_id, weight, reps')
        .in('exercise_id', ids)
        .order('set_number', { ascending: false });

      const result: Record<string, LastPerfHint> = {};
      for (const [name, exId] of latestIdByName.entries()) {
        const lastSet = setsData?.find((s) => s.exercise_id === exId);
        if (!lastSet) continue;
        const mod = latestModalityByName.get(name) || 'musculacion';
        if (mod !== 'musculacion') continue;
        if (Number(lastSet.weight) > 0 || lastSet.reps > 0) {
          result[name] = {
            mode: 'strength',
            weight: Number(lastSet.weight),
            reps: lastSet.reps,
          };
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
        id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        modality: (ex.modality as WorkoutModalityId) || 'musculacion',
        workout_log_id: ex.workout_log_id ?? null,
        conditioning_block_id: ex.conditioning_block_id ?? null,
        sets: (setsData || []).map((s) => ({
          id: s.id,
          set_number: s.set_number,
          reps: s.reps,
          weight: Number(s.weight),
          rir: s.rir ?? 0,
          to_failure: s.to_failure ?? false,
          time_seconds: s.time_seconds ?? 0,
          rounds: s.rounds ?? 0,
        })),
      });
    }

    const { data: logs } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_date', dateStr);

    setWorkoutLogs(logs || []);

    let sawCf = false;
    let sawFn = false;
    for (const log of logs || []) {
      if (log.modality === 'crossfit') {
        sawCf = true;
        setCrossfitDraft(
          hydrateOrMigrateCrossfitDetails(log.crossfit_details, {
            wod_title: log.wod_title,
            total_time: log.total_time,
            target_time: log.target_time,
            round_count: log.round_count,
            block_sections: log.block_sections,
          }),
        );
      } else if (log.modality === 'funcional') {
        sawFn = true;
        setFunctionalSessionDraft(
          hydrateOrMigrateFunctionalDetails(log.functional_details, {
            circuit_name: log.circuit_name,
            total_time: log.total_time,
            work_rest_note: log.work_rest_note,
            round_count: log.round_count,
            block_sections: log.block_sections,
          }),
        );
      }
    }
    if (!sawCf) setCrossfitDraft(defaultCrossfitDraft());
    if (!sawFn) setFunctionalSessionDraft(defaultFunctionalSessionDraft());

    setExercises(exercisesWithSets);
    setHydrated(true);

    // Load history for today's exercises
    if (exercisesWithSets.length > 0) {
      const names = [...new Set(exercisesWithSets.map((e) => e.name))];
      fetchLastPerformances(names).then(setLastPerfMap);
    } else {
      setLastPerfMap({});
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

  const resolveWorkoutLogId = useCallback(
    async (modality: 'crossfit' | 'funcional'): Promise<string | null> => {
      if (!user) return null;
      const { data: existing } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('workout_date', dateStr)
        .eq('modality', modality)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data: row, error } = await supabase
        .from('workout_logs')
        .insert(
          modality === 'crossfit'
            ? {
                user_id: user.id,
                workout_date: dateStr,
                modality,
                split_times: [],
                crossfit_details: serializeCrossfitDetails(emptyCrossfitDraft('amrap')),
                block_sections: deriveCrossfitBlockSections(emptyCrossfitDraft('amrap')).map((b, i) => ({
                  id: b.id,
                  sort_order: i,
                  target_time: b.target_time.trim(),
                })),
              }
            : {
                user_id: user.id,
                workout_date: dateStr,
                modality,
                split_times: [],
                crossfit_details: {},
                functional_details: serializeFunctionalDetails(defaultFunctionalSessionDraft()),
                block_sections: [],
              },
        )
        .select('id')
        .single();
      if (error || !row) return null;
      return row.id;
    },
    [user, dateStr],
  );

  const syncMovementsToLog = useCallback(
    async (logId: string | null | undefined) => {
      if (!user || !logId) return;
      const { data: logMeta, error: metaErr } = await supabase
        .from('workout_logs')
        .select('block_sections')
        .eq('id', logId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (metaErr) {
        console.error(metaErr);
        return;
      }
      const sections = parseWorkoutBlockSections(logMeta?.block_sections);

      const { data: rows, error } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, position, conditioning_block_id')
        .eq('user_id', user.id)
        .eq('workout_log_id', logId)
        .order('position');
      if (error) {
        console.error(error);
        return;
      }
      const sectionIds = new Set(sections.map((s) => s.id));
      const snapBlocks = sections.map((s) => ({
        id: s.id,
        target_time: s.target_time,
        movements: (rows || [])
          .filter((r) => r.conditioning_block_id === s.id)
          .map((r) => ({
            id: r.id,
            name: r.name,
            muscle_group: r.muscle_group,
          })),
      }));
      const unassigned = (rows || [])
        .filter((r) => !r.conditioning_block_id || !sectionIds.has(r.conditioning_block_id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          muscle_group: r.muscle_group,
        }));

      await supabase
        .from('workout_logs')
        .update({
          movements: { schema: 'blocks_v1', blocks: snapBlocks, unassigned },
        })
        .eq('id', logId)
        .eq('user_id', user.id);
    },
    [user],
  );

  const persistWorkoutBlock = useCallback(
    async (modality: 'crossfit' | 'funcional') => {
      if (!user) return;
      setBlockSaving(modality);

      let row: Record<string, unknown>;

      if (modality === 'crossfit') {
        const block_sections_payload = deriveCrossfitBlockSections(crossfitDraft).map((b, i) => ({
          id: b.id,
          sort_order: i,
          target_time: b.target_time.trim(),
        }));
        row = {
          user_id: user.id,
          workout_date: dateStr,
          modality,
          total_time: deriveCrossfitTotalTimeColumn(crossfitDraft),
          target_time: null,
          wod_title: crossfitWodTitle(crossfitDraft) || null,
          round_count: null,
          split_times: [],
          block_sections: block_sections_payload,
          crossfit_details: serializeCrossfitDetails(crossfitDraft),
          circuit_name: null,
          work_rest_note: null,
        };
      } else {
        const draft = functionalSessionDraft;
        const block_sections_payload = deriveFunctionalBlockSections(draft).map((b, i) => ({
          id: b.id,
          sort_order: i,
          target_time: b.target_time.trim(),
        }));
        row = {
          user_id: user.id,
          workout_date: dateStr,
          modality,
          total_time: draft.total_session_time.trim() || null,
          target_time: null,
          wod_title: null,
          round_count: null,
          split_times: [],
          block_sections: block_sections_payload,
          crossfit_details: {},
          functional_details: serializeFunctionalDetails(draft),
          circuit_name: draft.session_name.trim() || null,
          work_rest_note: null,
        };
      }

      const draftForExerciseDefaults =
        modality === 'crossfit'
          ? deriveCrossfitBlockSections(crossfitDraft)
          : deriveFunctionalBlockSections(functionalSessionDraft);
      const { data, error } = await supabase
        .from('workout_logs')
        .upsert(row as Tables<'workout_logs'>['Insert'], { onConflict: 'user_id,workout_date,modality' })
        .select()
        .single();
      setBlockSaving(null);
      if (error || !data) {
        toast({ title: 'Error', description: error?.message, variant: 'destructive' });
        return;
      }
      await supabase
        .from('exercises')
        .update({ workout_log_id: data.id })
        .eq('user_id', user.id)
        .eq('workout_date', dateStr)
        .eq('modality', modality);
      const defaultBlockId = draftForExerciseDefaults[0]?.id;
      if (defaultBlockId) {
        await supabase
          .from('exercises')
          .update({ conditioning_block_id: defaultBlockId })
          .eq('user_id', user.id)
          .eq('workout_date', dateStr)
          .eq('modality', modality)
          .is('conditioning_block_id', null);
      }
      await syncMovementsToLog(data.id);
      toast({ title: 'Bloque guardado', description: 'Tiempos y rondas guardados.' });
      fetchExercises();
    },
    [user, dateStr, crossfitDraft, functionalSessionDraft, toast, fetchExercises, syncMovementsToLog],
  );

  // ── Trigger auto-focus (reset after 1.5 s so re-adding a set later won't re-focus) ──
  const triggerFocus = (exerciseId: string) => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    setFocusExerciseId(exerciseId);
    focusTimerRef.current = setTimeout(() => setFocusExerciseId(null), 1500);
  };

  // ── Add exercise from inline form ─────────────────────────────────────────
  const confirmAddExercise = async () => {
    if (!user || !newExName.trim() || !newExGroup) return;

    let workout_log_id: string | null = null;
    if (activeModalidad === 'crossfit' || activeModalidad === 'funcional') {
      workout_log_id = await resolveWorkoutLogId(activeModalidad);
    }

    const conditioning_block_id =
      activeModalidad === 'crossfit'
        ? deriveCrossfitBlockSections(crossfitDraft)[0]?.id ?? null
        : activeModalidad === 'funcional'
          ? deriveFunctionalBlockSections(functionalSessionDraft)[0]?.id ?? null
          : null;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Exercise = {
      id: tempId,
      name: newExName.trim(),
      muscle_group: newExGroup,
      modality: activeModalidad,
      workout_log_id,
      conditioning_block_id,
      sets: [],
    };
    setExercises((prev) => [...prev, optimistic]);

    const name = newExName.trim();
    const group = newExGroup;
    const shouldSave = saveToLibrary;
    setNewExName(''); setNewExGroup(''); setAddingExercise(false);

    const { data, error } = await supabase.from('exercises').insert({
      user_id: user.id,
      name,
      muscle_group: group,
      modality: activeModalidad,
      workout_date: dateStr,
      position: exercises.length,
      workout_log_id,
      conditioning_block_id,
    }).select().single();

    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      return;
    }

    setExercises((prev) =>
      prev.map((e) =>
        e.id === tempId
          ? {
              ...e,
              id: data.id,
              modality: activeModalidad,
              workout_log_id: data.workout_log_id ?? workout_log_id,
              conditioning_block_id: data.conditioning_block_id ?? conditioning_block_id,
            }
          : e,
      ),
    );
    fetchActiveDates();

    const logToSync = data.workout_log_id ?? workout_log_id;
    if (
      (activeModalidad === 'crossfit' || activeModalidad === 'funcional') &&
      logToSync
    ) {
      await syncMovementsToLog(logToSync);
    }

    if (shouldSave) {
      supabase.from('exercises_library').upsert(
        {
          user_id: user.id,
          name,
          muscle_group: group,
          modalities: [activeModalidad],
        },
        { onConflict: 'user_id,name' },
      ).then(() => fetchLibraryNames());
    }

    if (activeModalidad === 'musculacion') {
      fetchLastPerformances([name]).then((perf) =>
        setLastPerfMap((prev) => ({ ...prev, ...perf })),
      );
      await addSet(data.id);
      triggerFocus(data.id);
    }
  };

  // ── Add exercise from library ─────────────────────────────────────────────
  const handleAddExerciseFromLibrary = async (name: string, muscleGroup: string) => {
    if (!user) return;
    setEnableEmptyDay(true);

    let workout_log_id: string | null = null;
    if (activeModalidad === 'crossfit' || activeModalidad === 'funcional') {
      workout_log_id = await resolveWorkoutLogId(activeModalidad);
    }

    const conditioning_block_id =
      activeModalidad === 'crossfit'
        ? deriveCrossfitBlockSections(crossfitDraft)[0]?.id ?? null
        : activeModalidad === 'funcional'
          ? deriveFunctionalBlockSections(functionalSessionDraft)[0]?.id ?? null
          : null;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Exercise = {
      id: tempId,
      name,
      muscle_group: muscleGroup,
      modality: activeModalidad,
      workout_log_id,
      conditioning_block_id,
      sets: [],
    };
    setExercises((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from('exercises').insert({
      user_id: user.id,
      name,
      muscle_group: muscleGroup,
      modality: activeModalidad,
      workout_date: dateStr,
      position: exercises.length,
      workout_log_id,
      conditioning_block_id,
    }).select().single();

    if (error || !data) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setExercises((prev) => prev.filter((e) => e.id !== tempId));
      return;
    }

    setExercises((prev) =>
      prev.map((e) =>
        e.id === tempId
          ? {
              ...e,
              id: data.id,
              modality: activeModalidad,
              workout_log_id: data.workout_log_id ?? workout_log_id,
              conditioning_block_id: data.conditioning_block_id ?? conditioning_block_id,
            }
          : e,
      ),
    );
    fetchActiveDates();

    const logToSync = data.workout_log_id ?? workout_log_id;
    if (
      (activeModalidad === 'crossfit' || activeModalidad === 'funcional') &&
      logToSync
    ) {
      await syncMovementsToLog(logToSync);
    }

    if (activeModalidad === 'musculacion') {
      fetchLastPerformances([name]).then((perf) =>
        setLastPerfMap((prev) => ({ ...prev, ...perf })),
      );
      await addSet(data.id);
      triggerFocus(data.id);
    }
  };

  // ── Set operations ────────────────────────────────────────────────────────
  const addSet = async (exerciseId: string) => {
    if (!user) return;
    const exercise = exercises.find((e) => e.id === exerciseId);
    const nextNum = (exercise?.sets.length || 0) + 1;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ExerciseSetRow = {
      id: tempId,
      set_number: nextNum,
      reps: 0,
      weight: 0,
      rir: 0,
      to_failure: false,
      time_seconds: 0,
      rounds: 0,
    };
    setExercises((prev) =>
      prev.map((e) => e.id === exerciseId ? { ...e, sets: [...e.sets, optimistic] } : e),
    );

    const { data, error } = await supabase.from('exercise_sets').insert({
      exercise_id: exerciseId,
      user_id: user.id,
      set_number: nextNum,
      reps: 0,
      weight: 0,
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
    field: 'reps' | 'weight' | 'rir' | 'to_failure' | 'time_seconds' | 'rounds',
    value: number | boolean,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
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
    const victim = exercises.find((e) => e.id === exerciseId);
    const syncLogId = victim?.workout_log_id;
    const syncMod = victim?.modality;

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
    if (
      syncLogId &&
      (syncMod === 'crossfit' || syncMod === 'funcional')
    ) {
      await syncMovementsToLog(syncLogId);
    }
    // Re-sync the full activeDates set from the DB (handles multi-delete edge cases).
    fetchActiveDates();
  };

  const renameExercise = async (exerciseId: string, newName: string) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    setExercises((prev) => prev.map((e) => e.id === exerciseId ? { ...e, name: newName } : e));
    if (exerciseId.startsWith('temp-')) return;
    await supabase.from('exercises').update({ name: newName }).eq('id', exerciseId);
    if (
      ex?.workout_log_id &&
      (ex.modality === 'crossfit' || ex.modality === 'funcional')
    ) {
      await syncMovementsToLog(ex.workout_log_id);
    }
  };

  const handleCrossfitAmrapBlockRemoved = (removedBlockId: string, nextBlocks: AmrapBlockDraft[]) => {
    const fallback = nextBlocks[0]?.id ?? null;
    setExercises((prev) =>
      prev.map((e) =>
        e.modality === 'crossfit' && e.conditioning_block_id === removedBlockId
          ? { ...e, conditioning_block_id: fallback }
          : e,
      ),
    );
  };

  const handleCrossfitSubtypeChange = (_subtype: CrossfitWodSubtype, nextDraft: CrossfitLogDraft) => {
    const fb = deriveCrossfitBlockSections(nextDraft)[0]?.id ?? null;
    setExercises((prev) =>
      prev.map((e) => (e.modality === 'crossfit' ? { ...e, conditioning_block_id: fb } : e)),
    );
  };

  const handleFunctionalPhaseRemoved = (removedPhaseId: string, nextPhases: FunctionalPhaseDraft[]) => {
    const fallback = deriveFunctionalBlockSections({
      ...functionalSessionDraft,
      phases: nextPhases,
    })[0]?.id ?? null;
    setExercises((prev) =>
      prev.map((e) =>
        e.modality === 'funcional' && e.conditioning_block_id === removedPhaseId
          ? { ...e, conditioning_block_id: fallback }
          : e,
      ),
    );
  };

  const updateExerciseConditioningBlock = async (exerciseId: string, blockId: string | null) => {
    const victim = exercises.find((e) => e.id === exerciseId);
    const logId = victim?.workout_log_id;
    const mod = victim?.modality;
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, conditioning_block_id: blockId } : e)),
    );
    if (exerciseId.startsWith('temp-')) return;
    await supabase.from('exercises').update({ conditioning_block_id: blockId }).eq('id', exerciseId);
    if (logId && (mod === 'crossfit' || mod === 'funcional')) {
      await syncMovementsToLog(logId);
    }
  };

  const applyTemplate = async (templateExercises: { name: string; muscle_group: string }[]) => {
    if (!user) return;
    let workout_log_id: string | null = null;
    if (activeModalidad === 'crossfit' || activeModalidad === 'funcional') {
      workout_log_id = await resolveWorkoutLogId(activeModalidad);
    }
    const currentIds = exercises.map((e) => e.id).filter((id) => !id.startsWith('temp-'));
    if (currentIds.length > 0) {
      await supabase.from('exercise_sets').delete().in('exercise_id', currentIds);
      await supabase.from('exercises').delete().in('id', currentIds);
    }
    const conditioning_block_id =
      activeModalidad === 'crossfit'
        ? deriveCrossfitBlockSections(crossfitDraft)[0]?.id ?? null
        : activeModalidad === 'funcional'
          ? deriveFunctionalBlockSections(functionalSessionDraft)[0]?.id ?? null
          : null;
    const rows = templateExercises.map((ex, i) => ({
      user_id: user.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      modality: activeModalidad,
      workout_date: dateStr,
      position: i,
      workout_log_id,
      conditioning_block_id,
    }));
    const { error } = await supabase.from('exercises').insert(rows);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    if (workout_log_id) await syncMovementsToLog(workout_log_id);
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
                  hasData && !isSel && 'bg-primary/15 font-semibold text-primary dark:bg-primary/20 dark:text-primary',
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

  const hasWorkoutOnDay = exercises.length > 0;
  const visibleExercises = exercises.filter((e) => e.modality === activeModalidad);

  const showEmptyPastState =
    hydrated && !hasWorkoutOnDay && isPast && !enableEmptyDay && !addingExercise;
  const showWorkoutUI = !showEmptyPastState;

  const conditioningCardSurface =
    activeModalidad !== 'musculacion' ? CONDITIONING_EXERCISE_CARD_CLASS : undefined;

  const crossfitDerivedSections =
    activeModalidad === 'crossfit' ? deriveCrossfitBlockSections(crossfitDraft) : [];

  const sectionsForGrouping =
    activeModalidad === 'crossfit'
      ? crossfitDerivedSections
      : activeModalidad === 'funcional'
        ? deriveFunctionalBlockSections(functionalSessionDraft)
        : [];

  const blockOptions = sectionsForGrouping.map((b, i) => ({
    id: b.id,
    label: `Bloque ${i + 1}${b.target_time.trim() ? ` · ${b.target_time}` : ''}`,
  }));

  const strengthExerciseCards = visibleExercises.map((ex) => (
    <ExerciseCard
      key={ex.id}
      id={ex.id}
      name={ex.name}
      muscleGroup={ex.muscle_group}
      modality={ex.modality}
      sets={ex.sets}
      className={conditioningCardSurface}
      lastPerformance={lastPerfMap[ex.name]}
      autoFocusWeight={focusExerciseId === ex.id}
      onAddSet={addSet}
      onUpdateSet={updateSet}
      onDeleteSet={deleteSet}
      onDeleteExercise={() => deleteExercise(ex.id)}
      onRenameExercise={(newName) => renameExercise(ex.id, newName)}
    />
  ));

  const conditioningUnassigned =
    (activeModalidad === 'crossfit' || activeModalidad === 'funcional') &&
    visibleExercises.filter(
      (e) => !sectionsForGrouping.some((s) => s.id === e.conditioning_block_id),
    );

  return (
    <div className="min-h-screen bg-background px-4 pb-24">
      <div className="mx-auto max-w-lg">
        <PageScreenHeader
          title="Entrenamiento"
          right={
            <div className="flex flex-row items-center gap-2">
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className={cn(WORKOUT_HEADER_QUICK_BTN_LAYOUT, WORKOUT_HEADER_QUICK_BTN_THEME)}
              >
                <Dumbbell className="shrink-0 text-primary opacity-90" size={16} strokeWidth={2.25} aria-hidden />
                <span className={WORKOUT_HEADER_QUICK_LABEL}>EJERCICIOS</span>
              </button>
              <button
                type="button"
                onClick={() => setPrSheetOpen(true)}
                className={cn(WORKOUT_HEADER_QUICK_BTN_LAYOUT, WORKOUT_HEADER_QUICK_BTN_THEME)}
              >
                <Trophy className="shrink-0 text-primary opacity-90" size={16} strokeWidth={2.25} aria-hidden />
                <span className={WORKOUT_HEADER_QUICK_LABEL}>PR</span>
              </button>
            </div>
          }
        />

        {/* Date selector */}
        <div
          className={cn(
            'mb-5 flex items-center justify-center rounded-2xl border border-border/50 bg-card px-2 py-2 shadow-sm',
            "[html[data-brand='pink']_&]:border-pink-700/40 [html[data-brand='pink']_&]:!bg-zinc-950/92",
            "dark:[html[data-brand='pink']_&]:border-pink-800/45 dark:[html[data-brand='pink']_&]:bg-zinc-950/85",
          )}
        >
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
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <CalendarIcon className="h-4 w-4 shrink-0 text-primary" />
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

        <WorkoutModalityTabs
          value={activeModalidad}
          onChange={setActiveModalidad}
          className="mb-5"
        />

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
            {activeModalidad === 'crossfit' || activeModalidad === 'funcional' ? (
              <div className={CONDITIONING_BLOCK_SHELL}>
                {activeModalidad === 'crossfit' && (
                  <CrossfitWodLogPanel
                    draft={crossfitDraft}
                    onChange={setCrossfitDraft}
                    onSubtypeChange={handleCrossfitSubtypeChange}
                    onAmrapBlockRemoved={handleCrossfitAmrapBlockRemoved}
                    onSave={() => void persistWorkoutBlock('crossfit')}
                    saving={blockSaving === 'crossfit'}
                  />
                )}
                {activeModalidad === 'funcional' && (
                  <FunctionalSessionLogPanel
                    draft={functionalSessionDraft}
                    onChange={setFunctionalSessionDraft}
                    onPhaseRemoved={handleFunctionalPhaseRemoved}
                    onSave={() => void persistWorkoutBlock('funcional')}
                    saving={blockSaving === 'funcional'}
                  />
                )}
                <div className="space-y-4">
                  {sectionsForGrouping.map((sec, idx) => {
                    const inBlock = visibleExercises.filter((e) => e.conditioning_block_id === sec.id);
                    return (
                      <div key={sec.id} className="space-y-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {activeModalidad === 'funcional' ? `Fase ${idx + 1}` : `Bloque ${idx + 1}`}
                          </span>
                          {sec.target_time.trim() ? (
                            <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                              {activeModalidad === 'funcional'
                                ? sec.target_time
                                : `Objetivo coach: ${sec.target_time}`}
                            </span>
                          ) : null}
                        </div>
                        {inBlock.length === 0 ? (
                          <p className="py-2 text-center text-[11px] text-muted-foreground">
                            Ningún ejercicio en este bloque
                          </p>
                        ) : (
                          inBlock.map((ex) => (
                            <ExerciseCard
                              key={ex.id}
                              id={ex.id}
                              name={ex.name}
                              muscleGroup={ex.muscle_group}
                              modality={ex.modality}
                              sets={ex.sets}
                              className={conditioningCardSurface}
                              conditioningBlockOptions={blockOptions}
                              conditioningBlockId={ex.conditioning_block_id}
                              onConditioningBlockChange={(bid) =>
                                void updateExerciseConditioningBlock(ex.id, bid)
                              }
                              lastPerformance={lastPerfMap[ex.name]}
                              autoFocusWeight={focusExerciseId === ex.id}
                              onAddSet={addSet}
                              onUpdateSet={updateSet}
                              onDeleteSet={deleteSet}
                              onDeleteExercise={() => deleteExercise(ex.id)}
                              onRenameExercise={(newName) => renameExercise(ex.id, newName)}
                            />
                          ))
                        )}
                      </div>
                    );
                  })}
                  {conditioningUnassigned && conditioningUnassigned.length > 0 ? (
                    <div className="space-y-2 border-t border-dashed border-border/50 pt-3">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {activeModalidad === 'funcional' ? 'Sin fase asignada' : 'Sin bloque asignado'}
                      </span>
                      {conditioningUnassigned.map((ex) => (
                        <ExerciseCard
                          key={ex.id}
                          id={ex.id}
                          name={ex.name}
                          muscleGroup={ex.muscle_group}
                          modality={ex.modality}
                          sets={ex.sets}
                          className={conditioningCardSurface}
                          conditioningBlockOptions={blockOptions}
                          conditioningBlockId={ex.conditioning_block_id}
                          onConditioningBlockChange={(bid) =>
                            void updateExerciseConditioningBlock(ex.id, bid)
                          }
                          lastPerformance={lastPerfMap[ex.name]}
                          autoFocusWeight={focusExerciseId === ex.id}
                          onAddSet={addSet}
                          onUpdateSet={updateSet}
                          onDeleteSet={deleteSet}
                          onDeleteExercise={() => deleteExercise(ex.id)}
                          onRenameExercise={(newName) => renameExercise(ex.id, newName)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">{strengthExerciseCards}</div>
            )}

            {hydrated && visibleExercises.length === 0 && !addingExercise && (isToday || enableEmptyDay) && (
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
                  className="h-12 w-full rounded-xl border-0 bg-primary font-semibold text-primary-foreground shadow-none hover:bg-[color:var(--brand-hover)]"
                >
                  Confirmar
                </Button>
              </div>
            ) : (
              (isToday || enableEmptyDay || visibleExercises.length > 0) && (
                <Button
                  onClick={() => setAddingExercise(true)}
                  variant="secondary"
                  className={cn(
                    'h-14 w-full rounded-2xl border border-border/60 bg-secondary text-base font-bold tracking-tight text-foreground shadow-none hover:bg-accent',
                    "[html[data-brand='pink']_&]:border-0 [html[data-brand='pink']_&]:bg-primary [html[data-brand='pink']_&]:text-primary-foreground",
                    "[html[data-brand='pink']_&]:shadow-sm [html[data-brand='pink']_&]:hover:bg-[color:var(--brand-hover)] [html[data-brand='pink']_&]:hover:text-primary-foreground",
                  )}
                >
                  <Plus
                    className={cn(
                      'mr-2 h-5 w-5 text-primary',
                      "[html[data-brand='pink']_&]:text-primary-foreground",
                    )}
                    strokeWidth={2}
                  />
                  Agregar ejercicio
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
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl',
                  'bg-green-500/10 dark:bg-primary/10',
                  "[html[data-brand='pink']_&]:bg-zinc-900/70",
                )}
              >
                <FileText
                  className={cn(
                    'h-5 w-5 text-green-600 dark:text-primary',
                    "[html[data-brand='pink']_&]:text-pink-400",
                  )}
                  aria-hidden
                />
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
        workoutLogs={workoutLogs}
      />

      <TemplatesSheet
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        libraryModalityFilter={activeModalidad}
        onApplyTemplate={applyTemplate}
        onAddExercise={handleAddExerciseFromLibrary}
      />

      <PersonalRecordsSheet open={prSheetOpen} onClose={() => setPrSheetOpen(false)} />
    </div>
  );
};

export default Workout;
