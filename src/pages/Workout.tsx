import { useState, useEffect, useCallback, useRef , useMemo} from 'react';
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
import PersonalRecordsSheet from '@/components/PersonalRecordsSheet';
import TemplatesSheet from '@/components/TemplatesSheet';
import { ExerciseNameSuggestInput } from '@/components/ExerciseNameSuggestInput';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { WorkoutModalityTabs } from '@/components/WorkoutModalityTabs';
import { GymRoutineBlockViewer } from "@/components/GymRoutineBlockViewer";
import { GymRoutineLeaderboard } from '@/components/GymRoutineLeaderboard';
import { GymRoutineRegisterSheet } from '@/components/GymRoutineRegisterSheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { LastPerfHint, WorkoutModalityId } from '@/lib/workoutModality';
import { modalityIdsAllowedByGymLabels, parseWorkoutBlockSections, newConditioningBlockId } from '@/lib/workoutModality';
import { parseGymRoutineWorkoutData } from '@/lib/gymRoutineWorkoutData';
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
import { modalityToLibraryCategory } from '@/lib/exerciseLibraryNaming';
import { insertConditioningRoutineTemplate } from '@/lib/workoutTemplatesConditioning';
import { insertMissingExerciseLibraryEntries } from '@/lib/exerciseLibrarySync';
import { deriveGymQuickResultFormFromLog } from '@/lib/gymRoutineQuickResult';

const WORKOUT_MODALITY_LS_KEY = 'fitnesspana.workout.activeModalidad';
const WORKOUT_SCOPE_LS_KEY = 'fitnesspana.workout.scope';

/** Subtítulo en la grilla modo gimnasio según si hay resultado para la fecha seleccionada. */
function subtitleForGymRoutineLog(log: Tables<'workout_logs'> | undefined, modality: WorkoutModalityId): string {
  if (!log) return 'Vacío · tocá para registrar';
  if (modality === 'musculacion') return 'Registrado';
  const parts = [
    log.total_time?.trim(),
    log.round_count != null ? `${log.round_count} rondas` : null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' · ') : 'Registrado';
}

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
/** Fecha calendario local YYYY-MM-DD (evita desfasajes UTC de `toISOString`). */
function formatLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Botones EJERCICIOS / PR: fondos semánticos (día / noche / VIP rosa). */
const WORKOUT_HEADER_QUICK_BTN_LAYOUT = cn(
  'flex min-h-[52px] w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition-colors duration-200 sm:w-[5.25rem]',
);
const WORKOUT_HEADER_QUICK_BTN_THEME = cn(
  'border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
  'dark:border-border dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-accent dark:hover:text-accent-foreground',
  "[html[data-brand='pink']_&]:border-[#ff007f]/35 [html[data-brand='pink']_&]:shadow-none",
  "dark:[html[data-brand='pink']_&]:border-pink-800/50 dark:[html[data-brand='pink']_&]:text-fuchsia-100",
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
  "[html[data-brand='pink']_&]:border-[#ff007f]/25 [html[data-brand='pink']_&]:shadow-none",
  "dark:[html[data-brand='pink']_&]:border-pink-800/45",
);

