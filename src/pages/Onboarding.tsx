import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, isProfileIncomplete, type ProfileRow } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_GOAL_OPTIONS } from '@/lib/profileOptions';

const Onboarding = () => {
  const { user, loading, syncProfileCompletionFromRow, refreshProfileCompletion } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    dateOfBirth.length > 0 &&
    Number(weight) > 0 &&
    Number(height) > 0 &&
    !!gender &&
    !!activityLevel &&
    !!fitnessGoal;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSaving(true);

    const fn = firstName.trim();
    const ln = lastName.trim();
    const displayName = [fn, ln].filter(Boolean).join(' ');

    const payload = {
      user_id: user.id,
      first_name: fn,
      last_name: ln,
      date_of_birth: dateOfBirth,
      display_name: displayName,
      gender,
      weight: Number(weight),
      height: Number(height),
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
    };

    const profileSelect =
      'first_name, last_name, date_of_birth, gender, weight, height, activity_level, fitness_goal';

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select(profileSelect)
      .single();

    setSaving(false);

    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
      return;
    }

    const row = data as ProfileRow;
    syncProfileCompletionFromRow(row);
    if (isProfileIncomplete(row)) {
      toast({
        title: 'No se pudo verificar el perfil',
        description: 'Probá de nuevo en unos segundos.',
        variant: 'destructive',
      });
      await refreshProfileCompletion();
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
                autoComplete="given-name"
                className="h-11 rounded-xl border border-input bg-secondary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Apellido</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
                autoComplete="family-name"
                className="h-11 rounded-xl border border-input bg-secondary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Fecha de nacimiento</label>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="h-11 rounded-xl border border-input bg-secondary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Género</label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-11 rounded-xl border border-input bg-secondary">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Masculino</SelectItem>
                <SelectItem value="female">Femenino</SelectItem>
              </SelectContent>
            </Select>
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
                className="h-11 rounded-xl border border-input bg-secondary"
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
                className="h-11 rounded-xl border border-input bg-secondary"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Nivel de Actividad</label>
            <Select value={activityLevel} onValueChange={setActivityLevel}>
              <SelectTrigger className="h-11 rounded-xl border border-input bg-secondary">
                <SelectValue placeholder="Seleccionar nivel" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Objetivo</label>
            <Select value={fitnessGoal} onValueChange={setFitnessGoal}>
              <SelectTrigger className="h-11 rounded-xl border border-input bg-secondary">
                <SelectValue placeholder="Seleccionar objetivo" />
              </SelectTrigger>
              <SelectContent>
                {FITNESS_GOAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
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
