import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dumbbell, Utensils, Droplet, TrendingUp, ChevronDown, Flame, Footprints, Sun, Sunset, Cookie, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CaloriesRing from '@/components/CaloriesRing';
import { calculateAge } from '@/lib/age';
import { localDayBoundsISO } from '@/lib/nutritionDay';

type MealGroupKey = 'desayuno' | 'almuerzo' | 'cena' | 'merienda';

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
  to_failure?: boolean;
}
interface ExerciseWithSets {
  id: string;
  name: string;
  muscle_group: string;
  sets: ExerciseSet[];
}

interface DailyReportSheetProps {
  open: boolean;
  onClose: () => void;
  dateStr: string;
  exercises: ExerciseWithSets[];
}

const DailyReportSheet = ({ open, onClose, dateStr, exercises }: DailyReportSheetProps) => {
  const { user } = useAuth();
  const [calories, setCalories] = useState({ total: 0, goal: 0, protein: 0, proteinGoal: 0, carbs: 0, fat: 0 });
  const [glasses, setGlasses] = useState(0);
  const [recovery, setRecovery] = useState({ sleep: 0, energy: 0 });
  const [foods, setFoods] = useState<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number; mealKey: MealGroupKey; quantity: number }[]>([]);
  const [foodsOpen, setFoodsOpen] = useState(false);
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(10000);

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

  const totalSets = exercises.reduce((s, ex) => s + ex.sets.length, 0);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-none bg-background p-5">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left text-xl text-foreground">Reporte del Día</SheetTitle>
        </SheetHeader>

        {/* Resumen entrenamiento */}
        <div className="mb-4 rounded-2xl bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Entrenamiento</h4>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xl font-bold tabular-nums text-foreground">{exercises.length}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ejercicios</p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xl font-bold tabular-nums text-foreground">{totalSets}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Series</p>
            </div>
          </div>
          {exercises.length > 0 ? (
            <ul className="space-y-2">
              {exercises.map((ex) => (
                <li key={ex.id} className="rounded-lg bg-accent px-3 py-2">
                  <p className="mb-1 text-sm font-medium text-foreground">{ex.name}</p>
                  {ex.sets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin series</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {ex.sets.map((s, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="text-muted-foreground/60">·</span>
                          <span>{s.reps} reps a {s.weight}kg</span>
                          {s.to_failure && <Flame className="h-3 w-3 fill-destructive text-destructive" />}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
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
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Calorías</p>
              <p className="text-xs text-muted-foreground">Consumidas vs. meta diaria</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Proteínas</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {calories.protein}g
                {calories.proteinGoal ? <span className="text-xs font-normal text-muted-foreground"> / {calories.proteinGoal}g</span> : null}
              </p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Carbos</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{calories.carbs}g</p>
            </div>
            <div className="rounded-xl bg-accent p-3 sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Grasas</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{calories.fat}g</p>
            </div>
          </div>
          <div className="mt-6">
            <Collapsible open={foodsOpen} onOpenChange={setFoodsOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-xl bg-zinc-100 px-4 py-3.5 text-left text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/90 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <span className="min-w-0 flex-1 leading-snug">
                  Ver comidas consumidas
                  {foods.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-zinc-500 dark:text-zinc-400">({foods.length})</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${foodsOpen ? 'rotate-180' : ''}`}
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
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Vasos</p>
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
            <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Meta: {stepGoal.toLocaleString()}</p>
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
      <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
      {!registered ? (
        <p className="text-sm italic text-zinc-500 dark:text-zinc-400">No registrado</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${label}: ${score} de 5`}>
          <div
            className="inline-flex min-h-[2.75rem] min-w-[2.75rem] select-none items-center justify-center rounded-full bg-primary px-5 py-2 text-2xl font-bold tabular-nums text-primary-foreground"
          >
            {score}
          </div>
          <span className="text-xl font-medium tabular-nums text-zinc-500 dark:text-zinc-400">/ 5</span>
        </div>
      )}
    </div>
  );
}

export default DailyReportSheet;
