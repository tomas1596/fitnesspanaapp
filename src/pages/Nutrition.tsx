import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, Droplets, Trash2, Sun, Sunset, Cookie, Moon, BookOpen, Search, Pencil, Apple, Barcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { NutritionBarcodeScanner, NutritionBarcodeScanLoadingOverlay } from '@/components/NutritionBarcodeScanner';
import { fetchOpenFoodFactsProduct, mapOpenFoodFactsToNutritionFields, type MacrosPer100g, type OpenFoodFactsPackageTotal } from '@/lib/openFoodFacts';
import { calculateAge } from '@/lib/age';
import { todayLocalYMD, localDayBoundsISO } from '@/lib/nutritionDay';

type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'merienda';

/** Columna obligatoria en DB; no se expone en el formulario (valor fijo). */
const DEFAULT_PORTION_UNIT = 'g' as const;

const INITIAL_MACROS_PER_100G: MacrosPer100g = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

/** `custom_foods.base_*`: macros por **100 g/ml** para escalar después al diario. */
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
  { key: 'merienda', label: 'Merienda', icon: Cookie },
  { key: 'cena', label: 'Cena', icon: Moon },
];

const NUTRITION_FORM_INPUT_CLASS =
  'min-h-[48px] rounded-xl border-0 bg-zinc-100 px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-zinc-800';

const roundMacro = (n: number) => Math.round(n * 100) / 100;

/** Valores derivados mostrados en inputs (evita colas de decimales al multiplicar por cantidad). */
const formatMacroDisplayKcal = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '');
const formatMacroDisplayGrams = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '');
const formatConsumedQtyDisplay = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '');

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

function formatConsumedQuantityFromMultiplier(multiplier: number): string {
  const amount = multiplier * 100;
  if (!Number.isFinite(amount)) return '';
  const r = Math.abs(amount % 1) < 0.001 ? String(Math.round(amount)) : amount.toFixed(1);
  return `${r} g o ml`;
}

function formatPackageReferenceLabel(pkg: OpenFoodFactsPackageTotal): string {
  const u = pkg.unit === 'ml' ? 'ml' : 'g';
  const r = Math.abs(pkg.amount % 1) < 0.001 ? String(Math.round(pkg.amount)) : pkg.amount.toFixed(1);
  return `${r}${u}`;
}

