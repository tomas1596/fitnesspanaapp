import { useEffect, useState, type ComponentType } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dumbbell, Utensils, Droplet, TrendingUp, ChevronDown, Flame, Footprints, Sun, Sunset, Cookie, Moon, Zap, Repeat2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CaloriesRing from '@/components/CaloriesRing';
import { calculateAge } from '@/lib/age';
import { localDayBoundsISO } from '@/lib/nutritionDay';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { parseWorkoutSplitTimes, parseMovementSnapshot, parseWorkoutBlockSections, flattenMovementSnapshot } from '@/lib/workoutModality';
import {
  CROSSFIT_SUBTYPE_LABELS,
  crossfitWarmupHasContent,
  hydrateOrMigrateCrossfitDetails,
  type CrossfitLogDraft,
  type ManualExerciseLine,
} from '@/lib/crossfitWodDraft';

import {
  FUNCTIONAL_METHOD_LABELS,
  FUNCTIONAL_PHASE_LABELS,
  hydrateOrMigrateFunctionalDetails,
  sessionHasManualExercises,
  type FunctionalPhaseDraft,
  type FunctionalPhaseType,
  type FunctionalSessionDraft,
} from '@/lib/functionalSessionDraft';

type MealGroupKey = 'desayuno' | 'almuerzo' | 'cena' | 'merienda';

function functionalPhaseDotClass(t: FunctionalPhaseType): string {
  switch (t) {
    case 'warmup':
      return 'bg-emerald-500 dark:bg-emerald-400';
    case 'main':
      return 'bg-red-500 dark:bg-red-400';
    case 'core':
      return 'bg-orange-500 dark:bg-orange-400';
    case 'cooldown':
      return 'bg-sky-500 dark:bg-sky-400';
    default:
      return 'bg-muted-foreground';
  }
}

