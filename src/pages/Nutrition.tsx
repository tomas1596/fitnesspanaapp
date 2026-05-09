import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, Droplets, Trash2, Sun, Sunset, Cookie, Moon, BookOpen, Search, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import HalfStarRating from '@/components/HalfStarRating';
import { calculateAge } from '@/lib/age';
import { todayLocalYMD, localDayBoundsISO } from '@/lib/nutritionDay';

type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

type CustomFood = {
  id: string;
  name: string;
  base_calories: number;
  base_protein: number;
  base_carbs: number;
  base_fat: number;
};

type NutritionLogRow = {
  id: string;
  food_name: string;
  meal_type: MealType;
  quantity_multiplier: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const MEALS: { key: MealType; label: string; icon: typeof Sun }[] = [
  { key: 'desayuno', label: 'Desayuno', icon: Sun },
  { key: 'almuerzo', label: 'Almuerzo', icon: Sunset },
  { key: 'snack', label: 'Snack', icon: Cookie },
  { key: 'cena', label: 'Cena', icon: Moon },
];

const roundMacro = (n: number) => Math.round(n * 100) / 100;

const mapRowToCustomFood = (r: {
  id: string;
  name: string;
  base_calories: number | string | null;
  base_protein: number | string | null;
  base_carbs: number | string | null;
  base_fat: number | string | null;
}): CustomFood => ({
  id: r.id,
  name: r.name,
  base_calories: Number(r.base_calories),
  base_protein: Number(r.base_protein),
  base_carbs: Number(r.base_carbs),
  base_fat: Number(r.base_fat),
});

const FoodMacroSummary = ({ f, className }: { f: CustomFood; className?: string }) => (
  <div className={className}>
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground/90">Calorías:</span>{' '}
      <span className="tabular-nums">{Math.round(f.base_calories)} kcal</span>
    </p>
    <p className="text-[11px] leading-relaxed text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground/90">Proteína:</span> {f.base_protein} g ·{' '}
      <span className="font-medium text-foreground/90">Carbohidratos:</span> {f.base_carbs} g ·{' '}
      <span className="font-medium text-foreground/90">Grasas:</span> {f.base_fat} g
    </p>
  </div>
);

const Nutrition = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [nutritionTab, setNutritionTab] = useState('diario');
  const [goals, setGoals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, hydrationGlasses: 8 });
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLogRow[]>([]);
  const [glasses, setGlasses] = useState(0);
  const [hydrationId, setHydrationId] = useState<string | null>(null);

  const [newFoodOpen, setNewFoodOpen] = useState(false);
  /** Origen del formulario: biblioteca vs. flujo + del diario (tras guardar abre calculadora con comida fijada). */
  const [newFoodContext, setNewFoodContext] = useState<'library' | 'meal-picker' | null>(null);
  const [quickCreateMeal, setQuickCreateMeal] = useState<MealType | null>(null);

  const [foodPickerSearch, setFoodPickerSearch] = useState('');

  const [newFoodForm, setNewFoodForm] = useState({
    name: '',
    base_calories: '',
    base_protein: '',
    base_carbs: '',
    base_fat: '',
  });
  const [savingFood, setSavingFood] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [deleteFoodTarget, setDeleteFoodTarget] = useState<CustomFood | null>(null);
  const [deletingFood, setDeletingFood] = useState(false);

  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorMealLocked, setCalculatorMealLocked] = useState(false);
  const [selectedFood, setSelectedFood] = useState<CustomFood | null>(null);
  const [portionQty, setPortionQty] = useState('1');
  const [logMealType, setLogMealType] = useState<MealType>('desayuno');
  const [savingLog, setSavingLog] = useState(false);

  const [sleepQuality, setSleepQuality] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('weight, height, date_of_birth, gender').eq('user_id', user.id).single().then(({ data }) => {
      const a = calculateAge(data?.date_of_birth);
      if (!data || !data.weight || !data.height || a == null || a <= 0 || !data.gender) return;
      const w = Number(data.weight);
      const h = Number(data.height);
      const bmr = data.gender === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
      const cals = Math.round(bmr * 1.55);
      const protein = Math.round(w * 2);
      const carbs = Math.round((cals * 0.45) / 4);
      const fat = Math.round((cals * 0.25) / 9);
      setGoals({
        calories: cals,
        protein,
        carbs,
        fat,
        hydrationGlasses: Math.max(8, Math.round((w * 35) / 250)),
      });
    });
  }, [user]);

  const fetchCustomFoods = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('custom_foods')
      .select('id, name, base_calories, base_protein, base_carbs, base_fat')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('[nutrition] custom_foods', error.message);
      return;
    }
    setCustomFoods(
      (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        base_calories: Number(r.base_calories),
        base_protein: Number(r.base_protein),
        base_carbs: Number(r.base_carbs),
        base_fat: Number(r.base_fat),
      })),
    );
  }, [user]);

  const fetchNutritionLogs = useCallback(async () => {
    if (!user) return;
    const day = todayLocalYMD();
    const { start, end } = localDayBoundsISO(day);
    const { data, error } = await supabase
      .from('nutrition_logs')
      .select('id, food_name, meal_type, quantity_multiplier, calories, protein, carbs, fat, consumed_at')
      .eq('user_id', user.id)
      .gte('consumed_at', start)
      .lte('consumed_at', end)
      .order('consumed_at', { ascending: true });
    if (error) {
      console.warn('[nutrition] nutrition_logs', error.message);
      return;
    }
    setNutritionLogs(
      (data || []).map((r) => ({
        id: r.id,
        food_name: r.food_name,
        meal_type: r.meal_type as MealType,
        quantity_multiplier: Number(r.quantity_multiplier),
        calories: Number(r.calories),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
      })),
    );
  }, [user]);

  const fetchHydration = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('hydration_logs').select('*').eq('user_id', user.id).eq('log_date', todayLocalYMD()).maybeSingle();
    if (data) { setGlasses(data.glasses); setHydrationId(data.id); }
  }, [user]);

  useEffect(() => {
    fetchCustomFoods();
    fetchNutritionLogs();
    fetchHydration();
  }, [fetchCustomFoods, fetchNutritionLogs, fetchHydration]);

  useEffect(() => {
    if (!user) return;
    supabase.from('recovery_logs').select('*').eq('user_id', user.id).eq('log_date', todayLocalYMD()).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSleepQuality(Number(data.sleep_quality));
          setEnergyLevel(Number(data.energy_level));
          setRecoveryId(data.id);
        }
      });
  }, [user]);

  const totals = useMemo(
    () =>
      nutritionLogs.reduce(
        (acc, f) => ({
          calories: acc.calories + f.calories,
          protein: acc.protein + f.protein,
          carbs: acc.carbs + f.carbs,
          fat: acc.fat + f.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [nutritionLogs],
  );

  const calsLeft = goals.calories ? goals.calories - totals.calories : 0;

  const filteredPickerFoods = useMemo(() => {
    const q = foodPickerSearch.trim().toLowerCase();
    if (!q) return customFoods;
    return customFoods.filter((f) => f.name.toLowerCase().includes(q));
  }, [customFoods, foodPickerSearch]);

  const scaledFromSelected = useMemo(() => {
    if (!selectedFood) return null;
    const m = Math.max(0.01, Number(portionQty) || 0);
    return {
      calories: roundMacro(selectedFood.base_calories * m),
      protein: roundMacro(selectedFood.base_protein * m),
      carbs: roundMacro(selectedFood.base_carbs * m),
      fat: roundMacro(selectedFood.base_fat * m),
      multiplier: m,
    };
  }, [selectedFood, portionQty]);

  const updateRecovery = async (field: 'sleep_quality' | 'energy_level', val: number) => {
    if (!user) return;
    if (field === 'sleep_quality') setSleepQuality(val); else setEnergyLevel(val);
    if (recoveryId) {
      await supabase.from('recovery_logs').update({ [field]: val } as never).eq('id', recoveryId);
    } else {
      const { data } = await supabase.from('recovery_logs').insert({
        user_id: user.id, log_date: todayLocalYMD(),
        sleep_quality: field === 'sleep_quality' ? val : sleepQuality,
        energy_level: field === 'energy_level' ? val : energyLevel,
      }).select().single();
      if (data) setRecoveryId(data.id);
    }
  };

  const emptyFoodForm = () => ({
    name: '',
    base_calories: '',
    base_protein: '',
    base_carbs: '',
    base_fat: '',
  });

  const openNewFoodFromLibrary = () => {
    setEditingFoodId(null);
    setNewFoodForm(emptyFoodForm());
    setNewFoodContext('library');
    setQuickCreateMeal(null);
    setNewFoodOpen(true);
  };

  const openEditFood = (f: CustomFood) => {
    setEditingFoodId(f.id);
    setNewFoodContext(null);
    setQuickCreateMeal(null);
    setNewFoodForm({
      name: f.name,
      base_calories: String(f.base_calories),
      base_protein: String(f.base_protein),
      base_carbs: String(f.base_carbs),
      base_fat: String(f.base_fat),
    });
    setNewFoodOpen(true);
  };

  const openNewFoodFromMealPicker = () => {
    const meal = pickerMealType;
    if (!meal) return;
    setEditingFoodId(null);
    setNewFoodForm(emptyFoodForm());
    setQuickCreateMeal(meal);
    setNewFoodContext('meal-picker');
    setNewFoodOpen(true);
  };

  const saveNewFood = async () => {
    if (!user) return;
    const name = newFoodForm.name.trim();
    if (!name) {
      toast({ title: 'Falta el nombre', variant: 'destructive' });
      return;
    }
    const bc = Math.max(0, Number(newFoodForm.base_calories) || 0);
    const bp = Math.max(0, Number(newFoodForm.base_protein) || 0);
    const bcar = Math.max(0, Number(newFoodForm.base_carbs) || 0);
    const bf = Math.max(0, Number(newFoodForm.base_fat) || 0);

    const editId = editingFoodId;
    if (editId) {
      setSavingFood(true);
      const { data, error } = await supabase
        .from('custom_foods')
        .update({
          name,
          base_calories: bc,
          base_protein: bp,
          base_carbs: bcar,
          base_fat: bf,
        })
        .eq('id', editId)
        .select('id, name, base_calories, base_protein, base_carbs, base_fat')
        .single();
      setSavingFood(false);
      if (error) {
        toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        return;
      }
      if (!data) {
        toast({ title: 'No se pudo actualizar', variant: 'destructive' });
        return;
      }
      const updated = mapRowToCustomFood(data);
      setCustomFoods((prev) => prev.map((x) => (x.id === editId ? updated : x)));
      if (selectedFood?.id === editId) setSelectedFood(updated);
      setNewFoodOpen(false);
      setNewFoodForm(emptyFoodForm());
      setEditingFoodId(null);
      setNewFoodContext(null);
      setQuickCreateMeal(null);
      toast({ title: 'Cambios guardados', description: 'La biblioteca se actualizó.' });
      return;
    }

    const ctx = newFoodContext;
    const mealAfterPicker = quickCreateMeal;
    setSavingFood(true);
    const { data, error } = await supabase
      .from('custom_foods')
      .insert({
        user_id: user.id,
        name,
        base_calories: bc,
        base_protein: bp,
        base_carbs: bcar,
        base_fat: bf,
      })
      .select('id, name, base_calories, base_protein, base_carbs, base_fat')
      .single();
    setSavingFood(false);
    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return;
    }
    setNewFoodOpen(false);
    setNewFoodForm(emptyFoodForm());
    setNewFoodContext(null);
    setQuickCreateMeal(null);

    if (ctx === 'meal-picker' && mealAfterPicker && data) {
      const food = mapRowToCustomFood(data);
      setCustomFoods((prev) => [food, ...prev.filter((x) => x.id !== food.id)]);
      setMealPickerOpen(false);
      setPickerMealType(null);
      setFoodPickerSearch('');
      setSelectedFood(food);
      setPortionQty('1');
      setLogMealType(mealAfterPicker);
      setCalculatorMealLocked(true);
      setCalculatorOpen(true);
      toast({ title: 'Alimento creado', description: 'Ajustá la porción y agregalo al diario.' });
      return;
    }

    fetchCustomFoods();
    toast({ title: 'Alimento guardado', description: 'Ya está en tu biblioteca.' });
  };

  const confirmDeleteFood = async () => {
    if (!user || !deleteFoodTarget) return;
    const id = deleteFoodTarget.id;
    setDeletingFood(true);
    const { error } = await supabase.from('custom_foods').delete().eq('id', id);
    setDeletingFood(false);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    setCustomFoods((prev) => prev.filter((x) => x.id !== id));
    if (selectedFood?.id === id) closeCalculator();
    setDeleteFoodTarget(null);
    toast({ title: 'Alimento eliminado', description: 'Se quitó de tu biblioteca.' });
  };

  const openMealFoodPicker = (meal: MealType) => {
    setPickerMealType(meal);
    setMealPickerOpen(true);
  };

  const selectFoodFromPicker = (food: CustomFood) => {
    const meal = pickerMealType;
    if (!meal) return;
    setMealPickerOpen(false);
    setSelectedFood(food);
    setPortionQty('1');
    setLogMealType(meal);
    setCalculatorMealLocked(true);
    setCalculatorOpen(true);
  };

  const openCalculatorFromLibrary = (food: CustomFood) => {
    setSelectedFood(food);
    setPortionQty('1');
    setLogMealType('desayuno');
    setCalculatorMealLocked(false);
    setCalculatorOpen(true);
  };

  const closeCalculator = () => {
    setCalculatorOpen(false);
    setSelectedFood(null);
    setCalculatorMealLocked(false);
  };

  const addLogFromLibrary = async () => {
    if (!user || !selectedFood || !scaledFromSelected) return;
    setSavingLog(true);
    const { error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id,
      food_name: selectedFood.name,
      calories: scaledFromSelected.calories,
      protein: scaledFromSelected.protein,
      carbs: scaledFromSelected.carbs,
      fat: scaledFromSelected.fat,
      meal_type: logMealType,
      quantity_multiplier: scaledFromSelected.multiplier,
      consumed_at: new Date().toISOString(),
    });
    setSavingLog(false);
    if (error) {
      toast({ title: 'Error al registrar', description: error.message, variant: 'destructive' });
      return;
    }
    closeCalculator();
    fetchNutritionLogs();
    setNutritionTab('diario');
    toast({ title: 'Agregado al diario', description: selectedFood.name });
  };

  const deleteLog = async (id: string) => {
    await supabase.from('nutrition_logs').delete().eq('id', id);
    fetchNutritionLogs();
  };

  const updateGlasses = async (val: number) => {
    if (!user) return;
    const next = Math.max(0, val);
    setGlasses(next);
    if (hydrationId) {
      await supabase.from('hydration_logs').update({ glasses: next }).eq('id', hydrationId);
    } else {
      const { data } = await supabase.from('hydration_logs').insert({ user_id: user.id, log_date: todayLocalYMD(), glasses: next }).select().single();
      if (data) setHydrationId(data.id);
    }
  };

  const glassesLiters = (glasses * 0.25).toFixed(2);

  const ringPct = goals.calories ? Math.min(100, (totals.calories / goals.calories) * 100) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - ringPct / 100);

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-3 text-2xl font-bold text-foreground">Nutrición</h1>

        <Tabs value={nutritionTab} onValueChange={setNutritionTab} className="w-full">
          <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-xl bg-secondary p-1">
            <TabsTrigger value="diario" className="rounded-lg text-sm font-semibold data-[state=active]:bg-card">
              Diario
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-1.5 rounded-lg text-sm font-semibold data-[state=active]:bg-card">
              <BookOpen className="h-3.5 w-3.5" />
              Mis alimentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="mt-0 space-y-4">
            <div className="rounded-2xl bg-card p-5">
              <div className="flex items-center gap-5">
                <div className="relative h-32 w-32 shrink-0">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r={R} fill="none"
                      stroke="hsl(var(--primary))" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={C} strokeDashoffset={dashOffset}
                      style={{ transition: 'stroke-dashoffset 400ms ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-extrabold tabular-nums text-foreground">{goals.calories ? Math.max(0, Math.round(calsLeft)) : Math.round(totals.calories)}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{goals.calories ? 'kcal restantes' : 'kcal'}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  <MacroBar label="Proteínas" value={totals.protein} goal={goals.protein} unit="g" color="hsl(var(--primary))" />
                  <MacroBar label="Carbos" value={totals.carbs} goal={goals.carbs} unit="g" color="#FF8A00" />
                  <MacroBar label="Grasas" value={totals.fat} goal={goals.fat} unit="g" color="#FFC700" />
                </div>
              </div>
              {!goals.calories && (
                <p className="mt-3 text-center text-xs text-muted-foreground/70">Completa tu perfil para ver tus metas.</p>
              )}
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                Tocá <span className="font-medium text-foreground">+</span> en una comida para elegir de tu biblioteca. Gestioná alimentos en <span className="font-medium text-foreground">Mis alimentos</span>.
              </p>
            </div>

            <div className="space-y-3">
              {MEALS.map((m) => {
                const items = nutritionLogs.filter((f) => f.meal_type === m.key);
                const sumCal = items.reduce((s, f) => s + f.calories, 0);
                const sumProt = items.reduce((s, f) => s + f.protein, 0);
                const Icon = m.icon;
                return (
                  <div key={m.key} className="rounded-2xl bg-card p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{m.label}</h3>
                          <p className="text-[11px] text-muted-foreground">
                            {Math.round(sumCal)} kcal · {Math.round(sumProt)}g prot
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => openMealFoodPicker(m.key)}
                        className="h-9 w-9 shrink-0 rounded-xl"
                        aria-label={`Añadir a ${m.label}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {items.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {items.map((f) => (
                          <li key={f.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-foreground">
                                {f.food_name}{' '}
                                <span className="text-xs text-muted-foreground">×{f.quantity_multiplier}</span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {Math.round(f.calories)} kcal · P{Math.round(f.protein)} C{Math.round(f.carbs)} G{Math.round(f.fat)}
                              </p>
                            </div>
                            <button type="button" onClick={() => deleteLog(f.id)} className="ml-2 shrink-0 text-muted-foreground/60 hover:text-destructive" aria-label="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Hidratación</h2>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{glassesLiters}<span className="ml-1 text-sm font-normal text-muted-foreground">L</span></p>
                  <p className="text-[11px] text-muted-foreground">{glasses} vasos · Meta: {goals.hydrationGlasses}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" onClick={() => updateGlasses(glasses - 1)} className="h-10 w-10 rounded-xl">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-6 text-center font-bold tabular-nums">{glasses}</span>
                  <Button variant="secondary" size="icon" onClick={() => updateGlasses(glasses + 1)} className="h-10 w-10 rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                {Array.from({ length: goals.hydrationGlasses }).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < glasses ? 'bg-primary' : 'bg-secondary'}`} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bienestar de hoy</h2>
              <div className="space-y-3">
                <HalfStarRating label="Calidad de Sueño" value={sleepQuality} onChange={(v) => updateRecovery('sleep_quality', v)} />
                <HalfStarRating label="Nivel de Energía" value={energyLevel} onChange={(v) => updateRecovery('energy_level', v)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="biblioteca" className="mt-0 space-y-4">
            <Button onClick={openNewFoodFromLibrary} className="h-11 w-full rounded-xl text-base font-semibold">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo alimento
            </Button>

            {customFoods.length === 0 ? (
              <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
                Todavía no tenés alimentos. Creá el primero para armar tu biblioteca personal.
              </p>
            ) : (
              <ul className="space-y-2">
                {customFoods.map((f) => (
                  <li key={f.id} className="flex gap-1 rounded-2xl bg-card p-2 pr-1">
                    <button
                      type="button"
                      onClick={() => openCalculatorFromLibrary(f)}
                      className="flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary/60"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-foreground">{f.name}</p>
                        <FoodMacroSummary f={f} className="mt-0.5" />
                      </div>
                      <span className="shrink-0 self-center text-xs font-medium text-primary">Registrar</span>
                    </button>
                    <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-border/40 pl-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditFood(f);
                        }}
                        aria-label={`Editar ${f.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteFoodTarget(f);
                        }}
                        aria-label={`Eliminar ${f.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={newFoodOpen}
        onOpenChange={(open) => {
          setNewFoodOpen(open);
          if (!open) {
            setNewFoodContext(null);
            setQuickCreateMeal(null);
            setEditingFoodId(null);
            setNewFoodForm(emptyFoodForm());
          }
        }}
      >
        <DialogContent className="rounded-2xl border-0 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingFoodId ? 'Editar alimento' : 'Nuevo alimento (por porción)'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Valores para 1 unidad o porción estándar (ej. 100 g).</p>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Nombre"
              value={newFoodForm.name}
              onChange={(e) => setNewFoodForm((p) => ({ ...p, name: e.target.value }))}
              className="h-11 rounded-xl border-0 bg-secondary"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Calorías (kcal)"
                value={newFoodForm.base_calories}
                onChange={(e) => setNewFoodForm((p) => ({ ...p, base_calories: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Proteínas (g)"
                value={newFoodForm.base_protein}
                onChange={(e) => setNewFoodForm((p) => ({ ...p, base_protein: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Carbohidratos (g)"
                value={newFoodForm.base_carbs}
                onChange={(e) => setNewFoodForm((p) => ({ ...p, base_carbs: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Grasas (g)"
                value={newFoodForm.base_fat}
                onChange={(e) => setNewFoodForm((p) => ({ ...p, base_fat: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
            </div>
            <Button onClick={saveNewFood} disabled={savingFood} className="h-11 w-full rounded-xl text-base font-semibold">
              {savingFood
                ? 'Guardando…'
                : editingFoodId
                  ? 'Guardar cambios'
                  : newFoodContext === 'meal-picker'
                    ? 'Guardar y continuar'
                    : 'Guardar en biblioteca'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet
        open={mealPickerOpen}
        onOpenChange={(open) => {
          setMealPickerOpen(open);
          if (!open) {
            setPickerMealType(null);
            setFoodPickerSearch('');
          }
        }}
      >
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-0 bg-card px-4 pb-8 pt-2">
          <SheetHeader className="mb-3 text-left">
            <SheetTitle className="text-foreground">
              {pickerMealType ? `Elegir alimento · ${MEALS.find((x) => x.key === pickerMealType)?.label ?? ''}` : 'Elegir alimento'}
            </SheetTitle>
          </SheetHeader>

          <Button
            type="button"
            onClick={openNewFoodFromMealPicker}
            className="mb-3 h-12 w-full rounded-xl text-base font-semibold shadow-sm"
          >
            <Plus className="mr-2 h-5 w-5" />
            Crear nuevo alimento
          </Button>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Buscar por nombre…"
              value={foodPickerSearch}
              onChange={(e) => setFoodPickerSearch(e.target.value)}
              className="h-11 rounded-xl border-0 bg-secondary pl-10"
              aria-label="Buscar alimento"
            />
          </div>

          {customFoods.length === 0 ? (
            <div className="space-y-3 py-2 text-center">
              <p className="text-sm text-muted-foreground">No tenés alimentos todavía. Creá uno con el botón de arriba o desde Mis alimentos.</p>
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                onClick={() => {
                  setMealPickerOpen(false);
                  setPickerMealType(null);
                  setFoodPickerSearch('');
                  setNutritionTab('biblioteca');
                }}
              >
                Ir a Mis alimentos
              </Button>
            </div>
          ) : filteredPickerFoods.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay alimentos que coincidan con «{foodPickerSearch.trim()}».</p>
          ) : (
            <ul className="space-y-2 pb-2">
              {filteredPickerFoods.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => selectFoodFromPicker(f)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary/70 p-4 text-left transition-colors hover:bg-secondary"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{f.name}</p>
                      <FoodMacroSummary f={f} className="mt-1.5" />
                    </div>
                    <span className="shrink-0 self-center text-xs font-medium text-primary">Elegir</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteFoodTarget} onOpenChange={(open) => { if (!open) setDeleteFoodTarget(null); }}>
        <AlertDialogContent className="rounded-2xl border-0 bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar este alimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFoodTarget
                ? `Se va a quitar «${deleteFoodTarget.name}» de tu biblioteca. Los registros del diario que ya hayas guardado no se modifican.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel className="mt-0 rounded-xl" disabled={deletingFood}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deletingFood}
              onClick={() => void confirmDeleteFood()}
            >
              {deletingFood ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={calculatorOpen} onOpenChange={(o) => { if (!o) closeCalculator(); }}>
        <DialogContent className="rounded-2xl border-0 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedFood?.name ?? 'Registrar'}</DialogTitle>
          </DialogHeader>
          {selectedFood && scaledFromSelected && (
            <div className="space-y-4">
              <div className="rounded-xl bg-secondary/70 p-3 text-sm">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Por porción base</p>
                <p className="mt-1 tabular-nums text-foreground">
                  {Math.round(selectedFood.base_calories)} kcal · P{selectedFood.base_protein}g C{selectedFood.base_carbs}g G{selectedFood.base_fat}g
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Cantidad / porción</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.1}
                  value={portionQty}
                  onChange={(e) => setPortionQty(e.target.value)}
                  className="h-11 rounded-xl border-0 bg-secondary"
                />
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Total con cantidad ×{scaledFromSelected.multiplier}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{scaledFromSelected.calories} kcal</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  P{scaledFromSelected.protein}g · C{scaledFromSelected.carbs}g · G{scaledFromSelected.fat}g
                </p>
              </div>

              {calculatorMealLocked ? (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Momento del día</p>
                  <div
                    className="flex h-11 items-center rounded-xl border border-transparent bg-muted/80 px-3 text-sm font-medium text-foreground"
                    aria-readonly
                  >
                    {MEALS.find((x) => x.key === logMealType)?.label}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Momento del día</label>
                  <Select value={logMealType} onValueChange={(v) => setLogMealType(v as MealType)}>
                    <SelectTrigger className="h-11 rounded-xl border-0 bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEALS.map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={addLogFromLibrary} disabled={savingLog} className="h-11 w-full rounded-xl text-base font-semibold">
                {savingLog ? 'Guardando…' : 'Agregar al diario'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const MacroBar = ({ label, value, goal, unit, color }: { label: string; value: number; goal: number; unit: string; color: string }) => {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">
          {Math.round(value)}{unit}{goal > 0 && <span className="text-muted-foreground"> / {goal}{unit}</span>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

export default Nutrition;
