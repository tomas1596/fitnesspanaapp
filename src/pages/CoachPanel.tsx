import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  ADMIN_ONLINE_WINDOW_MS,
  formatLastActiveLabel,
  isActivityWithinAge,
  lastActiveDotTone,
} from '@/lib/lastActivityLabel';
import { ArrowLeft, BookMarked, FolderOpen, Medal, Plus, Trash2, User, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { GymRoutineCoachDialog } from '@/components/GymRoutineCoachDialog';
import { GymRoutineVariantPickerSheet } from '@/components/GymRoutineVariantPickerSheet';
import { gymRoutinesForDay, gymVariantDisplayLabel } from '@/lib/gymRoutineVariants';
import { CoachTemplatePickerSheet } from '@/components/CoachTemplatePickerSheet';
import type { Tables } from '@/integrations/supabase/types';
import { WORKOUT_MODALITY_OPTIONS, modalityIdsAllowedByGymLabels } from '@/lib/workoutModality';
import type { WorkoutModalityId } from '@/lib/workoutModality';
import type { GymRoutineWorkoutPayload } from '@/lib/gymRoutineWorkoutData';

type CoachStudentRow = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  last_active_at: string | null;
};

function StudentActivityCell({ iso, refreshTick }: { iso: string | null; refreshTick: number }) {
  void refreshTick;
  const now = new Date();
  const isOnlineNow = isActivityWithinAge(iso, ADMIN_ONLINE_WINDOW_MS, now);
  const tone = lastActiveDotTone(iso);
  const dotClass =
    tone === 'live'
      ? 'bg-emerald-500 shadow-[0_0_7px_rgba(34,197,94,0.45)]'
      : tone === 'stale'
        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.35)]'
        : tone === 'idle'
          ? 'bg-zinc-400 dark:bg-zinc-500'
          : 'bg-zinc-400/45 dark:bg-zinc-600';

  const title = isOnlineNow
    ? 'Usando la app en los últimos 3 minutos'
    : tone === 'live'
      ? 'Activo en las últimas 24 h'
      : tone === 'stale'
        ? 'Sin usar la app 7 días o más'
        : tone === 'idle'
          ? 'Activo entre hace 1 y 7 días'
          : 'Sin marca de última actividad';

  return (
    <div className="flex min-w-0 items-start gap-2">
      {isOnlineNow ? (
        <span
          className="min-w-0 select-none tabular-nums tracking-tight break-words font-semibold text-xs leading-snug text-lime-500 drop-shadow-[0_0_10px_rgba(163,230,53,0.75)] dark:text-lime-200 dark:drop-shadow-[0_0_12px_rgba(190,242,100,0.55)]"
          title={title}
        >
          ● En Línea
        </span>
      ) : (
        <>
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClass)} title={title} aria-hidden />
          <span className="min-w-0 break-words text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            {formatLastActiveLabel(iso)}
          </span>
        </>
      )}
    </div>
  );
}

