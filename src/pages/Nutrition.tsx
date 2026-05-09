import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, Droplets, Trash2, Sun, Sunset, Cookie, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import HalfStarRating from '@/components/HalfStarRating';

const today = new Date().toISOString().split('T')[0];

type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
type FoodEntry = {
  id: string;
  name: string;
  meal: Meal;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const MEALS: { key: Meal; label: string; icon: typeof Sun }[] = [
  { key: 'breakfast', label: 'Desayuno', icon: Sun },
  { key: 'lunch',     label: 'Almuerzo', icon: Sunset },
  { key: 'snack',     label: 'Merienda', icon: Cookie },
  { key: 'dinner',    label: 'Cena',     icon: Moon },
];

const Nutrition = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [goals, setGoals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, hydrationGlasses: 8 });
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [glasses, setGlasses] = useState(0);
  const [hydrationId, setHydrationId] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [activeMeal, setActiveMeal] = useState<Meal>('breakfast');
  const [manualForm, setManualForm] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });

  // Wellness today
  const [sleepQuality, setSleepQuality] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);
  const [recoveryId, setRecoveryId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('weight, height, age, gender').eq('user_id', user.id).single().then(({ data }) => {
      if (!data || !data.weight || !data.height || !data.age || !data.gender) return;
      const w = Number(data.weight);
      const h = Number(data.height);
      const a = Number(data.age);
      const bmr = data.gender === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
      const cals = Math.round(bmr * 1.55);
      const protein = Math.round(w * 2);
      // Macros split: protein already in grams; carbs ~45% kcal /4, fat ~25% kcal /9
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

  const fetchFoods = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('food_entries').select('*').eq('user_id', user.id).eq('entry_date', today).order('created_at');
    setFoods((data || []).map(f => ({
      id: f.id,
      name: f.name,
      meal: (f.meal as Meal) || 'breakfast',
      quantity: Number(f.quantity ?? 1),
      calories: f.calories,
      protein: Number(f.protein),
      carbs: Number(f.carbs ?? 0),
      fat: Number(f.fat ?? 0),
    })));
  }, [user]);

  const fetchHydration = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('hydration_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle();
    if (data) { setGlasses(data.glasses); setHydrationId(data.id); }
  }, [user]);

  useEffect(() => { fetchFoods(); fetchHydration(); }, [fetchFoods, fetchHydration]);

  useEffect(() => {
    if (!user) return;
    supabase.from('recovery_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSleepQuality(Number(data.sleep_quality));
          setEnergyLevel(Number(data.energy_level));
          setRecoveryId(data.id);
        }
      });
  }, [user]);

  const updateRecovery = async (field: 'sleep_quality' | 'energy_level', val: number) => {
    if (!user) return;
    if (field === 'sleep_quality') setSleepQuality(val); else setEnergyLevel(val);
    if (recoveryId) {
      await supabase.from('recovery_logs').update({ [field]: val } as never).eq('id', recoveryId);
    } else {
      const { data } = await supabase.from('recovery_logs').insert({
        user_id: user.id, log_date: today,
        sleep_quality: field === 'sleep_quality' ? val : sleepQuality,
        energy_level: field === 'energy_level' ? val : energyLevel,
      }).select().single();
      if (data) setRecoveryId(data.id);
    }
  };

  // Totals
  const totals = useMemo(() => foods.reduce((acc, f) => ({
    calories: acc.calories + f.calories,
    protein: acc.protein + f.protein,
    carbs: acc.carbs + f.carbs,
    fat: acc.fat + f.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);

  const calsLeft = goals.calories ? goals.calories - totals.calories : 0;

  const openSearch = (meal: Meal) => {
    setActiveMeal(meal);
    setManualForm({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setSearchOpen(true);
  };

  const addManualFood = async () => {
    if (!user) return;
    const name = manualForm.name.trim();
    const calories = Math.max(0, Math.round(Number(manualForm.calories) || 0));
    const protein = Math.max(0, Number(manualForm.protein) || 0);
    const carbs = Math.max(0, Number(manualForm.carbs) || 0);
    const fat = Math.max(0, Number(manualForm.fat) || 0);
    if (!name) {
      toast({ title: 'Falta el nombre de la comida', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('food_entries').insert({
      user_id: user.id,
      entry_date: today,
      meal: activeMeal,
      name,
      quantity: 1,
      calories,
      protein: +protein.toFixed(2),
      carbs: +carbs.toFixed(2),
      fat: +fat.toFixed(2),
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setSearchOpen(false);
    setManualForm({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    fetchFoods();
  };

  const deleteFood = async (id: string) => {
    await supabase.from('food_entries').delete().eq('id', id);
    fetchFoods();
  };

  const updateGlasses = async (val: number) => {
    if (!user) return;
    const next = Math.max(0, val);
    setGlasses(next);
    if (hydrationId) {
      await supabase.from('hydration_logs').update({ glasses: next }).eq('id', hydrationId);
    } else {
      const { data } = await supabase.from('hydration_logs').insert({ user_id: user.id, log_date: today, glasses: next }).select().single();
      if (data) setHydrationId(data.id);
    }
  };

  const glassesLiters = (glasses * 0.25).toFixed(2);

  // Calorie ring
  const ringPct = goals.calories ? Math.min(100, (totals.calories / goals.calories) * 100) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - ringPct / 100);

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-4 text-2xl font-bold text-foreground">Nutrición</h1>

        {/* Top summary card with ring + macros */}
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
                <span className="text-2xl font-extrabold tabular-nums text-foreground">{goals.calories ? Math.max(0, calsLeft) : totals.calories}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{goals.calories ? 'kcal restantes' : 'kcal'}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              <MacroBar label="Proteínas" value={totals.protein} goal={goals.protein} unit="g" color="hsl(var(--primary))" />
              <MacroBar label="Carbos"    value={totals.carbs}   goal={goals.carbs}   unit="g" color="#FF8A00" />
              <MacroBar label="Grasas"    value={totals.fat}     goal={goals.fat}     unit="g" color="#FFC700" />
            </div>
          </div>
          {!goals.calories && (
            <p className="mt-3 text-center text-xs text-muted-foreground/70">Completa tu perfil para ver tus metas.</p>
          )}
        </div>

        {/* Meal blocks */}
        <div className="mt-4 space-y-3">
          {MEALS.map(m => {
            const items = foods.filter(f => f.meal === m.key);
            const sumCal = items.reduce((s, f) => s + f.calories, 0);
            const sumProt = items.reduce((s, f) => s + f.protein, 0);
            const Icon = m.icon;
            return (
              <div key={m.key} className="rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{m.label}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {sumCal} kcal · {Math.round(sumProt)}g prot
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    onClick={() => openSearch(m.key)}
                    className="h-9 w-9 rounded-xl"
                    aria-label={`Añadir a ${m.label}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {items.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {items.map(f => (
                      <li key={f.id} className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{f.name} <span className="text-xs text-muted-foreground">×{f.quantity}</span></p>
                          <p className="text-[11px] text-muted-foreground">{f.calories} kcal · P{Math.round(f.protein)} C{Math.round(f.carbs)} G{Math.round(f.fat)}</p>
                        </div>
                        <button onClick={() => deleteFood(f.id)} className="ml-2 shrink-0 text-muted-foreground/60 hover:text-destructive">
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

        {/* Hydration */}
        <div className="mt-4 rounded-2xl bg-card p-4">
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

        {/* Wellness today */}
        <div className="mt-4 rounded-2xl bg-card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bienestar de hoy</h2>
          <div className="space-y-3">
            <HalfStarRating label="Calidad de Sueño" value={sleepQuality} onChange={v => updateRecovery('sleep_quality', v)} />
            <HalfStarRating label="Nivel de Energía" value={energyLevel} onChange={v => updateRecovery('energy_level', v)} />
          </div>
        </div>
      </div>

      {/* Manual food dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="rounded-2xl border-0 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Añadir comida manual · {MEALS.find(m => m.key === activeMeal)?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Nombre de la comida"
              value={manualForm.name}
              onChange={(e) => setManualForm((prev) => ({ ...prev, name: e.target.value }))}
              className="h-11 rounded-xl border-0 bg-secondary"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Calorías"
                value={manualForm.calories}
                onChange={(e) => setManualForm((prev) => ({ ...prev, calories: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Proteínas (g)"
                value={manualForm.protein}
                onChange={(e) => setManualForm((prev) => ({ ...prev, protein: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Carbohidratos (g)"
                value={manualForm.carbs}
                onChange={(e) => setManualForm((prev) => ({ ...prev, carbs: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                placeholder="Grasas (g)"
                value={manualForm.fat}
                onChange={(e) => setManualForm((prev) => ({ ...prev, fat: e.target.value }))}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
            </div>
            <Button onClick={addManualFood} className="h-11 w-full rounded-xl text-base font-semibold">
              Guardar comida
            </Button>
          </div>
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