const FoodMacroSummary = ({ f, className }: { f: CustomFood; className?: string }) => (
  <div className={className}>
    <p className="text-[11px] leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground/90">Calorías (ref. /100 g o ml):</span>{' '}
      <span className="tabular-nums">{Math.round(f.base_calories)} kcal</span>
    </p>
    <p className="text-[11px] leading-relaxed text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground/90">P</span> {f.base_protein} g ·{' '}
      <span className="font-medium text-foreground/90">Carb.</span> {f.base_carbs} g ·{' '}
      <span className="font-medium text-foreground/90">Grasa</span> {f.base_fat} g
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

  const [newFoodForm, setNewFoodForm] = useState({ name: '' });
  const [newFoodMacrosRef100g, setNewFoodMacrosRef100g] =
    useState<MacrosPer100g>(INITIAL_MACROS_PER_100G);
  const [consumedAmountInput, setConsumedAmountInput] = useState('100');
  const [consumedUnit, setConsumedUnit] = useState<'g' | 'ml'>('g');
  const [offPackageTotal, setOffPackageTotal] = useState<OpenFoodFactsPackageTotal | null>(null);
  const [savingFood, setSavingFood] = useState(false);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [deleteFoodTarget, setDeleteFoodTarget] = useState<CustomFood | null>(null);
  const [deletingFood, setDeletingFood] = useState(false);

  /** Escáner OFF / lectura QR / espera Open Food Facts dentro del modal de alimento. */
  const [foodScanPhase, setFoodScanPhase] = useState<'off' | 'scanning' | 'fetching'>('off');

  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [pickerMealType, setPickerMealType] = useState<MealType | null>(null);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorMealLocked, setCalculatorMealLocked] = useState(false);
  const [selectedFood, setSelectedFood] = useState<CustomFood | null>(null);
  const [portionQty, setPortionQty] = useState('100');
  const [portionUnit, setPortionUnit] = useState<'g' | 'ml'>('g');
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
    setCustomFoods((data || []).map((r) => mapRowToCustomFood(r)));
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

  const consumedAmountEffective = useMemo(() => {
    const raw = consumedAmountInput.replace(',', '.').trim();
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
    return 100;
  }, [consumedAmountInput]);

  const consumedScaleFactor = consumedAmountEffective / 100;

  const patchMacroDisplayToRef100 = (key: keyof MacrosPer100g, displayRaw: string) => {
    const displayVal = parseFloat(String(displayRaw).replace(',', '.')) || 0;
    const qty = Math.max(0.0001, consumedAmountEffective);
    setNewFoodMacrosRef100g((prev) => ({
      ...prev,
      [key]: roundMacro(displayVal * (100 / qty)),
    }));
  };

  const scaledFromSelected = useMemo(() => {
    if (!selectedFood) return null;
    const raw = portionQty.replace(',', '.').trim();
    const amt = parseFloat(raw);
    const gramsOrMlEq = Number.isFinite(amt) && amt > 0 ? amt : 100;
    const m = gramsOrMlEq / 100;
    return {
      calories: roundMacro(selectedFood.base_calories * m),
      protein: roundMacro(selectedFood.base_protein * m),
      carbs: roundMacro(selectedFood.base_carbs * m),
      fat: roundMacro(selectedFood.base_fat * m),
      multiplier: m,
      /** Gramos/ml consumidos relativos al factor de escala (/100 referencia). */
      consumedQty: gramsOrMlEq,
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

  const emptyFoodForm = () => ({ name: '' });

  const resetNewFoodNutritionDraft = useCallback(() => {
    setNewFoodForm(emptyFoodForm());
    setNewFoodMacrosRef100g(INITIAL_MACROS_PER_100G);
    setConsumedAmountInput('100');
    setConsumedUnit('g');
    setOffPackageTotal(null);
  }, []);

  const loadFullPackIntoConsumedAmount = useCallback(() => {
    if (!offPackageTotal) return;
    setConsumedAmountInput(formatConsumedQtyDisplay(offPackageTotal.amount));
    setConsumedUnit(offPackageTotal.unit);
  }, [offPackageTotal]);

  const handleOpenFoodFactsBarcode = useCallback(
    async (raw: string) => {
      const digits = raw.replace(/\D/g, '');
      if (!digits || digits.length < 8) {
        toast({
          title: 'Código inválido',
          description: 'No se reconoció un código de barras numérico. Probá de nuevo.',
          variant: 'destructive',
        });
        setFoodScanPhase('off');
        return;
      }

      console.log('Código detectado:', raw.trim());

      setFoodScanPhase('fetching');
      try {
        const data = await fetchOpenFoodFactsProduct(digits);

        if (data.status === 0) {
          toast({
            title: 'Sin resultado',
            description: 'Producto no encontrado en la base de datos. Ingresalo manualmente.',
            variant: 'destructive',
          });
          return;
        }

        const mapped = mapOpenFoodFactsToNutritionFields(data);
        if (!mapped) {
          toast({
            title: 'Sin resultado',
            description: 'Producto no encontrado en la base de datos. Ingresalo manualmente.',
            variant: 'destructive',
          });
          return;
        }

        setNewFoodForm((prev) => ({
          ...prev,
          name: mapped.name || prev.name,
        }));
        setNewFoodMacrosRef100g(mapped.macrosPer100g);
        setConsumedAmountInput('100');
        setConsumedUnit(mapped.packageTotal?.unit === 'ml' ? 'ml' : 'g');
        setOffPackageTotal(mapped.packageTotal);
        toast({
          title: 'Producto cargado',
          description: mapped.name
            ? `«${mapped.name}»: valores de referencia por 100 ${mapped.packageTotal?.unit === 'ml' ? 'ml' : 'g'}. Ajustá la cantidad consumida si querés.`
            : 'Macros por 100 cargados desde Open Food Facts.',
        });
      } catch {
        toast({
          title: 'No se pudo buscar',
          description: 'Revisá la conexión o ingresá los datos manualmente.',
          variant: 'destructive',
        });
      } finally {
        setFoodScanPhase('off');
      }
    },
    [toast],
  );

  const handleBarcodeScannerPermissionError = useCallback(
    (message: string) => {
      toast({
        title: 'Cámara',
        description: message,
        variant: 'destructive',
      });
      setFoodScanPhase('off');
    },
    [toast],
  );

  const openNewFoodFromLibrary = () => {
    setFoodScanPhase('off');
    setEditingFoodId(null);
    resetNewFoodNutritionDraft();
    setNewFoodContext('library');
    setQuickCreateMeal(null);
    setNewFoodOpen(true);
  };

  const openEditFood = (f: CustomFood) => {
    setFoodScanPhase('off');
    setEditingFoodId(f.id);
    setNewFoodContext(null);
    setQuickCreateMeal(null);
    setNewFoodForm({ name: f.name });
    setNewFoodMacrosRef100g({
      calories: f.base_calories,
      protein: f.base_protein,
      carbs: f.base_carbs,
      fat: f.base_fat,
    });
    setConsumedAmountInput('100');
    setConsumedUnit('g');
    setOffPackageTotal(null);
    setNewFoodOpen(true);
  };

  const openNewFoodFromMealPicker = () => {
    setFoodScanPhase('off');
    const meal = pickerMealType;
    if (!meal) return;
    setEditingFoodId(null);
    resetNewFoodNutritionDraft();
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
    const bc = Math.max(0, roundMacro(newFoodMacrosRef100g.calories));
    const bp = Math.max(0, roundMacro(newFoodMacrosRef100g.protein));
    const bcar = Math.max(0, roundMacro(newFoodMacrosRef100g.carbs));
    const bf = Math.max(0, roundMacro(newFoodMacrosRef100g.fat));

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
      resetNewFoodNutritionDraft();
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
    resetNewFoodNutritionDraft();

    if (ctx === 'meal-picker' && mealAfterPicker && data) {
      const food = mapRowToCustomFood(data);
      setCustomFoods((prev) => [food, ...prev.filter((x) => x.id !== food.id)]);
      setMealPickerOpen(false);
      setPickerMealType(null);
      setFoodPickerSearch('');
      setSelectedFood(food);
      setPortionQty('100');
      setPortionUnit('g');
      setLogMealType(mealAfterPicker);
      setCalculatorMealLocked(true);
      setCalculatorOpen(true);
      toast({ title: 'Alimento creado', description: 'Ajustá la cantidad consumida y agregalo al diario.' });
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
    setPortionQty('100');
    setPortionUnit('g');
    setLogMealType(meal);
    setCalculatorMealLocked(true);
    setCalculatorOpen(true);
  };

  const openCalculatorFromLibrary = (food: CustomFood) => {
    setSelectedFood(food);
    setPortionQty('100');
    setPortionUnit('g');
    setLogMealType('desayuno');
    setCalculatorMealLocked(false);
    setCalculatorOpen(true);
  };

  const closeCalculator = () => {
    setCalculatorOpen(false);
    setSelectedFood(null);
    setCalculatorMealLocked(false);
    setPortionUnit('g');
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
    <div className="min-h-screen bg-background px-4 pb-24">
      <div className="mx-auto max-w-lg">
        <PageScreenHeader title="Nutrición" />

        <Tabs value={nutritionTab} onValueChange={setNutritionTab} className="w-full">
          <TabsList className="mb-5 grid h-11 w-full grid-cols-2 rounded-xl border border-border/40 bg-card/60 p-1 backdrop-blur-sm">
            <TabsTrigger value="diario" className="rounded-lg text-sm font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
              Diario
            </TabsTrigger>
            <TabsTrigger value="biblioteca" className="gap-1.5 rounded-lg text-sm font-bold data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BookOpen className="h-3.5 w-3.5 opacity-60" />
              Mis alimentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="mt-0 space-y-4">
            <div className="rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm">
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
                  <div key={m.key} className="rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm">
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
                        variant="ghost"
                        size="icon"
                        onClick={() => openMealFoodPicker(m.key)}
                        className="h-9 w-9 shrink-0 rounded-xl border-0 bg-primary/10 text-primary shadow-none transition-all duration-300 hover:bg-primary/20 active:scale-90 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30"
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
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {formatConsumedQuantityFromMultiplier(f.quantity_multiplier)}
                                </span>
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

            <div className="rounded-2xl border border-border/40 bg-card/80 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary/70" />
                <h2 className="text-sm font-bold tracking-tight text-foreground">Hidratación</h2>
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

            <div className="rounded-2xl border border-border/40 bg-card/80 p-4 backdrop-blur-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Bienestar de hoy</h2>
              <div className="space-y-4">
                <WellbeingScale label="Calidad de sueño" value={sleepQuality} onChange={(v) => void updateRecovery('sleep_quality', v)} />
                <WellbeingScale label="Nivel de energía" value={energyLevel} onChange={(v) => void updateRecovery('energy_level', v)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="biblioteca" className="mt-0 space-y-4">
            <Button
              onClick={openNewFoodFromLibrary}
              className="h-12 w-full rounded-xl bg-primary text-base font-bold tracking-tight text-white shadow-none transition-all hover:bg-[color:var(--brand-hover)] active:scale-[0.99]"
            >
              <Plus className="mr-2 h-5 w-5" strokeWidth={2} />
              Nuevo alimento
            </Button>

            {customFoods.length === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-card/80 px-6 py-10 text-center backdrop-blur-sm">
                <Apple className="mx-auto mb-4 h-14 w-14 text-zinc-300 dark:text-zinc-600" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Todavía no tenés alimentos. Creá el primero para armar tu biblioteca personal.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {customFoods.map((f) => (
                  <li key={f.id} className="flex gap-1 rounded-2xl border border-border/40 bg-card/80 p-2 pr-1 backdrop-blur-sm">
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
            setFoodScanPhase('off');
            resetNewFoodNutritionDraft();
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-0 bg-card p-0 sm:max-w-md">
          <div className="p-6 pb-2 pt-6">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="pr-8 text-xl font-bold tracking-tight text-foreground">
                {editingFoodId ? 'Editar alimento' : 'Nuevo alimento'}
              </DialogTitle>
              <p className="text-sm leading-snug text-muted-foreground">
                {foodScanPhase === 'scanning' && !editingFoodId
                  ? 'Escaneá el código de barras para cargar datos por 100 g desde Open Food Facts.'
                  : editingFoodId
                    ? 'Editá la referencia cada 100 g o ml; los totales se recalculan con la cantidad consumida.'
                    : 'Open Food Facts suele traer datos cada 100 g o 100 ml; ajustá la cantidad para ver el total comido antes de guardar.'}
              </p>
            </DialogHeader>
          </div>

          <div className="relative max-h-[min(58vh,520px)] space-y-4 overflow-y-auto px-6 pb-4">
            {foodScanPhase === 'scanning' && !editingFoodId ? (
              <NutritionBarcodeScanner
                active={foodScanPhase === 'scanning'}
                onCancel={() => setFoodScanPhase('off')}
                onDecoded={handleOpenFoodFactsBarcode}
                onStartError={handleBarcodeScannerPermissionError}
              />
            ) : (
              <div className="relative space-y-4">
                <div
                  className={
                    foodScanPhase === 'fetching'
                      ? 'pointer-events-none select-none space-y-4 opacity-60'
                      : 'space-y-4'
                  }
                >
                  <div>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                      <label
                        htmlFor="new-food-name"
                        className="mb-0 block text-xs font-medium text-muted-foreground sm:mb-1.5 sm:flex-1"
                      >
                        Nombre
                      </label>
                      {!editingFoodId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-11 shrink-0 gap-2 rounded-xl border-primary/35 font-semibold text-primary shadow-none hover:bg-primary/10"
                          onClick={() => setFoodScanPhase('scanning')}
                          disabled={foodScanPhase === 'fetching'}
                        >
                          <Barcode className="h-4 w-4" aria-hidden />
                          Escanear producto
                        </Button>
                      )}
                    </div>
                    <Input
                      id="new-food-name"
                      autoFocus={foodScanPhase === 'off'}
                      placeholder="Ej. Avena integral o Hamburguesa"
                      value={newFoodForm.name}
                      onChange={(e) => setNewFoodForm((p) => ({ ...p, name: e.target.value }))}
                      className={NUTRITION_FORM_INPUT_CLASS}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <label
                          htmlFor="new-food-consumed-amt"
                          className="block text-xs font-medium text-muted-foreground"
                        >
                          Cantidad consumida
                        </label>
                        <Input
                          id="new-food-consumed-amt"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          placeholder="100"
                          value={consumedAmountInput}
                          onChange={(e) => setConsumedAmountInput(e.target.value)}
                          className={NUTRITION_FORM_INPUT_CLASS}
                        />
                      </div>
                      <div className="w-full shrink-0 space-y-1.5 sm:w-[44%]">
                        <span className="block text-xs font-medium text-muted-foreground">Unidad</span>
                        <Select
                          value={consumedUnit}
                          onValueChange={(v) => setConsumedUnit(v as 'g' | 'ml')}
                        >
                          <SelectTrigger id="new-food-consumed-unit" className="min-h-[48px] rounded-xl border-0 bg-zinc-100 dark:bg-zinc-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="g">Gramos (g)</SelectItem>
                            <SelectItem value="ml">Mililitros (ml)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {offPackageTotal ? (
                      <div className="rounded-xl border border-border/50 bg-muted/40 px-3 py-2">
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {offPackageTotal.unit === 'ml'
                            ? 'Contenido total del envase (referencia):'
                            : 'Peso total del envase (referencia):'}{' '}
                          <span className="font-semibold tabular-nums text-foreground/90">
                            {formatPackageReferenceLabel(offPackageTotal)}
                          </span>
                        </p>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="mt-2 h-10 w-full rounded-xl font-semibold"
                          onClick={loadFullPackIntoConsumedAmount}
                        >
                          Cargar envase completo
                        </Button>
                      </div>
                    ) : null}

                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Calorías, proteínas, carbohidratos y grasas abajo muestran el total para la cantidad
                      anterior; guardamos en la biblioteca la referencia por cada{' '}
                      <span className="font-medium text-foreground/80">100 {consumedUnit}</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-food-cals" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Calorías (kcal)
                      </label>
                      <Input
                        id="new-food-cals"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        placeholder="0"
                        value={formatMacroDisplayKcal(newFoodMacrosRef100g.calories * consumedScaleFactor)}
                        onChange={(e) => patchMacroDisplayToRef100('calories', e.target.value)}
                        className={NUTRITION_FORM_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="new-food-prot" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Proteínas (g)
                      </label>
                      <Input
                        id="new-food-prot"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        placeholder="0"
                        value={formatMacroDisplayGrams(newFoodMacrosRef100g.protein * consumedScaleFactor)}
                        onChange={(e) => patchMacroDisplayToRef100('protein', e.target.value)}
                        className={NUTRITION_FORM_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="new-food-carbs" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Carbohidratos (g)
                      </label>
                      <Input
                        id="new-food-carbs"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        placeholder="0"
                        value={formatMacroDisplayGrams(newFoodMacrosRef100g.carbs * consumedScaleFactor)}
                        onChange={(e) => patchMacroDisplayToRef100('carbs', e.target.value)}
                        className={NUTRITION_FORM_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="new-food-fat" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        Grasas (g)
                      </label>
                      <Input
                        id="new-food-fat"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        placeholder="0"
                        value={formatMacroDisplayGrams(newFoodMacrosRef100g.fat * consumedScaleFactor)}
                        onChange={(e) => patchMacroDisplayToRef100('fat', e.target.value)}
                        className={NUTRITION_FORM_INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>

                {foodScanPhase === 'fetching' ? <NutritionBarcodeScanLoadingOverlay /> : null}
              </div>
            )}

          </div>

          <DialogFooter className="gap-3 border-t border-border/40 bg-card p-4 sm:justify-between">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="min-h-12 flex-1 rounded-xl font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200"
              >
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void saveNewFood()}
              disabled={savingFood || foodScanPhase === 'fetching'}
              className="min-h-12 flex-1 rounded-xl bg-primary px-6 text-base font-semibold text-white shadow-none hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
            >
              {savingFood
                ? 'Guardando…'
                : editingFoodId
                  ? 'Guardar cambios'
                  : newFoodContext === 'meal-picker'
                    ? 'Guardar y continuar'
                    : 'Guardar'}
            </Button>
          </DialogFooter>
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
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-0 bg-card px-4 pb-8 pt-3">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-lg font-bold tracking-tight text-foreground">
              {pickerMealType ? `Elegir alimento · ${MEALS.find((x) => x.key === pickerMealType)?.label ?? ''}` : 'Elegir alimento'}
            </SheetTitle>
          </SheetHeader>

          <Button
            type="button"
            variant="ghost"
            onClick={openNewFoodFromMealPicker}
            className="mb-4 h-12 w-full rounded-xl border-0 bg-primary/10 text-base font-semibold text-primary shadow-none hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30"
          >
            <Plus className="mr-2 h-5 w-5" />
            Crear nuevo alimento
          </Button>

          <div className="relative mb-4">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
              aria-hidden
            />
            <Input
              placeholder="Buscar por nombre…"
              value={foodPickerSearch}
              onChange={(e) => setFoodPickerSearch(e.target.value)}
              className="min-h-[52px] rounded-2xl border-0 bg-zinc-100 py-3.5 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground dark:bg-zinc-800"
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
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/50">
              {filteredPickerFoods.map((f) => (
                <li key={f.id} className="flex items-stretch bg-card/30">
                  <button
                    type="button"
                    onClick={() => selectFoodFromPicker(f)}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 py-4 pl-3 pr-2 text-left transition-colors hover:bg-zinc-50/80 active:bg-zinc-100/80 dark:hover:bg-zinc-900/50 dark:active:bg-zinc-900/70"
                  >
                    <span className="font-semibold text-lg leading-snug text-foreground">{f.name}</span>
                    <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                      {Math.round(f.base_calories)} kcal / 100 · P{f.base_protein}g C{f.base_carbs}g G{f.base_fat}g
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center pr-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => selectFoodFromPicker(f)}
                      className="h-11 w-11 shrink-0 rounded-xl border-0 bg-primary/10 text-primary shadow-none hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/30"
                      aria-label={`Elegir ${f.name}`}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
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
              <div className="rounded-xl bg-zinc-100/80 p-4 text-sm dark:bg-zinc-800/80">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Referencia cada 100 {portionUnit}
                </p>
                <p className="mt-1 tabular-nums text-foreground">
                  {Math.round(selectedFood.base_calories)} kcal · P{selectedFood.base_protein}g C{selectedFood.base_carbs}g G{selectedFood.base_fat}g
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <label htmlFor="portion-qty" className="mb-0 block text-xs font-medium text-muted-foreground">
                    Cantidad consumida
                  </label>
                  <Input
                    id="portion-qty"
                    type="number"
                    inputMode="decimal"
                    min={0.01}
                    step="any"
                    value={portionQty}
                    onChange={(e) => setPortionQty(e.target.value)}
                    className={NUTRITION_FORM_INPUT_CLASS}
                  />
                </div>
                <div className="w-full shrink-0 space-y-1.5 sm:w-[40%]">
                  <span className="block text-xs font-medium text-muted-foreground">Unidad</span>
                  <Select value={portionUnit} onValueChange={(v) => setPortionUnit(v as 'g' | 'ml')}>
                    <SelectTrigger id="portion-unit" className="min-h-[48px] rounded-xl border-0 bg-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Gramos (g)</SelectItem>
                      <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Total estimado ({formatConsumedQtyDisplay(scaledFromSelected.consumedQty)} {portionUnit})
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {formatMacroDisplayKcal(scaledFromSelected.calories)} kcal
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {`P${formatMacroDisplayGrams(scaledFromSelected.protein)}g · C${formatMacroDisplayGrams(scaledFromSelected.carbs)}g · G${formatMacroDisplayGrams(scaledFromSelected.fat)}g`}
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

              <Button
                type="button"
                onClick={() => void addLogFromLibrary()}
                disabled={savingLog}
                className="min-h-12 w-full rounded-xl bg-primary text-base font-semibold text-white shadow-none hover:bg-[color:var(--brand-hover)] disabled:opacity-60"
              >
                {savingLog ? 'Guardando…' : 'Agregar al diario'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const WELLBEING_LEVELS = [1, 2, 3, 4, 5] as const;

const WellbeingScale = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) => {
  const selected = value > 0 ? Math.min(5, Math.max(1, Math.round(value))) : null;
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-1.5">
        {WELLBEING_LEVELS.map((n) => {
          const isOn = selected === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={
                isOn
                  ? 'flex-1 rounded-full bg-primary py-2 text-sm font-semibold tabular-nums text-white transition-colors'
                  : 'flex-1 rounded-full bg-zinc-100 py-2 text-sm font-semibold tabular-nums text-zinc-500 transition-colors dark:bg-zinc-800 dark:text-zinc-500'
              }
              aria-pressed={isOn}
              aria-label={`${label}: ${n} de 5`}
            >
              {n}
            </button>
          );
        })}
      </div>
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
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

export default Nutrition;