function FunctionalPhaseReportBlock({ phase, index }: { phase: FunctionalPhaseDraft; index: number }) {
  const phaseLabel = FUNCTIONAL_PHASE_LABELS.find((x) => x.id === phase.phase_type)?.label ?? '';
  const methodLabel = FUNCTIONAL_METHOD_LABELS.find((x) => x.id === phase.method)?.label ?? '';
  const filledExercises = phase.exercises.filter((e) => e.name.trim());

  let metaLines: string[] = [];
  switch (phase.method) {
    case 'free':
      if (phase.note.trim()) metaLines.push(phase.note.trim());
      break;
    case 'rounds_circuit':
      if (phase.round_count.trim()) metaLines.push(`${phase.round_count.trim()} rondas`);
      break;
    case 'time_intervals':
      metaLines = [
        phase.work_time.trim() ? `Trabajo: ${phase.work_time.trim()}` : '',
        phase.rest_time.trim() ? `Descanso: ${phase.rest_time.trim()}` : '',
        phase.rounds.trim() ? `Tandas: ${phase.rounds.trim()}` : '',
      ].filter(Boolean);
      break;
    case 'tabata':
      metaLines.push('20 s trabajo · 10 s descanso · 8 rondas');
      if (phase.tabata_note.trim()) metaLines.push(phase.tabata_note.trim());
      break;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-muted/20 p-3 dark:bg-muted/15',
        "[html[data-brand='pink']_&]:border-[#ff007f]/25",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', functionalPhaseDotClass(phase.phase_type))} aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wide text-foreground">
          Fase {index + 1} · {phaseLabel}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{methodLabel}</p>
      {metaLines.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {metaLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
      {filledExercises.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-border/50 pt-2 dark:border-border/40">
          {filledExercises.map((ex) => (
            <li key={ex.id} className="text-xs text-foreground">
              <span className="text-muted-foreground/60">·</span> {ex.name.trim()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Sin ejercicios listados en esta fase.</p>
      )}
    </div>
  );
}

function renderFunctionalSessionReport(draft: FunctionalSessionDraft) {
  return (
    <div className="mt-3 space-y-3">
      {draft.phases.map((phase, i) => (
        <FunctionalPhaseReportBlock key={phase.id} phase={phase} index={i} />
      ))}
    </div>
  );
}

function crossfitDraftHasManualExercises(d: CrossfitLogDraft): boolean {
  switch (d.subtype) {
    case 'amrap':
      return d.blocks.some((b) => b.exercises.some((e) => e.name.trim()));
    case 'emom':
    case 'for_time':
    case 'classic_benchmark_tabata':
      return d.exercises.some((e) => e.name.trim());
    default:
      return false;
  }
}

function ReportModalityHeader({
  icon: Icon,
  label,
  variant,
}: {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  variant: 'strength' | 'crossfit' | 'funcional';
}) {
  const shell =
    variant === 'strength'
      ? cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
          'border-border/70 bg-muted/40 text-foreground',
          'dark:border-border dark:bg-secondary/80',
          "[html[data-brand='pink']_&]:border-[#ff007f]/35",
        )
      : variant === 'crossfit'
        ? cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            'border-primary/35 bg-primary/10 text-primary',
            'dark:border-primary/40 dark:bg-primary/15',
          )
        : cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
            "[html[data-brand='pink']_&]:border-[#ff007f]/35",
          );
  return (
    <div className={shell}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

const LEGACY_MEAL_TO_GROUP: Record<string, MealGroupKey> = {
  breakfast: 'desayuno',
  lunch: 'almuerzo',
  dinner: 'cena',
  merienda: 'merienda',
  desayuno: 'desayuno',
  almuerzo: 'almuerzo',
  cena: 'cena',
};

interface ExerciseSet {
  reps: number;
  weight: number;
  rir?: number;
  rounds?: number;
  time_seconds?: number;
  to_failure?: boolean;
}
interface ExerciseWithSets {
  id: string;
  name: string;
  muscle_group: string;
  modality?: string;
  workout_log_id?: string | null;
  conditioning_block_id?: string | null;
  sets: ExerciseSet[];
}

interface DailyReportSheetProps {
  open: boolean;
  onClose: () => void;
  dateStr: string;
  exercises: ExerciseWithSets[];
  workoutLogs: Tables<'workout_logs'>[];
}

const DailyReportSheet = ({ open, onClose, dateStr, exercises, workoutLogs }: DailyReportSheetProps) => {
  const { user } = useAuth();
  const [calories, setCalories] = useState({ total: 0, goal: 0, protein: 0, proteinGoal: 0, carbs: 0, fat: 0 });
  const [glasses, setGlasses] = useState(0);
  const [recovery, setRecovery] = useState({ sleep: 0, energy: 0 });
  const [foods, setFoods] = useState<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number; mealKey: MealGroupKey; quantity: number }[]>([]);
  const [foodsOpen, setFoodsOpen] = useState(false);
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(10000);

  useEffect(() => {
    setFoodsOpen(false);
  }, [dateStr]);

  useEffect(() => {
    if (!user || !open) return;

    supabase.from('profiles').select('weight, height, date_of_birth, gender, step_goal').eq('user_id', user.id).single().then(({ data }) => {
      if (data?.step_goal) setStepGoal(data.step_goal);
      const a = calculateAge(data?.date_of_birth);
      if (!data?.weight || !data?.height || a == null || a <= 0 || !data?.gender) return;
      const w = Number(data.weight), h = Number(data.height);
      const bmr = data.gender === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
      setCalories(prev => ({ ...prev, goal: Math.round(bmr * 1.55), proteinGoal: Math.round(w * 2) }));
    });

    const { start, end } = localDayBoundsISO(dateStr);

    Promise.all([
      supabase.from('food_entries').select('id, name, calories, protein, carbs, fat, meal, quantity').eq('user_id', user.id).eq('entry_date', dateStr).order('created_at'),
      supabase.from('nutrition_logs').select('id, food_name, calories, protein, carbs, fat, meal_type, quantity_multiplier, consumed_at').eq('user_id', user.id).gte('consumed_at', start).lte('consumed_at', end).order('consumed_at'),
    ]).then(([feRes, nlRes]) => {
      const fromLegacy = (feRes.data || []).map((f) => ({
        id: `fe:${f.id}`,
        name: f.name,
        calories: Number(f.calories),
        protein: Number(f.protein),
        carbs: Number(f.carbs ?? 0),
        fat: Number(f.fat ?? 0),
        mealKey: LEGACY_MEAL_TO_GROUP[(f.meal as string) || 'breakfast'] ?? 'desayuno',
        quantity: Number(f.quantity ?? 1),
      }));
      const fromLogs = (nlRes.data || []).map((f) => ({
        id: `nl:${f.id}`,
        name: f.food_name,
        calories: Number(f.calories),
        protein: Number(f.protein),
        carbs: Number(f.carbs ?? 0),
        fat: Number(f.fat ?? 0),
        mealKey: (LEGACY_MEAL_TO_GROUP[f.meal_type as string] ?? 'desayuno') as MealGroupKey,
        quantity: Number(f.quantity_multiplier ?? 1),
      }));
      const list = [...fromLegacy, ...fromLogs];
      const total = list.reduce((s, f) => s + f.calories, 0);
      const protein = list.reduce((s, f) => s + f.protein, 0);
      const carbs = list.reduce((s, f) => s + f.carbs, 0);
      const fat = list.reduce((s, f) => s + f.fat, 0);
      setCalories((prev) => ({ ...prev, total, protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }));
      setFoods(list);
    });

    supabase.from('hydration_logs').select('glasses').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle().then(({ data }) => {
      setGlasses(data?.glasses || 0);
    });

    supabase.from('recovery_logs').select('sleep_quality, energy_level').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle().then(({ data }) => {
      if (data) {
        setRecovery({
          sleep: Number(data.sleep_quality) || 0,
          energy: Number(data.energy_level) || 0,
        });
      } else {
        setRecovery({ sleep: 0, energy: 0 });
      }
    });

    supabase.from('step_logs').select('steps').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle().then(({ data }) => {
      setSteps(data?.steps || 0);
    });
  }, [user, dateStr, open]);

  const strengthExercises = exercises.filter((e) => !e.modality || e.modality === 'musculacion');
  const crossfitLog = workoutLogs.find((l) => l.modality === 'crossfit');
  const crossfitMoves = exercises.filter((e) => e.modality === 'crossfit');
  const funcionalLog = workoutLogs.find((l) => l.modality === 'funcional');
  const funcionalMoves = exercises.filter((e) => e.modality === 'funcional');

  const totalStrengthSets = strengthExercises.reduce((s, ex) => s + ex.sets.length, 0);
  const exerciseCountDisplay =
    strengthExercises.length + (crossfitMoves.length > 0 ? 1 : 0) + (funcionalMoves.length > 0 ? 1 : 0);

  const renderStrengthExercise = (ex: ExerciseWithSets) => (
    <li key={ex.id} className="rounded-lg bg-accent px-3 py-2">
      <p className="mb-1 text-sm font-medium text-foreground">{ex.name}</p>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{ex.muscle_group}</p>
      {ex.sets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin series</p>
      ) : (
        <ul className="space-y-1">
          {ex.sets.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 border-t border-border/30 pt-1 text-xs text-muted-foreground first:border-t-0 first:pt-0">
              <span className="font-semibold text-foreground">Serie {i + 1}</span>
              <span>
                {s.reps} reps · {s.weight} kg · RIR {s.rir ?? 0}
                {s.to_failure && (
                  <>
                    {' '}
                    · al fallo{' '}
                    <Flame className="inline h-3 w-3 fill-destructive text-destructive align-text-bottom" />
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  const renderSplitList = (log: Tables<'workout_logs'>) => {
    const splits = parseWorkoutSplitTimes(log.split_times).filter((x) => x.label.trim() || x.time.trim());
    if (splits.length === 0) return null;
    return (
      <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
        <li className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Tiempos parciales
        </li>
        {splits.map((sp, i) => (
          <li key={i} className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">{sp.label || `Parte ${i + 1}`}</span>
            <span className="shrink-0 font-mono tabular-nums text-foreground">{sp.time || '—'}</span>
          </li>
        ))}
      </ul>
    );
  };

  const renderMovementSnapList = (
    items: { id: string; name: string; muscle_group: string }[],
    title: string,
  ) => (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin movimientos listados</p>
      ) : (
        <ul className="space-y-1">
          {items.map((ex) => (
            <li key={ex.id || ex.name} className="text-xs text-foreground">
              <span className="text-muted-foreground/60">·</span> {ex.name}{' '}
              <span className="text-muted-foreground">({ex.muscle_group})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const cfMoveSnaps = crossfitLog ? flattenMovementSnapshot(crossfitLog.movements) : [];
  const cfDisplayMoves =
    cfMoveSnaps.length > 0
      ? cfMoveSnaps
      : crossfitMoves.map((e) => ({
          id: e.id,
          name: e.name,
          muscle_group: e.muscle_group,
        }));

  const fnMoveSnaps = funcionalLog ? flattenMovementSnapshot(funcionalLog.movements) : [];
  const fnDisplayMoves =
    fnMoveSnaps.length > 0
      ? fnMoveSnaps
      : funcionalMoves.map((e) => ({
          id: e.id,
          name: e.name,
          muscle_group: e.muscle_group,
        }));

  const cfStructured = crossfitLog ? parseMovementSnapshot(crossfitLog.movements) : null;
  const cfSectionsMeta = crossfitLog ? parseWorkoutBlockSections(crossfitLog.block_sections) : [];
  const cfTypedReport = crossfitLog
    ? hydrateOrMigrateCrossfitDetails(crossfitLog.crossfit_details, {
        wod_title: crossfitLog.wod_title,
        total_time: crossfitLog.total_time,
        target_time: crossfitLog.target_time,
        round_count: crossfitLog.round_count,
        block_sections: crossfitLog.block_sections,
      })
    : null;

  const fnStructured = funcionalLog ? parseMovementSnapshot(funcionalLog.movements) : null;
  const fnSectionsMeta = funcionalLog ? parseWorkoutBlockSections(funcionalLog.block_sections) : [];
  const fnTypedReport = funcionalLog
    ? hydrateOrMigrateFunctionalDetails(funcionalLog.functional_details, {
        circuit_name: funcionalLog.circuit_name,
        total_time: funcionalLog.total_time,
        work_rest_note: funcionalLog.work_rest_note,
        round_count: funcionalLog.round_count,
        block_sections: funcionalLog.block_sections,
      })
    : null;

  const renderCrossfitBlockHierarchy = () => {
    if (cfStructured && cfStructured.blocks.length > 0) {
      return (
        <>
          {cfStructured.blocks.map((b, i) => (
            <div
              key={b.id || `cfb-${i}`}
              className="mt-3 rounded-lg border border-primary/15 bg-muted/20 p-2.5 dark:bg-muted/25"
            >
              <p className="text-[11px] font-semibold text-foreground">
                Bloque {i + 1}
                {b.target_time.trim() ? (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · Objetivo coach: {b.target_time}
                  </span>
                ) : null}
              </p>
              {renderMovementSnapList(b.movements, 'Ejercicios')}
            </div>
          ))}
          {cfStructured.unassigned.length > 0 ? (
            <div className="mt-2">{renderMovementSnapList(cfStructured.unassigned, 'Sin bloque asignado')}</div>
          ) : null}
        </>
      );
    }
    if (cfSectionsMeta.length > 0) {
      return (
        <>
          {cfSectionsMeta.map((sec, i) => {
            const moves = crossfitMoves.filter((e) => e.conditioning_block_id === sec.id);
            const items = moves.map((e) => ({
              id: e.id,
              name: e.name,
              muscle_group: e.muscle_group,
            }));
            return (
              <div
                key={sec.id}
                className="mt-3 rounded-lg border border-primary/15 bg-muted/20 p-2.5 dark:bg-muted/25"
              >
                <p className="text-[11px] font-semibold text-foreground">
                  Bloque {i + 1}
                  {sec.target_time.trim() ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · Objetivo coach: {sec.target_time}
                    </span>
                  ) : null}
                </p>
                {renderMovementSnapList(items, 'Ejercicios')}
              </div>
            );
          })}
          {crossfitMoves.some((e) => !cfSectionsMeta.some((s) => s.id === e.conditioning_block_id)) ? (
            <div className="mt-2">
              {renderMovementSnapList(
                crossfitMoves
                  .filter((e) => !cfSectionsMeta.some((s) => s.id === e.conditioning_block_id))
                  .map((e) => ({
                    id: e.id,
                    name: e.name,
                    muscle_group: e.muscle_group,
                  })),
                'Sin bloque asignado',
              )}
            </div>
          ) : null}
        </>
      );
    }
    return renderMovementSnapList(cfDisplayMoves, 'Movimientos');
  };

  const blockShellCrossfit = cn(
    'mt-3 rounded-lg border border-primary/15 bg-muted/20 p-2.5 dark:bg-muted/25',
    "[html[data-brand='pink']_&]:border-[#ff007f]/22",
  );

  const renderManualExerciseLines = (lines: ManualExerciseLine[], listTitle: string) => {
    const filled = lines.filter((l) => l.name.trim());
    return (
      <div className="mt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{listTitle}</p>
        {filled.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin ejercicios registrados</p>
        ) : (
          <ul className="space-y-1">
            {filled.map((line) => (
              <li key={line.id} className="text-xs text-foreground">
                <span className="text-muted-foreground/60">·</span> {line.name.trim()}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const renderCrossfitTypedDetails = (d: CrossfitLogDraft) => {
    const subtypeLabel = CROSSFIT_SUBTYPE_LABELS.find((s) => s.id === d.subtype)?.label ?? d.subtype;
    const w = d.warmup_skill;
    const showWarmup = crossfitWarmupHasContent(w) && w != null;
    return (
      <div className="mt-2 space-y-1 animate-in fade-in duration-200">
        {showWarmup ? (
          <div
            className={cn(
              'rounded-lg border border-primary/15 bg-muted/20 p-2.5 dark:bg-muted/25',
              "[html[data-brand='pink']_&]:border-[#ff007f]/22",
            )}
          >
            <div className="flex items-center gap-1.5">
              <Flame
                className={cn(
                  'h-3.5 w-3.5 shrink-0 text-orange-500 dark:text-orange-400',
                  "[html[data-brand='pink']_&]:text-[#ff007f] dark:[html[data-brand='pink']_&]:text-fuchsia-400",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide text-foreground',
                  "[html[data-brand='pink']_&]:text-foreground dark:[html[data-brand='pink']_&]:text-fuchsia-200",
                )}
              >
                Calentamiento
              </span>
            </div>
            {renderManualExerciseLines(w.exercises, 'Ejercicios')}
            {w.note.trim() ? (
              <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-snug text-muted-foreground dark:border-border/40">
                <span className="font-medium text-foreground">Notas:</span> {w.note.trim()}
              </p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            'border-primary/35 bg-primary/10 text-primary',
            'dark:border-primary/40 dark:bg-primary/15',
            "[html[data-brand='pink']_&]:border-[#ff007f]/35",
            "dark:[html[data-brand='pink']_&]:border-fuchsia-500/35 dark:[html[data-brand='pink']_&]:text-fuchsia-100",
          )}
        >
          {subtypeLabel}
        </div>

        {d.subtype === 'amrap' ? (
          <>
            {d.global_amraps_total_time.trim() ? (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tiempo total AMRAPs:</span> {d.global_amraps_total_time.trim()}
              </p>
            ) : null}
            {d.blocks.map((b, i) => (
              <div key={b.id} className={blockShellCrossfit}>
                <p className="text-[11px] font-semibold text-foreground">
                  AMRAP {i + 1}
                  {b.duration.trim() ? (
                    <span className="font-normal text-muted-foreground"> · {b.duration.trim()}</span>
                  ) : null}
                </p>
                {renderManualExerciseLines(b.exercises, 'Ejercicios')}
                {b.rounds_completed.trim() ? (
                  <p className="mt-2 border-t border-primary/15 pt-2 text-xs dark:border-primary/20">
                    <span className="font-medium text-foreground">Rondas / vueltas:</span>{' '}
                    <span className="tabular-nums text-primary">{b.rounds_completed.trim()}</span>
                  </p>
                ) : null}
              </div>
            ))}
          </>
        ) : null}

        {d.subtype === 'emom' ? (
          <div className={blockShellCrossfit}>
            {d.total_emom_time.trim() ? (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Duración EMOM:</span> {d.total_emom_time.trim()}
              </p>
            ) : null}
            {renderManualExerciseLines(d.exercises, 'Ejercicios por minuto')}
          </div>
        ) : null}

        {d.subtype === 'for_time' ? (
          <div className={blockShellCrossfit}>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {d.rounds_to_complete.trim() ? (
                <p>
                  <span className="font-semibold text-foreground">Vueltas / rondas:</span> {d.rounds_to_complete.trim()}
                </p>
              ) : null}
              {d.time_cap.trim() ? (
                <p>
                  <span className="font-semibold text-foreground">Time cap:</span> {d.time_cap.trim()}
                </p>
              ) : null}
            </div>
            {renderManualExerciseLines(d.exercises, 'Ejercicios')}
            {d.final_time.trim() ? (
              <p className="mt-2 border-t border-primary/20 pt-2 text-sm font-semibold tabular-nums text-foreground dark:border-primary/25">
                Tiempo real de finalización:{' '}
                <span className="text-primary">{d.final_time.trim()}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {d.subtype === 'classic_benchmark_tabata' ? (
          <div className={blockShellCrossfit}>
            {d.target_time.trim() ? (
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Tiempo objetivo:</span> {d.target_time.trim()}
              </p>
            ) : null}
            {renderManualExerciseLines(d.exercises, 'Ejercicios')}
            {d.final_real_time.trim() ? (
              <p className="mt-2 border-t border-primary/20 pt-2 text-sm font-semibold tabular-nums text-foreground dark:border-primary/25">
                Tiempo real: <span className="text-primary">{d.final_real_time.trim()}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderFuncionalBlockHierarchy = () => {
    if (fnStructured && fnStructured.blocks.length > 0) {
      return (
        <>
          {fnStructured.blocks.map((b, i) => (
            <div
              key={b.id || `fnb-${i}`}
              className="mt-3 rounded-lg border border-emerald-500/20 bg-muted/20 p-2.5 dark:bg-muted/25"
            >
              <p className="text-[11px] font-semibold text-foreground">
                Bloque {i + 1}
                {b.target_time.trim() ? (
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    · Objetivo coach: {b.target_time}
                  </span>
                ) : null}
              </p>
              {renderMovementSnapList(b.movements, 'Ejercicios')}
            </div>
          ))}
          {fnStructured.unassigned.length > 0 ? (
            <div className="mt-2">{renderMovementSnapList(fnStructured.unassigned, 'Sin bloque asignado')}</div>
          ) : null}
        </>
      );
    }
    if (fnSectionsMeta.length > 0) {
      return (
        <>
          {fnSectionsMeta.map((sec, i) => {
            const moves = funcionalMoves.filter((e) => e.conditioning_block_id === sec.id);
            const items = moves.map((e) => ({
              id: e.id,
              name: e.name,
              muscle_group: e.muscle_group,
            }));
            return (
              <div
                key={sec.id}
                className="mt-3 rounded-lg border border-emerald-500/20 bg-muted/20 p-2.5 dark:bg-muted/25"
              >
                <p className="text-[11px] font-semibold text-foreground">
                  Bloque {i + 1}
                  {sec.target_time.trim() ? (
                    <span className="font-normal text-muted-foreground">
                      {' '}
                      · Objetivo coach: {sec.target_time}
                    </span>
                  ) : null}
                </p>
                {renderMovementSnapList(items, 'Ejercicios')}
              </div>
            );
          })}
          {funcionalMoves.some((e) => !fnSectionsMeta.some((s) => s.id === e.conditioning_block_id)) ? (
            <div className="mt-2">
              {renderMovementSnapList(
                funcionalMoves
                  .filter((e) => !fnSectionsMeta.some((s) => s.id === e.conditioning_block_id))
                  .map((e) => ({
                    id: e.id,
                    name: e.name,
                    muscle_group: e.muscle_group,
                  })),
                'Sin bloque asignado',
              )}
            </div>
          ) : null}
        </>
      );
    }
    return renderMovementSnapList(fnDisplayMoves, 'Ejercicios en el bloque');
  };

  const hasAnyWorkout = exercises.length > 0 || workoutLogs.length > 0;

  const headerDateLabel = (() => {
    const parts = dateStr.split('-').map((x) => Number.parseInt(x, 10));
    const [y, m, d] = parts;
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-border/50 bg-background p-5"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left text-xl text-foreground">
            Reporte del día · <span className="capitalize">{headerDateLabel}</span>
          </SheetTitle>
          <p className="mt-1 text-left text-xs font-medium tabular-nums text-muted-foreground">{dateStr}</p>
        </SheetHeader>

        {/* Resumen entrenamiento */}
        <div className="mb-4 rounded-2xl bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Entrenamiento</h4>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xl font-bold tabular-nums text-foreground">{exerciseCountDisplay}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                Resumen (bloques)
              </p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xl font-bold tabular-nums text-foreground">{totalStrengthSets}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                Series fuerza
              </p>
            </div>
          </div>
          {hasAnyWorkout ? (
            <div className="space-y-3">
              {strengthExercises.length > 0 && (
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    'border-border/60 bg-muted/25',
                    'dark:border-border dark:bg-muted/20',
                    "[html[data-brand='pink']_&]:border-[#ff007f]/25",
                  )}
                >
                  <ReportModalityHeader icon={Dumbbell} label="Musculación" variant="strength" />
                  <ul className="mt-3 space-y-2">{strengthExercises.map(renderStrengthExercise)}</ul>
                </div>
              )}

              {(crossfitLog || crossfitMoves.length > 0) && (
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    'border-primary/30 bg-primary/[0.07]',
                    'dark:border-primary/35 dark:bg-primary/10',
                    "[html[data-brand='pink']_&]:border-[#ff007f]/25",
                  )}
                >
                  <ReportModalityHeader icon={Zap} label="CrossFit" variant="crossfit" />
                  <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
                    {crossfitLog?.wod_title?.trim() || cfTypedReport?.wod_name?.trim() || 'WOD'}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {crossfitLog &&
                    crossfitLog.round_count != null &&
                    cfTypedReport &&
                    cfTypedReport.subtype !== 'amrap' &&
                    cfTypedReport.subtype !== 'for_time' ? (
                      <p>
                        <span className="font-medium text-foreground">Rondas:</span> {crossfitLog.round_count}
                      </p>
                    ) : null}
                  </div>
                  {crossfitLog && cfTypedReport ? (
                    <>
                      {renderCrossfitTypedDetails(cfTypedReport)}
                      {!crossfitDraftHasManualExercises(cfTypedReport) &&
                      (cfMoveSnaps.length > 0 ||
                        crossfitMoves.length > 0 ||
                        (cfStructured != null && cfStructured.blocks.length > 0) ||
                        cfSectionsMeta.length > 0) ? (
                        <div className="mt-3 border-t border-primary/20 pt-3 dark:border-primary/25">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Movimientos / programación
                          </p>
                          {renderCrossfitBlockHierarchy()}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    renderCrossfitBlockHierarchy()
                  )}
                  <div className="mt-3 border-t border-primary/25 pt-2.5 dark:border-primary/30">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      Resultado final · Tiempo real total:{' '}
                      <span className="text-primary">{crossfitLog?.total_time?.trim() || '—'}</span>
                    </p>
                  </div>
                  {crossfitLog ? renderSplitList(crossfitLog) : null}
                </div>
              )}

              {(funcionalLog || funcionalMoves.length > 0) && (
                <div
                  className={cn(
                    'rounded-xl border p-3',
                    'border-emerald-500/25 bg-emerald-500/[0.06]',
                    'dark:border-emerald-500/30 dark:bg-emerald-950/20',
                    "[html[data-brand='pink']_&]:border-[#ff007f]/25",
                  )}
                >
                  <ReportModalityHeader icon={Repeat2} label="Funcional" variant="funcional" />
                  <p className="mt-2 text-sm font-semibold leading-snug text-foreground">
                    {fnTypedReport?.session_name?.trim() ||
                      funcionalLog?.circuit_name?.trim() ||
                      'Sesión funcional'}
                  </p>
                  {(fnTypedReport?.total_session_time?.trim() || funcionalLog?.total_time?.trim()) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Tiempo total de la sesión:</span>{' '}
                      {fnTypedReport?.total_session_time?.trim() || funcionalLog?.total_time?.trim()}
                    </p>
                  ) : null}

                  {funcionalLog && fnTypedReport && fnTypedReport.phases.length > 0 ? (
                    <>
                      {renderFunctionalSessionReport(fnTypedReport)}
                      {!sessionHasManualExercises(fnTypedReport) &&
                      (fnMoveSnaps.length > 0 ||
                        funcionalMoves.length > 0 ||
                        (fnStructured != null && fnStructured.blocks.length > 0) ||
                        fnSectionsMeta.length > 0) ? (
                        <div className="mt-3 border-t border-emerald-500/25 pt-3 dark:border-emerald-500/35">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Movimientos / programación
                          </p>
                          {renderFuncionalBlockHierarchy()}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {funcionalLog?.round_count != null ? (
                          <p>
                            <span className="font-medium text-foreground">Tandas:</span> {funcionalLog.round_count}
                          </p>
                        ) : null}
                        {funcionalLog?.work_rest_note?.trim() ? (
                          <p>
                            <span className="font-medium text-foreground">Trabajo / descanso:</span>{' '}
                            {funcionalLog.work_rest_note}
                          </p>
                        ) : null}
                      </div>
                      {renderFuncionalBlockHierarchy()}
                    </>
                  )}
                  <div className="mt-3 border-t border-emerald-500/25 pt-2.5 dark:border-emerald-500/35">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      Resultado final · Tiempo real total:{' '}
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {funcionalLog?.total_time?.trim() || '—'}
                      </span>
                    </p>
                  </div>
                  {funcionalLog ? renderSplitList(funcionalLog) : null}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Sin ejercicios registrados</p>
          )}
        </div>

        {/* Nutrición */}
        <div className="mb-4 rounded-2xl bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Nutrición</h4>
          </div>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <CaloriesRing consumed={calories.total} goal={calories.goal} size={92} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Calorías</p>
              <p className="text-xs text-muted-foreground">Consumidas vs. meta diaria</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Proteínas</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {calories.protein}g
                {calories.proteinGoal ? <span className="text-xs font-normal text-muted-foreground"> / {calories.proteinGoal}g</span> : null}
              </p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Carbos</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{calories.carbs}g</p>
            </div>
            <div className="rounded-xl bg-accent p-3 sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Grasas</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{calories.fat}g</p>
            </div>
          </div>
          <div className="mt-6">
            <Collapsible open={foodsOpen} onOpenChange={setFoodsOpen}>
              <CollapsibleTrigger
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent',
                  "dark:[html[data-brand='pink']_&]:hover:bg-accent",
                )}
              >
                <span className="min-w-0 flex-1 leading-snug">
                  Ver comidas consumidas
                  {foods.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">({foods.length})</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${foodsOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3">
              {foods.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Sin comidas registradas</p>
              ) : (
                ([
                  { key: 'desayuno' as const, label: 'Desayuno', Icon: Sun },
                  { key: 'almuerzo' as const, label: 'Almuerzo', Icon: Sunset },
                  { key: 'merienda' as const, label: 'Merienda', Icon: Cookie },
                  { key: 'cena' as const, label: 'Cena', Icon: Moon },
                ] as const).map(({ key, label, Icon }) => {
                  const items = foods.filter((f) => f.mealKey === key);
                  if (items.length === 0) return null;
                  const sumCal = items.reduce((s, f) => s + f.calories, 0);
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3 w-3 text-primary" />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{sumCal} kcal</span>
                      </div>
                      <ul className="space-y-1">
                        {items.map(f => (
                          <li key={f.id} className="flex items-center justify-between rounded-lg bg-accent px-3 py-2">
                            <span className="truncate text-sm text-foreground">{f.name} <span className="text-xs text-muted-foreground">×{f.quantity}</span></span>
                            <span className="ml-2 shrink-0 text-xs text-muted-foreground">{f.calories} kcal · {Math.round(f.protein)}g</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </CollapsibleContent>
          </Collapsible>
          </div>
        </div>

        {/* Hidratación + Recovery */}
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Hidratación</h4>
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Vasos</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{glasses}</p>
            <p className="text-[10px] text-muted-foreground">{(glasses * 0.25).toFixed(2)} L</p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Descanso</h4>
            </div>
            <div className="space-y-5">
              <RecoveryReadOnlyRow label="Calidad de sueño" value={recovery.sleep} />
              <RecoveryReadOnlyRow label="Nivel de energía" value={recovery.energy} />
            </div>
          </div>
        </div>

        {/* Pasos */}
        <div className="mt-3 rounded-2xl bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Footprints className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Pasos</h4>
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-2xl font-bold tabular-nums text-foreground">{steps.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Meta: {stepGoal.toLocaleString()}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

function RecoveryReadOnlyRow({ label, value }: { label: string; value: number }) {
  const registered = value > 0;
  const score = registered ? Math.min(5, Math.max(1, Math.round(value))) : null;

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {!registered ? (
        <p className="text-sm italic text-muted-foreground">No registrado</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${label}: ${score} de 5`}>
          <div
            className="inline-flex min-h-[2.75rem] min-w-[2.75rem] select-none items-center justify-center rounded-full bg-primary px-5 py-2 text-2xl font-bold tabular-nums text-primary-foreground"
          >
            {score}
          </div>
          <span className="text-xl font-medium tabular-nums text-muted-foreground">/ 5</span>
        </div>
      )}
    </div>
  );
}

export default DailyReportSheet;