const CONDITIONING_EXERCISE_CARD_CLASS = cn(
  'rounded-xl border border-border/40 bg-muted/20 p-4 shadow-none backdrop-blur-none',
  'dark:bg-muted/10',
  "[html[data-brand='pink']_&]:border-[#ff007f]/22",
  "dark:[html[data-brand='pink']_&]:border-pink-800/35",
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
  const dateStr = formatLocalDateISO(selectedDate);
  const todayStr = formatLocalDateISO(new Date());
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;

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

  const [studentCoachProfileId, setStudentCoachProfileId] = useState<string | null>(null);
  const [isCoachUser, setIsCoachUser] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [gymModalitiesLabels, setGymModalitiesLabels] = useState<string[]>([]);
  const [coachCtxReady, setCoachCtxReady] = useState(false);
  const [workoutScope, setWorkoutScope] = useState<'personal' | 'gimnasio'>('personal');

  /** Alumno con `profiles.coach_id` o usuario coach (`is_coach`). */
  const isLinkedToGymOrCoach = Boolean(studentCoachProfileId) || isCoachUser;
  const showGymSwitch = coachCtxReady && !!user && isLinkedToGymOrCoach;
  const isGymView = showGymSwitch && workoutScope === 'gimnasio';

  const gymSourceCoachProfileId = useMemo(() => {
    if (!coachCtxReady || !user) return null;
    if (isCoachUser && myProfileId) return myProfileId;
    if (studentCoachProfileId) return studentCoachProfileId;
    return null;
  }, [coachCtxReady, user, isCoachUser, myProfileId, studentCoachProfileId]);

  const gymAllowedModalities = useMemo(
    () => modalityIdsAllowedByGymLabels(gymModalitiesLabels),
    [gymModalitiesLabels],
  );

  useEffect(() => {
    if (!user?.id) {
      setStudentCoachProfileId(null);
      setIsCoachUser(false);
      setMyProfileId(null);
      setGymModalitiesLabels([]);
      setWorkoutScope('personal');
      setCoachCtxReady(true);
      return;
    }
    let cancelled = false;
    setCoachCtxReady(false);
    void (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, coach_id, is_coach, gym_modalities')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;

      const row = prof as {
        id?: string;
        coach_id?: string | null;
        is_coach?: boolean | null;
        gym_modalities?: string[] | null;
      } | null;

      const pid = typeof row?.id === 'string' ? row.id : null;
      const coachFlag = row?.is_coach === true;
      const rawCoachId = row?.coach_id;
      const studentCoachId =
        typeof rawCoachId === 'string' && rawCoachId.trim().length > 0 ? rawCoachId.trim() : null;

      setMyProfileId(pid);
      setIsCoachUser(coachFlag);
      setStudentCoachProfileId(studentCoachId);

      const canUseGymSwitch = coachFlag || Boolean(studentCoachId);
      let mods: string[] = [];

      if (coachFlag && pid) {
        mods = Array.isArray(row?.gym_modalities) ? row!.gym_modalities! : [];
      } else if (studentCoachId) {
        const { data: rpcRows } = await supabase.rpc('get_linked_coach_gym');
        if (cancelled) return;
        const rpcRow = Array.isArray(rpcRows) ? rpcRows[0] : null;
        const modsRaw =
          rpcRow != null && typeof rpcRow === 'object'
            ? (rpcRow as { gym_modalities?: unknown }).gym_modalities
            : undefined;
        mods =
          Array.isArray(modsRaw) && modsRaw.every((x): x is string => typeof x === 'string') ? modsRaw : [];
      }

      setGymModalitiesLabels(mods);

      if (!canUseGymSwitch) {
        setWorkoutScope('personal');
        setCoachCtxReady(true);
        return;
      }

      let scope: 'personal' | 'gimnasio' = 'personal';
      try {
        if (localStorage.getItem(WORKOUT_SCOPE_LS_KEY) === 'gimnasio') scope = 'gimnasio';
      } catch {
        /* ignore */
      }
      setWorkoutScope(scope);
      setCoachCtxReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!coachCtxReady || !user) return;
    if (!(studentCoachProfileId || isCoachUser)) return;
    try {
      localStorage.setItem(WORKOUT_SCOPE_LS_KEY, workoutScope);
    } catch {
      /* ignore */
    }
  }, [workoutScope, coachCtxReady, user, studentCoachProfileId, isCoachUser]);

  useEffect(() => {
    if (!coachCtxReady || isLinkedToGymOrCoach) return;
    if (workoutScope !== 'personal') setWorkoutScope('personal');
  }, [coachCtxReady, isLinkedToGymOrCoach, workoutScope]);

  useEffect(() => {
    if (!coachCtxReady || !isGymView) return;
    if (!gymAllowedModalities.includes(activeModalidad)) {
      setActiveModalidad(gymAllowedModalities[0] ?? 'musculacion');
    }
  }, [coachCtxReady, isGymView, gymAllowedModalities, activeModalidad, setActiveModalidad]);

  useEffect(() => {
    setPersonalConditioningEditorOpen(false);
  }, [activeModalidad, dateStr]);

  const [gymRoutines, setGymRoutines] = useState<Tables<'gym_routines'>[]>([]);
  const [gymRoutinesLoading, setGymRoutinesLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingRoutine, setViewingRoutine] = useState<Tables<'gym_routines'> | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerRoutine, setRegisterRoutine] = useState<Tables<'gym_routines'> | null>(null);
  const [leaderboardNonce, setLeaderboardNonce] = useState(0);
  const [registerQuickPrefill, setRegisterQuickPrefill] = useState<{
    resultado: string;
    notas: string;
  } | null>(null);
  const [registerSheetVariant, setRegisterSheetVariant] = useState<'register' | 'edit'>('register');
  const [personalConditioningEditorOpen, setPersonalConditioningEditorOpen] = useState(false);

  useEffect(() => {
    if (!user?.id || !isGymView || !gymSourceCoachProfileId) {
      setGymRoutines([]);
      setGymRoutinesLoading(false);
      return;
    }
    let cancelled = false;
    setGymRoutinesLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('gym_routines')
        .select('*')
        .eq('coach_id', gymSourceCoachProfileId)
        .eq('modality', activeModalidad)
        .order('day_number');
      if (cancelled) return;
      if (error) {
        console.error(error);
        setGymRoutines([]);
      } else {
        setGymRoutines(data ?? []);
      }
      setGymRoutinesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isGymView, gymSourceCoachProfileId, activeModalidad]);

  // Inline add form
  const [addingExercise, setAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('');

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

  const gymRoutineLogById = useMemo(() => {
    const m = new Map<string, Tables<'workout_logs'>>();
    if (!isGymView) return m;
    for (const log of workoutLogs) {
      if (log.modality !== activeModalidad || !log.gym_routine_id) continue;
      m.set(log.gym_routine_id, log);
    }
    return m;
  }, [workoutLogs, isGymView, activeModalidad]);

  /** Evita ver rankings / formularios de otra fecha si el usuario cambia el día en el selector. */
  useEffect(() => {
    setViewerOpen(false);
    setRegisterOpen(false);
    setRegisterQuickPrefill(null);
    setRegisterSheetVariant('register');
    setViewingRoutine(null);
    setReportOpen(false);
  }, [dateStr]);

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

    const { data: logsRaw } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_date', dateStr);

    const logsAll = logsRaw || [];
    const logs = isGymView
      ? logsAll.filter((l) => l.gym_routine_id != null)
      : logsAll.filter((l) => l.gym_routine_id == null);

    setWorkoutLogs(logs);

    let sawCf = false;
    let sawFn = false;
    for (const log of logs) {
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
  }, [user, dateStr, isGymView, fetchLastPerformances]);

  useEffect(() => { setHydrated(false); fetchExercises(); }, [fetchExercises]);

  const fetchActiveDates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('exercises').select('workout_date').eq('user_id', user.id);
    setActiveDates(new Set((data || []).map((d) => d.workout_date)));
  }, [user]);

  // fetchActiveDates is called explicitly after every add/delete that touches the DB.
  // Depending on exercises.length was unreliable: it fired *before* the DB write completed.
  useEffect(() => { fetchActiveDates(); }, [fetchActiveDates]);

  const handleGymResultRecorded = useCallback(() => {
    void fetchExercises();
    void fetchActiveDates();
    setLeaderboardNonce((n) => n + 1);
  }, [fetchExercises, fetchActiveDates]);

  const closeGymRegisterSheet = useCallback(() => {
    setRegisterOpen(false);
    setRegisterQuickPrefill(null);
    setRegisterSheetVariant('register');
  }, []);

  const openGymRegisterFresh = useCallback(() => {
    if (!viewingRoutine) return;
    setRegisterQuickPrefill(null);
    setRegisterSheetVariant('register');
    setRegisterRoutine(viewingRoutine);
    setViewerOpen(false);
    setRegisterOpen(true);
  }, [viewingRoutine]);

  const handleEditOwnGymRanking = useCallback(async () => {
    if (!user?.id || !viewingRoutine) return;
    const modality = viewingRoutine.modality as WorkoutModalityId;
    if (modality !== 'crossfit' && modality !== 'funcional') return;
    const { data, error } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_date', dateStr)
      .eq('modality', modality)
      .eq('gym_routine_id', viewingRoutine.id)
      .maybeSingle();
    if (error || !data) {
      toast({
        title: 'No encontramos tu registro',
        description: 'Probá registrar de nuevo o actualizar la página.',
        variant: 'destructive',
      });
      return;
    }
    setRegisterRoutine(viewingRoutine);
    setRegisterQuickPrefill(deriveGymQuickResultFormFromLog(data));
    setRegisterSheetVariant('edit');
    setViewerOpen(false);
    setRegisterOpen(true);
  }, [user?.id, viewingRoutine, dateStr, toast]);

  const handleDeleteOwnGymRanking = useCallback(async () => {
    if (!user?.id || !viewingRoutine) return;
    const modality = viewingRoutine.modality as WorkoutModalityId;
    if (modality !== 'crossfit' && modality !== 'funcional') return;
    if (
      !globalThis.confirm(
        '¿Eliminar tu resultado del ranking para esta fecha? Podrás registrar uno nuevo después.',
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from('workout_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('workout_date', dateStr)
      .eq('modality', modality)
      .eq('gym_routine_id', viewingRoutine.id);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Resultado eliminado' });
    setLeaderboardNonce((n) => n + 1);
    void fetchExercises();
    void fetchActiveDates();
  }, [user?.id, viewingRoutine, dateStr, toast, fetchExercises, fetchActiveDates]);

  const resolveWorkoutLogId = useCallback(
    async (modality: 'crossfit' | 'funcional'): Promise<string | null> => {
      if (!user) return null;
      const { data: existing } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('workout_date', dateStr)
        .eq('modality', modality)
        .is('gym_routine_id', null)
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
                gym_routine_id: null,
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
                gym_routine_id: null,
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

  const executeConditioningPersist = useCallback(
    async (
      modality: 'crossfit' | 'funcional',
      overrides?: {
        crossfitDraft?: CrossfitLogDraft;
        functionalSessionDraft?: FunctionalSessionDraft;
      },
      opts?: { silent?: boolean },
    ): Promise<boolean> => {
      if (!user) return false;
      const cfDraft = overrides?.crossfitDraft ?? crossfitDraft;
      const fnDraft = overrides?.functionalSessionDraft ?? functionalSessionDraft;

      setBlockSaving(modality);

      let row: Record<string, unknown>;

      if (modality === 'crossfit') {
        const block_sections_payload = deriveCrossfitBlockSections(cfDraft).map((b, i) => ({
          id: b.id,
          sort_order: i,
          target_time: b.target_time.trim(),
        }));
        row = {
          user_id: user.id,
          workout_date: dateStr,
          modality,
          gym_routine_id: null,
          total_time: deriveCrossfitTotalTimeColumn(cfDraft),
          target_time: null,
          wod_title: crossfitWodTitle(cfDraft) || null,
          round_count: null,
          split_times: [],
          block_sections: block_sections_payload,
          crossfit_details: serializeCrossfitDetails(cfDraft),
          circuit_name: null,
          work_rest_note: null,
          functional_details: {},
        };
      } else {
        const draft = fnDraft;
        const block_sections_payload = deriveFunctionalBlockSections(draft).map((b, i) => ({
          id: b.id,
          sort_order: i,
          target_time: b.target_time.trim(),
        }));
        row = {
          user_id: user.id,
          workout_date: dateStr,
          modality,
          gym_routine_id: null,
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
          ? deriveCrossfitBlockSections(cfDraft)
          : deriveFunctionalBlockSections(fnDraft);
      const { data, error } = await supabase
        .from('workout_logs')
        .upsert(row as Tables<'workout_logs'>['Insert'], {
          onConflict: 'user_id,workout_date,modality,gym_routine_id',
        })
        .select()
        .single();
      setBlockSaving(null);
      if (error || !data) {
        toast({ title: 'Error', description: error?.message, variant: 'destructive' });
        return false;
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
      if (!opts?.silent) {
        toast({ title: 'Bloque guardado', description: 'WOD y tiempos guardados.' });
      }
      fetchExercises();
      return true;
    },
    [user, dateStr, crossfitDraft, functionalSessionDraft, toast, fetchExercises, syncMovementsToLog],
  );

  const saveConditioningWithAutoLibrary = useCallback(
    async (modality: 'crossfit' | 'funcional') => {
      const ok = await executeConditioningPersist(modality);
      if (!ok || !user) return;
      const draft = modality === 'crossfit' ? crossfitDraft : functionalSessionDraft;
      const templateName =
        modality === 'crossfit'
          ? crossfitWodTitle(crossfitDraft).trim() || `CrossFit · ${dateStr}`
          : functionalSessionDraft.session_name.trim() || `Funcional · ${dateStr}`;
      const { error: tplErr } = await insertConditioningRoutineTemplate(supabase, user.id, {
        name: templateName,
        modality,
        draft,
      });
      if (tplErr) {
        toast({
          title: 'Entrenamiento guardado',
          description: 'No se pudo guardar la copia en Mis Rutinas.',
          variant: 'destructive',
        });
      }
    },
    [
      executeConditioningPersist,
      user,
      crossfitDraft,
      functionalSessionDraft,
      dateStr,
      toast,
    ],
  );

  const applyConditioningFromSavedTemplate = useCallback(
    async (modality: 'crossfit' | 'funcional', draft: CrossfitLogDraft | FunctionalSessionDraft) => {
      if (!user) return;
      setActiveModalidad(modality);
      setPersonalConditioningEditorOpen(true);
      if (modality === 'crossfit') {
        const cf = draft as CrossfitLogDraft;
        setCrossfitDraft(cf);
        await executeConditioningPersist('crossfit', { crossfitDraft: cf }, { silent: true });
      } else {
        const fn = draft as FunctionalSessionDraft;
        setFunctionalSessionDraft(fn);
        await executeConditioningPersist('funcional', { functionalSessionDraft: fn }, { silent: true });
      }
      toast({
        title: 'Rutina cargada',
        description: 'Ya está aplicada al día actual; podés editarla y volver a guardar.',
      });
    },
    [user, executeConditioningPersist, toast, setActiveModalidad],
  );

  useEffect(() => {
    if (activeModalidad !== 'musculacion') setAddingExercise(false);
  }, [activeModalidad]);
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

    await insertMissingExerciseLibraryEntries(
      supabase,
      user.id,
      [{ name, muscle_group: group }],
      modalityToLibraryCategory(activeModalidad),
    );

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
    if (activeModalidad === 'crossfit' || activeModalidad === 'funcional') {
      toast({
        title: 'Biblioteca en tus bloques',
        description:
          'En CrossFit/Funcional sumá movimientos dentro de cada AMRAP o fase: usá el campo con sugerencias o escribí uno nuevo.',
      });
      return;
    }
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
    if (activeModalidad === 'crossfit' || activeModalidad === 'funcional') {
      toast({
        title: 'Plantillas en Musculación',
        description: 'Pasá a la pestaña Musculación para cargar una plantilla con series y peso.',
      });
      return;
    }
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
    await insertMissingExerciseLibraryEntries(
      supabase,
      user.id,
      templateExercises.map((ex) => ({ name: ex.name, muscle_group: ex.muscle_group })),
      'Musculación',
    );
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
            const ds = formatLocalDateISO(d);
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

  const showDailyReportButton = isGymView
    ? hydrated && !!user
    : showWorkoutUI && (exercises.length > 0 || isToday);

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

  const hasAnyAssignedBlockExercise = sectionsForGrouping.some((s) =>
    visibleExercises.some((e) => e.conditioning_block_id === s.id),
  );

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
          title="Entreno"
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
            "[html[data-brand='pink']_&]:border-[#ff007f]/28 [html[data-brand='pink']_&]:shadow-none",
            "dark:[html[data-brand='pink']_&]:border-pink-800/45",
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

        {showGymSwitch ? (
          <div
            className="workout-gym-scope-tablist mx-auto mb-5 flex w-full max-w-md rounded-full border border-zinc-200 bg-zinc-100 p-1 shadow-inner dark:border-zinc-800 dark:bg-zinc-900"
            role="tablist"
            aria-label="Ámbito del entrenamiento"
          >
            {(['personal', 'gimnasio'] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                role="tab"
                aria-selected={workoutScope === scope}
                onClick={() => setWorkoutScope(scope)}
                className={cn(
                  'w-1/2 flex-1 rounded-full px-4 py-2 text-center text-xs font-bold transition-all duration-300 sm:text-sm',
                  workoutScope === scope
                    ? 'bg-primary text-zinc-950 shadow-md'
                    : 'bg-transparent text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                )}
              >
                {scope === 'personal' ? 'Personal' : 'Gimnasio'}
              </button>
            ))}
          </div>
        ) : null}

        <WorkoutModalityTabs
          value={activeModalidad}
          onChange={setActiveModalidad}
          allowedModalities={isGymView ? gymAllowedModalities : undefined}
          className="mb-5"
        />

        {isGymView ? (
          <div className="space-y-4">
            <p className="text-center text-xs font-medium text-muted-foreground">
              Tocá un día para ver la rutina del coach y registrar tu resultado en esta fecha (
              <span className="tabular-nums">{dateStr}</span>).
            </p>
            {gymRoutinesLoading ? (
              <p className="text-center text-sm text-muted-foreground">Cargando rutinas…</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const row = gymRoutines.find((r) => r.day_number === d);
                const dayLog = row ? gymRoutineLogById.get(row.id) : undefined;
                const filled = Boolean(dayLog);
                const gymDaySheetOpen =
                  (viewerOpen && viewingRoutine?.day_number === d) ||
                  (registerOpen && registerRoutine?.day_number === d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!row}
                    onClick={() => {
                      if (!row) return;
                      setViewingRoutine(row);
                      setViewerOpen(true);
                    }}
                    className={cn(
                      'workout-gym-day-cell flex min-h-[5rem] flex-col rounded-2xl border px-3 py-3 text-left transition-colors',
                      filled && 'workout-gym-day-cell--filled',
                      gymDaySheetOpen && 'workout-gym-day-cell--viewing',
                      row
                        ? cn(
                            'transition-all duration-200 motion-safe:active:scale-[0.98] motion-safe:active:brightness-110',
                            filled
                              ? 'border-emerald-500/45 bg-emerald-500/[0.06] hover:bg-emerald-500/10'
                              : 'border-primary/35 bg-card shadow-sm hover:bg-accent/40',
                            "[html[data-brand='pink']_&]:border-[#ff007f]/30",
                          )
                        : 'cursor-default border-dashed border-border/50 bg-muted/25 opacity-80',
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Día {d}</span>
                      {row && !filled ? (
                        <span
                          className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--brand-glow-sm)]"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    {row ? (
                      <>
                        <span className="mt-1 line-clamp-2 text-xs font-semibold text-foreground">
                          {row.title?.trim() || 'Ver rutina'}
                        </span>
                        <span
                          className={cn(
                            'mt-auto pt-2 text-[10px] font-medium leading-snug',
                            filled
                              ? 'text-emerald-700 dark:text-emerald-400 workout-gym-day-status'
                              : 'text-zinc-600 dark:text-zinc-500',
                          )}
                        >
                          {filled ? subtitleForGymRoutineLog(dayLog, activeModalidad) : 'Rutina'}
                        </span>
                      </>
                    ) : (
                      <div className="mt-auto flex flex-col items-start gap-1 pt-2">
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-zinc-600 dark:text-zinc-500" aria-hidden />
                        <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-500">Sin rutina</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : showEmptyPastState ? (
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
              <>
                {!personalConditioningEditorOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPersonalConditioningEditorOpen(true)}
                    className={cn(
                      'h-14 w-full rounded-2xl border border-border/60 bg-secondary text-base font-bold tracking-tight text-foreground shadow-none hover:bg-accent',
                      "[html[data-brand='pink']_&]:border-0 [html[data-brand='pink']_&]:bg-primary [html[data-brand='pink']_&]:text-primary-foreground",
                      "[html[data-brand='pink']_&]:shadow-none [html[data-brand='pink']_&]:hover:bg-[color:var(--brand-hover)] [html[data-brand='pink']_&]:hover:text-primary-foreground",
                    )}
                  >
                    <Plus
                      className={cn(
                        'mr-2 h-5 w-5 text-primary',
                        "[html[data-brand='pink']_&]:text-primary-foreground",
                      )}
                      strokeWidth={2}
                    />
                    Agregar rutina de {activeModalidad === 'crossfit' ? 'CrossFit' : 'Funcional'}
                  </Button>
                ) : (
                  <div className={cn(CONDITIONING_BLOCK_SHELL, activeModalidad === 'crossfit' && 'space-y-2')}>
                    {activeModalidad === 'crossfit' && (
                      <CrossfitWodLogPanel
                        draft={crossfitDraft}
                        onChange={setCrossfitDraft}
                        onSubtypeChange={handleCrossfitSubtypeChange}
                        onAmrapBlockRemoved={handleCrossfitAmrapBlockRemoved}
                        onSave={() => void saveConditioningWithAutoLibrary('crossfit')}
                        saving={blockSaving === 'crossfit'}
                      />
                    )}
                    {activeModalidad === 'funcional' && (
                      <FunctionalSessionLogPanel
                        draft={functionalSessionDraft}
                        onChange={setFunctionalSessionDraft}
                        onPhaseRemoved={handleFunctionalPhaseRemoved}
                        onSave={() => void saveConditioningWithAutoLibrary('funcional')}
                        saving={blockSaving === 'funcional'}
                      />
                    )}
                    <div className="space-y-4">
                      {sectionsForGrouping.map((sec, idx) => {
                        const inBlock = visibleExercises.filter((e) => e.conditioning_block_id === sec.id);
                        if (
                          (activeModalidad === 'crossfit' || activeModalidad === 'funcional') &&
                          inBlock.length === 0
                        )
                          return null;
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
                        <div
                          className={cn(
                            'space-y-2',
                            hasAnyAssignedBlockExercise
                              ? 'border-t border-dashed border-border/50 pt-3'
                              : 'pt-1',
                          )}
                        >
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setPersonalConditioningEditorOpen(false)}
                    >
                      Ocultar editor de rutina
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3.5">{strengthExerciseCards}</div>
            )}

            {hydrated &&
              activeModalidad === 'musculacion' &&
              visibleExercises.length === 0 &&
              !addingExercise &&
              (isToday || enableEmptyDay) && (
                <p className="py-12 text-center text-xs font-medium text-muted-foreground/50 tracking-wide">
                  Agrega tu primer ejercicio para comenzar
                </p>
              )}

            {/* Inline add-exercise form (solo musculación — CF/FUNC usan bloques propios). */}
            {addingExercise && activeModalidad === 'musculacion' ? (
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

                <div
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newExGroup) void confirmAddExercise();
                  }}
                >
                  <ExerciseNameSuggestInput
                    modality="musculacion"
                    placeholder="Nombre del ejercicio"
                    value={newExName}
                    onChange={setNewExName}
                    className="[&_input]:h-12 [&_input]:rounded-xl [&_input]:border-none [&_input]:bg-accent [&_input]:text-foreground"
                  />
                </div>

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

                <Button
                  onClick={confirmAddExercise}
                  disabled={!newExName.trim() || !newExGroup}
                  className="h-12 w-full rounded-xl border-0 bg-primary font-semibold text-primary-foreground shadow-none hover:bg-[color:var(--brand-hover)]"
                >
                  Confirmar
                </Button>
              </div>
            ) : (
              activeModalidad === 'musculacion' &&
              (isToday || enableEmptyDay || visibleExercises.length > 0) && (
                <Button
                  onClick={() => setAddingExercise(true)}
                  variant="secondary"
                  className={cn(
                    'h-14 w-full rounded-2xl border border-border/60 bg-secondary text-base font-bold tracking-tight text-foreground shadow-none hover:bg-accent',
                    "[html[data-brand='pink']_&]:border-0 [html[data-brand='pink']_&]:bg-primary [html[data-brand='pink']_&]:text-primary-foreground",
                    "[html[data-brand='pink']_&]:shadow-none [html[data-brand='pink']_&]:hover:bg-[color:var(--brand-hover)] [html[data-brand='pink']_&]:hover:text-primary-foreground",
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

        {showDailyReportButton ? (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-border/40 bg-card/70 p-5 backdrop-blur-sm transition-colors hover:bg-accent/70"
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-xl',
                  'bg-green-500/10 dark:bg-primary/10',
                  "[html[data-brand='pink']_&]:bg-primary/10",
                )}
              >
                <FileText
                  className={cn(
                    'h-5 w-5 text-green-600 dark:text-primary',
                    "[html[data-brand='pink']_&]:text-[#ff007f]",
                  )}
                  aria-hidden
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold tracking-tight text-foreground">Ver Reporte del Día</p>
                <p className="text-xs text-muted-foreground/60">
                  <span className="tabular-nums">{dateStr}</span>
                  {' · '}
                  Bitácora, nutrición y descanso
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </button>
        ) : null}
      </div>

      <Sheet open={viewerOpen} onOpenChange={setViewerOpen}>
        <SheetContent
          side="bottom"
          className={cn(
            'flex max-h-[88vh] flex-col gap-3 overflow-hidden rounded-t-3xl border border-border/60 px-4 pb-6 pt-4',
            "[html[data-brand='pink']_&]:border-[#ff007f]/28",
            "dark:[html[data-brand='pink']_&]:border-pink-800/45",
          )}
        >
          <SheetHeader className="flex-shrink-0 border-b border-border/40 pb-3 text-left">
            <SheetTitle className="text-lg font-bold tracking-tight">Rutina del gimnasio</SheetTitle>
          </SheetHeader>
          {viewingRoutine ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
                <GymRoutineBlockViewer
                  payload={parseGymRoutineWorkoutData(
                    viewingRoutine.modality as WorkoutModalityId,
                    viewingRoutine.workout_data,
                  )}
                  title={viewingRoutine.title ?? ''}
                  dayNumber={viewingRoutine.day_number}
                  coachNotes={viewingRoutine.coach_notes}
                />
                {viewingRoutine.modality === 'crossfit' || viewingRoutine.modality === 'funcional' ? (
                  <GymRoutineLeaderboard
                    routine={viewingRoutine}
                    workoutDate={dateStr}
                    currentUserId={user?.id ?? null}
                    refreshNonce={leaderboardNonce}
                    onEditOwnResult={user?.id ? handleEditOwnGymRanking : undefined}
                    onDeleteOwnResult={user?.id ? handleDeleteOwnGymRanking : undefined}
                  />
                ) : null}
              </div>
              <Button
                type="button"
                className="workout-gym-register-cta h-12 w-full shrink-0 rounded-2xl font-semibold"
                onClick={openGymRegisterFresh}
              >
                Registrar mi resultado
              </Button>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {user?.id ? (
        <GymRoutineRegisterSheet
          open={registerOpen}
          onClose={closeGymRegisterSheet}
          userId={user.id}
          dateStr={dateStr}
          routine={registerRoutine}
          initialQuickResult={registerQuickPrefill}
          variant={registerSheetVariant}
          onRecorded={handleGymResultRecorded}
        />
      ) : null}

      <DailyReportSheet
        key={dateStr}
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
        onApplyConditioningTemplate={applyConditioningFromSavedTemplate}
      />

      <PersonalRecordsSheet open={prSheetOpen} onClose={() => setPrSheetOpen(false)} />
    </div>
  );
};

export default Workout;
