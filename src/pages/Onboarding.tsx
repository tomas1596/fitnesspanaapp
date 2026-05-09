import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const Onboarding = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const canSubmit =
    displayName.trim().length > 0 &&
    Number(age) > 0 &&
    Number(weight) > 0 &&
    Number(height) > 0 &&
    !!gender &&
    !!activityLevel &&
    !!fitnessGoal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      display_name: displayName.trim(),
      age: Number(age),
      gender,
      weight: Number(weight),
      height: Number(height),
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
    setSaving(false);

    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Perfil inicial guardado', description: '¡Bienvenido a Pana Fitness!' });
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-foreground">Bienvenido</h1>
        <p className="mt-1 text-sm text-muted-foreground">Completá tu perfil para personalizar la app.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-4 rounded-2xl bg-card p-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="¿Cómo te llamás?"
              className="h-11 rounded-xl border-0 bg-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Edad</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Género</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-11 rounded-xl border-0 bg-secondary">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Peso actual (kg)</label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Altura (cm)</label>
              <Input
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="h-11 rounded-xl border-0 bg-secondary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nivel de Actividad</label>
            <Select value={activityLevel} onValueChange={setActivityLevel}>
              <SelectTrigger className="h-11 rounded-xl border-0 bg-secondary">
                <SelectValue placeholder="Seleccionar nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentario">Sedentario</SelectItem>
                <SelectItem value="ligero">Ligero</SelectItem>
                <SelectItem value="moderado">Moderado</SelectItem>
                <SelectItem value="intenso">Intenso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Objetivo</label>
            <Select value={fitnessGoal} onValueChange={setFitnessGoal}>
              <SelectTrigger className="h-11 rounded-xl border-0 bg-secondary">
                <SelectValue placeholder="Seleccionar objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bajar_grasa">Bajar grasa</SelectItem>
                <SelectItem value="mantener">Mantener</SelectItem>
                <SelectItem value="ganar_musculo">Ganar músculo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={!canSubmit || saving} className="h-11 w-full rounded-xl font-semibold">
            {saving ? 'Guardando...' : 'Finalizar'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Onboarding;
