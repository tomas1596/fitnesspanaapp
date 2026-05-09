import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dumbbell, Utensils, Droplet, TrendingUp, ChevronDown, Flame, Footprints, Sun, Sunset, Cookie, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import StarDisplay from '@/components/StarDisplay';

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
  const [foods, setFoods] = useState<{ id: string; name: string; calories: number; protein: number; carbs: number; fat: number; meal: string; quantity: number }[]>([]);
  const [foodsOpen, setFoodsOpen] = useState(false);
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(10000);

  useEffect(() => {
    if (!user || !open) return;

    supabase.from('profiles').select('weight, height, age, gender, step_goal').eq('user_id', user.id).single().then(({ data }) => {
      if (data?.step_goal) setStepGoal(data.step_goal);
      if (!data?.weight || !data?.height || !data?.age || !data?.gender) return;
      const w = Number(data.weight), h = Number(data.height), a = Number(data.age);
      const bmr = data.gender === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
      setCalories(prev => ({ ...prev, goal: Math.round(bmr * 1.55), proteinGoal: Math.round(w * 2) }));
    });

    supabase.from('food_entries').select('id, name, calories, protein, carbs, fat, meal, quantity').eq('user_id', user.id).eq('entry_date', dateStr).order('created_at').then(({ data }) => {
      const list = (data || []).map(f => ({
        id: f.id, name: f.name,
        calories: f.calories,
        protein: Number(f.protein),
        carbs: Number(f.carbs ?? 0),
        fat: Number(f.fat ?? 0),
        meal: (f.meal as string) || 'breakfast',
        quantity: Number(f.quantity ?? 1),
      }));
      const total = list.reduce((s, f) => s + f.calories, 0);
      const protein = list.reduce((s, f) => s + f.protein, 0);
      const carbs = list.reduce((s, f) => s + f.carbs, 0);
      const fat = list.reduce((s, f) => s + f.fat, 0);
      setCalories(prev => ({ ...prev, total, protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }));
      setFoods(list);
    });

    supabase.from('hydration_logs').select('glasses').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle().then(({ data }) => {
      setGlasses(data?.glasses || 0);
    });

    supabase.from('recovery_logs').select('sleep_quality, energy_level').eq('user_id', user.id).eq('log_date', dateStr).maybeSingle().then(({ data }) => {
      setRecovery({ sleep: Number(data?.sleep_quality) || 0, energy: Number(data?.energy_level) || 0 });
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
              <p className="text-lg font-bold text-foreground">{exercises.length}</p>
              <p className="text-[10px] text-muted-foreground">Ejercicios</p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-lg font-bold text-foreground">{totalSets}</p>
              <p className="text-[10px] text-muted-foreground">Series</p>
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
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs text-muted-foreground">Calorías</p>
              <p className="text-lg font-bold text-foreground">{calories.total}{calories.goal ? <span className="text-xs text-muted-foreground"> / {calories.goal}</span> : null}</p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs text-muted-foreground">Proteínas</p>
              <p className="text-lg font-bold text-foreground">{calories.protein}g{calories.proteinGoal ? <span className="text-xs text-muted-foreground"> / {calories.proteinGoal}g</span> : null}</p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs text-muted-foreground">Carbos</p>
              <p className="text-lg font-bold text-foreground">{calories.carbs}g</p>
            </div>
            <div className="rounded-xl bg-accent p-3">
              <p className="text-xs text-muted-foreground">Grasas</p>
              <p className="text-lg font-bold text-foreground">{calories.fat}g</p>
            </div>
          </div>
          <Collapsible open={foodsOpen} onOpenChange={setFoodsOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl bg-accent px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/80">
              <span>Ver comidas consumidas{foods.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({foods.length})</span>}</span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${foodsOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              {foods.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Sin comidas registradas</p>
              ) : (
                ([
                  { key: 'breakfast', label: 'Desayuno', Icon: Sun },
                  { key: 'lunch',     label: 'Almuerzo', Icon: Sunset },
                  { key: 'snack',     label: 'Merienda', Icon: Cookie },
                  { key: 'dinner',    label: 'Cena',     Icon: Moon },
                ] as const).map(({ key, label, Icon }) => {
                  const items = foods.filter(f => f.meal === key);
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

        {/* Hidratación + Recovery */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Hidratación</h4>
            </div>
            <p className="text-2xl font-bold text-foreground">{glasses}</p>
            <p className="text-[10px] text-muted-foreground">vasos · {(glasses * 0.25).toFixed(2)} L</p>
          </div>
          <div className="rounded-2xl bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Descanso</h4>
            </div>
            <div className="space-y-1">
              <div>
                <p className="text-[10px] text-muted-foreground">Sueño</p>
                <StarDisplay value={recovery.sleep} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Energía</p>
                <StarDisplay value={recovery.energy} />
              </div>
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
            <p className="text-2xl font-bold text-foreground">{steps.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Meta: {stepGoal.toLocaleString()}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DailyReportSheet;