const CoachPanel = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [gymName, setGymName] = useState<string | null>(null);
  const [coachProfileId, setCoachProfileId] = useState<string | null>(null);
  const [gymModalities, setGymModalities] = useState<string[]>([]);
  const [libraryModality, setLibraryModality] = useState<WorkoutModalityId>('musculacion');
  const [gymRoutines, setGymRoutines] = useState<Tables<'gym_routines'>[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [routineDialogOpen, setRoutineDialogOpen] = useState(false);
  const [routineDialogDay, setRoutineDialogDay] = useState(1);
  const [routineDialogExisting, setRoutineDialogExisting] = useState<Tables<'gym_routines'> | null>(null);
  const [selectedCoachDay, setSelectedCoachDay] = useState(1);
  const [coachTemplatesPickerOpen, setCoachTemplatesPickerOpen] = useState(false);
  const [coachVariantPickerOpen, setCoachVariantPickerOpen] = useState(false);
  const [coachVariantPickerDay, setCoachVariantPickerDay] = useState(1);
  const [coachVariantPickerRoutines, setCoachVariantPickerRoutines] = useState<Tables<'gym_routines'>[]>([]);
  const [templatePrefill, setTemplatePrefill] = useState<{
    title: string;
    coach_notes: string;
    payload: GymRoutineWorkoutPayload;
  } | null>(null);

  const [rows, setRows] = useState<CoachStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityRefreshTick, setActivityRefreshTick] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<CoachStudentRow | null>(null);
  const [removeDoing, setRemoveDoing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: prof }, { data: students, error: rpcError }] = await Promise.all([
        supabase.from('profiles').select('gym_name, id, gym_modalities').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('get_coach_students'),
      ]);

      const pr = prof as { gym_name?: string | null; id?: string; gym_modalities?: string[] } | null;
      const g = pr?.gym_name?.trim();
      setGymName(g || null);
      setCoachProfileId(typeof pr?.id === 'string' ? pr.id : null);
      setGymModalities(Array.isArray(pr?.gym_modalities) ? pr.gym_modalities : []);

      if (rpcError) throw rpcError;
      const raw = (students ?? []) as Record<string, unknown>[];
      setRows(
        raw.map((r) => ({
          id: String(r.id ?? ''),
          full_name: (typeof r.full_name === 'string' ? r.full_name : null) ?? null,
          email: typeof r.email === 'string' ? r.email : '',
          avatar_url: typeof r.avatar_url === 'string' ? r.avatar_url : null,
          last_active_at: typeof r.last_active_at === 'string' ? r.last_active_at : null,
        })),
      );
    } catch (e) {
      const msg =
        e != null && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'No se pudo cargar la lista';
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const pulse = () => setActivityRefreshTick((n) => n + 1);
    pulse();
    const id = window.setInterval(pulse, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const allowedLibraryModalities = useMemo(
    () => modalityIdsAllowedByGymLabels(gymModalities),
    [gymModalities],
  );

  useEffect(() => {
    if (!allowedLibraryModalities.includes(libraryModality)) {
      setLibraryModality(allowedLibraryModalities[0] ?? 'musculacion');
    }
  }, [allowedLibraryModalities, libraryModality]);

  const loadRoutines = useCallback(async () => {
    if (!coachProfileId) return;
    setLibraryLoading(true);
    try {
      const { data, error: lrErr } = await supabase
        .from('gym_routines')
        .select('*')
        .eq('coach_id', coachProfileId)
        .eq('modality', libraryModality)
        .order('day_number')
        .order('variant_name', { ascending: true, nullsFirst: true });
      if (lrErr) throw lrErr;
      setGymRoutines(data ?? []);
    } catch {
      setGymRoutines([]);
    } finally {
      setLibraryLoading(false);
    }
  }, [coachProfileId, libraryModality]);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    if (!coachVariantPickerOpen) return;
    setCoachVariantPickerRoutines(gymRoutinesForDay(gymRoutines, coachVariantPickerDay));
  }, [gymRoutines, coachVariantPickerOpen, coachVariantPickerDay]);

  const openRoutineEditor = useCallback((day: number, existing: Tables<'gym_routines'> | null) => {
    setSelectedCoachDay(day);
    setRoutineDialogDay(day);
    setRoutineDialogExisting(existing);
    setRoutineDialogOpen(true);
  }, []);

  const openNewRoutine = useCallback(() => {
    setSelectedCoachDay(1);
    setRoutineDialogDay(1);
    setRoutineDialogExisting(null);
    setRoutineDialogOpen(true);
  }, []);

  const handleCoachDayClick = useCallback(
    (day: number) => {
      const dayRoutines = gymRoutinesForDay(gymRoutines, day);
      if (dayRoutines.length <= 1) {
        openRoutineEditor(day, dayRoutines[0] ?? null);
        return;
      }
      setCoachVariantPickerDay(day);
      setCoachVariantPickerRoutines(dayRoutines);
      setCoachVariantPickerOpen(true);
    },
    [gymRoutines, openRoutineEditor],
  );

  const consumeTemplatePrefill = useCallback(() => setTemplatePrefill(null), []);

  const handleApplyCoachTemplate = useCallback(
    (data: { title: string; coach_notes: string; payload: GymRoutineWorkoutPayload }) => {
      const nextMod = data.payload.modality as WorkoutModalityId;
      setLibraryModality(nextMod);
      setTemplatePrefill(data);
      setRoutineDialogExisting(null);
      setRoutineDialogDay(selectedCoachDay);
      setRoutineDialogOpen(true);
    },
    [selectedCoachDay],
  );

  const handleConfirmRemoveStudent = useCallback(async () => {
    const row = removeTarget;
    if (!row?.id) return;
    setRemoveDoing(true);
    try {
      const { error: rpcError } = await supabase.rpc('coach_remove_student', {
        p_student_id: row.id,
      });
      if (rpcError) throw rpcError;
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setRemoveTarget(null);
      toast({
        title: 'Alumno desvinculado',
        description: row.full_name?.trim() || row.email || undefined,
      });
    } catch (err) {
      const msg =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'No se pudo desvincular';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRemoveDoing(false);
    }
  }, [removeTarget, toast]);

  return (
    <div
      className="min-h-screen bg-white px-4 pb-8 pt-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 transition-all duration-300 active:scale-90 dark:border-white/10 dark:bg-zinc-900/80"
            onClick={() => navigate('/profile')}
            aria-label="Volver al perfil"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Medal className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight">Panel de Coach</h1>
              <p className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {gymName ?? 'Tu espacio como coach'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <Tabs defaultValue="alumnos" className="w-full">
          <TabsList className="mb-6 grid h-11 w-full grid-cols-2 rounded-xl border border-zinc-200/80 bg-zinc-100/80 p-1 dark:border-white/10 dark:bg-zinc-900/60">
            <TabsTrigger
              value="alumnos"
              className="rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800"
            >
              Mis Alumnos
            </TabsTrigger>
            <TabsTrigger
              value="rutinas"
              className="rounded-lg text-sm font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800"
            >
              Biblioteca de Rutinas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alumnos" className="mt-0">
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-2 dark:border-white/10 dark:bg-zinc-900/40">
              {loading ? (
                <div className="space-y-3 p-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/12 dark:bg-primary/15">
                    <Users className="h-8 w-8 text-primary" aria-hidden />
                  </div>
                  <p className="max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Aún no tienes alumnos. ¡Comparte tu código de invitación para empezar!
                  </p>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate('/profile')}>
                    Ir a mi código
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((r) => {
                    const displayName = r.full_name?.trim() || '—';
                    return (
                      <div
                        key={r.id}
                        className="rounded-2xl border border-transparent px-4 py-4 transition-colors hover:border-zinc-200/80 hover:bg-white dark:hover:border-white/10 dark:hover:bg-zinc-800/50 sm:py-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-zinc-100 dark:bg-zinc-800">
                              {r.avatar_url ? (
                                <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-zinc-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{displayName}</div>
                              <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{r.email || '—'}</div>
                              <div className="mt-2 sm:hidden">
                                <StudentActivityCell iso={r.last_active_at} refreshTick={activityRefreshTick} />
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                            <div className="hidden min-w-0 flex-1 sm:block lg:max-w-[230px]">
                              <StudentActivityCell iso={r.last_active_at} refreshTick={activityRefreshTick} />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                              title="Desvincular alumno"
                              aria-label="Desvincular alumno"
                              onClick={() => setRemoveTarget(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rutinas" className="mt-0">
        <section
          className={cn(
            'rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/40',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 dark:bg-primary/15">
              <BookMarked className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight">Biblioteca de rutinas</h2>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Tus plantillas por día y modalidad. Los alumnos las ven en Entrenamiento → Gimnasio.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1 rounded-2xl border border-zinc-200/70 bg-white/80 p-1 dark:border-white/10 dark:bg-zinc-950/60">
            {allowedLibraryModalities.map((mid) => {
              const label = WORKOUT_MODALITY_OPTIONS.find((o) => o.id === mid)?.label ?? mid;
              const active = libraryModality === mid;
              return (
                <button
                  key={mid}
                  type="button"
                  onClick={() => setLibraryModality(mid)}
                  className={cn(
                    'flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/80',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-dashed"
                disabled={!coachProfileId || !user?.id}
                onClick={openNewRoutine}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Nueva rutina
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!user?.id}
                onClick={() => setCoachTemplatesPickerOpen(true)}
              >
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Ver mis plantillas
              </Button>
            </div>
            {libraryLoading ? (
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cargando…</span>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const dayRoutines = gymRoutinesForDay(gymRoutines, d);
              const hasRoutines = dayRoutines.length > 0;
              const multiple = dayRoutines.length > 1;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!coachProfileId}
                  onClick={() => handleCoachDayClick(d)}
                  className={cn(
                    'flex min-h-[5.25rem] flex-col items-start rounded-2xl border px-3 py-3 text-left transition-colors',
                    hasRoutines
                      ? 'border-primary/35 bg-white shadow-sm dark:border-primary/30 dark:bg-zinc-900/80'
                      : 'border-zinc-200/70 border-dashed bg-white/60 hover:bg-white dark:border-white/15 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/70',
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Día {d}</span>
                  {hasRoutines ? (
                    multiple ? (
                      <div className="mt-1 flex w-full flex-col gap-1">
                        {dayRoutines.map((r) => (
                          <span
                            key={r.id}
                            className="line-clamp-2 text-[11px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
                          >
                            {gymVariantDisplayLabel(r)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-1 line-clamp-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {dayRoutines[0].title?.trim() || 'Rutina'}
                      </span>
                    )
                  ) : (
                    <span className="mt-1 line-clamp-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      Vacío · tocar
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !removeDoing) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent
          className={cn(
            'rounded-2xl border-zinc-200/80 bg-white dark:border-white/10 dark:bg-zinc-900',
            "[html[data-brand='pink']_&]:border-[#ff007f]/35",
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-900 dark:text-zinc-50">Desvincular alumno</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              Ya no aparecerá en tu lista y podrá volver a vincularse con otro código si lo necesita.
              {removeTarget?.email ? (
                <span className="mt-3 block rounded-lg bg-zinc-100 px-3 py-2 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {removeTarget.full_name?.trim() ? `${removeTarget.full_name.trim()} · ` : ''}
                  {removeTarget.email}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={removeDoing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
              disabled={removeDoing}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRemoveStudent();
              }}
            >
              {removeDoing ? '…' : 'Desvincular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GymRoutineVariantPickerSheet
        open={coachVariantPickerOpen}
        onOpenChange={setCoachVariantPickerOpen}
        dayNumber={coachVariantPickerDay}
        routines={coachVariantPickerRoutines}
        title="Elegí qué variante editar"
        coachMode
        onRoutinesRefresh={() => void loadRoutines()}
        onSelect={(routine) => {
          setCoachVariantPickerOpen(false);
          openRoutineEditor(routine.day_number, routine);
        }}
        onAddVariant={() => {
          setCoachVariantPickerOpen(false);
          openRoutineEditor(coachVariantPickerDay, null);
        }}
      />

      {coachProfileId ? (
        <GymRoutineCoachDialog
          open={routineDialogOpen}
          onOpenChange={setRoutineDialogOpen}
          coachProfileId={coachProfileId}
          coachAuthUserId={user?.id ?? null}
          gymModalities={gymModalities}
          modality={libraryModality}
          dayNumber={routineDialogDay}
          existing={routineDialogExisting}
          templatePrefill={templatePrefill}
          onTemplatePrefillConsumed={consumeTemplatePrefill}
          onSaved={() => void loadRoutines()}
        />
      ) : null}

      {user?.id ? (
        <CoachTemplatePickerSheet
          open={coachTemplatesPickerOpen}
          onClose={() => setCoachTemplatesPickerOpen(false)}
          libraryModalityFilter={libraryModality}
          onApply={handleApplyCoachTemplate}
        />
      ) : null}
    </div>
  );
};

export default CoachPanel;
