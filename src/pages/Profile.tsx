import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, User, Activity, Flame, Beef, Droplets, Save, Camera, Lock,
  Target, Plus, TrendingUp, Settings2, Sun, Moon,
} from 'lucide-react';
import StepsRing from '@/components/StepsRing';
import EvolutionSheet from '@/components/EvolutionSheet';
import { useTheme } from '@/hooks/useTheme';

const todayStr = () => new Date().toISOString().split('T')[0];

const Profile = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  // Profile basics
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Steps
  const [steps, setSteps] = useState(0);
  const [stepsId, setStepsId] = useState<string | null>(null);
  const [stepGoal, setStepGoal] = useState(10000);
  const [goalDialog, setGoalDialog] = useState(false);
  const [draftGoal, setDraftGoal] = useState('10000');

  // Evolution timeline
  const [evolutionOpen, setEvolutionOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const today = todayStr();
    const { data } = await supabase.from('profiles').select('age, height, weight, gender, target_weight, avatar_url, step_goal').eq('user_id', user.id).single();
    if (data) {
      setAge(data.age?.toString() || '');
      setHeight(data.height?.toString() || '');
      setWeight(data.weight?.toString() || '');
      setGender(data.gender || '');
      setTargetWeight(data.target_weight?.toString() || '');
      setAvatarUrl(data.avatar_url || null);
      setStepGoal(data.step_goal || 10000);
      setDraftGoal((data.step_goal || 10000).toString());
    }
    const { data: s } = await supabase.from('step_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle();
    if (s) { setSteps(s.steps); setStepsId(s.id); } else { setSteps(0); setStepsId(null); }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      age: age ? parseInt(age) : null,
      height: height ? parseFloat(height) : null,
      weight: weight ? parseFloat(weight) : null,
      gender: gender || null,
      target_weight: targetWeight ? parseFloat(targetWeight) : null,
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Guardado', description: 'Datos actualizados.' });
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
    setAvatarUrl(url);
    setUploadingAvatar(false);
  };

  const updateSteps = async (val: number) => {
    if (!user) return;
    const next = Math.max(0, val);
    setSteps(next);
    const today = todayStr();
    if (stepsId) {
      await supabase.from('step_logs').update({ steps: next }).eq('id', stepsId);
    } else {
      const { data } = await supabase.from('step_logs').insert(
        { user_id: user.id, log_date: today, steps: next }
      ).select().single();
      if (data) setStepsId(data.id);
    }
  };

  const saveStepGoal = async () => {
    if (!user) return;
    const g = parseInt(draftGoal) || 10000;
    setStepGoal(g);
    setGoalDialog(false);
    await supabase.from('profiles').update({ step_goal: g }).eq('user_id', user.id);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast({ title: 'Error', description: 'Mínimo 6 caracteres', variant: 'destructive' }); return; }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contraseña actualizada' });
    setNewPassword(''); setPasswordDialog(false);
  };

  // Derived
  const w = parseFloat(weight); const h = parseFloat(height); const a = parseInt(age); const tw = parseFloat(targetWeight);
  const hasData = w > 0 && h > 0 && a > 0 && gender;
  const imc = hasData ? w / ((h / 100) ** 2) : 0;
  const bmr = hasData ? (gender === 'male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161) : 0;
  const tdee = Math.round(bmr * 1.55);
  const proteinGoal = hasData ? Math.round(w * 2) : 0;
  const hydrationL = hasData ? ((w * 35) / 1000).toFixed(1) : '0';
  const weightDiff = w > 0 && tw > 0 ? (w - tw) : null;

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <div className="w-48">
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="h-10 rounded-xl border-0 bg-card text-xs font-medium text-foreground">
                <SelectValue placeholder="Tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <span className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" /> Modo Día</span>
                </SelectItem>
                <SelectItem value="dark">
                  <span className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" /> Modo Noche</span>
                </SelectItem>
                <SelectItem value="system">Automático (Sistema)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User card (clean) */}
        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent"
              >
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> :
                  <User className="h-6 w-6 text-muted-foreground" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Atleta</p>
            </div>
          </div>
        </div>

        {/* Steps NEAT */}
        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-4">
            <StepsRing steps={steps} goal={stepGoal} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Pasos hoy</p>
                <button onClick={() => setGoalDialog(true)} className="flex items-center gap-1 text-[10px] text-primary">
                  <Settings2 className="h-3 w-3" /> Meta
                </button>
              </div>
              <p className="text-xs text-muted-foreground/70">Meta: {stepGoal.toLocaleString()}</p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={steps || ''}
                  placeholder="0"
                  onChange={e => updateSteps(parseInt(e.target.value) || 0)}
                  className="h-10 rounded-xl border-0 bg-secondary text-sm"
                />
                <Button size="sm" variant="secondary" onClick={() => updateSteps(steps + 1000)} className="h-10 rounded-xl px-3">
                  <Plus className="mr-1 h-3 w-3" /> 1k
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Evolution Físic */}
        <Button
          onClick={() => setEvolutionOpen(true)}
          variant="secondary"
          className="h-12 w-full justify-between rounded-2xl bg-card px-4 text-sm font-semibold text-foreground hover:bg-card/80"
        >
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Evolución Física
          </span>
          <span className="text-xs text-muted-foreground">›</span>
        </Button>

        {/* Biometric / goals */}
        <div className="rounded-2xl bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datos & objetivos</h2>
          <div className="grid grid-cols-2 gap-2">
            <LabeledNum label="Edad" value={age} onChange={setAge} />
            <LabeledNum label="Altura (cm)" value={height} onChange={setHeight} />
            <LabeledNum label="Peso (kg)" value={weight} onChange={setWeight} />
            <LabeledNum label="Peso meta (kg)" value={targetWeight} onChange={setTargetWeight} />
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">Género</label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-10 rounded-xl border-0 bg-secondary text-sm"><SelectValue placeholder="Elegir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {weightDiff !== null && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Target className="h-3 w-3" />
              {weightDiff > 0 ? `Faltan ${weightDiff.toFixed(1)} kg` :
                weightDiff < 0 ? `${Math.abs(weightDiff).toFixed(1)} kg bajo la meta` : '¡En tu meta! 🎉'}
            </p>
          )}
          <Button onClick={saveProfile} disabled={saving} className="mt-3 h-11 w-full rounded-xl text-sm font-semibold">
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        {/* Calculated cards */}
        {hasData && (
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={Activity} label="IMC" value={imc.toFixed(1)} />
            <MiniStat icon={Flame} label="kcal" value={tdee.toString()} />
            <MiniStat icon={Beef} label="Prot" value={`${proteinGoal}g`} />
            <MiniStat icon={Droplets} label="Agua" value={`${hydrationL}L`} />
          </div>
        )}

        {/* Account */}
        <div className="rounded-2xl bg-card p-3">
          <Button variant="ghost" onClick={() => setPasswordDialog(true)} className="h-10 w-full justify-start rounded-xl text-sm">
            <Lock className="mr-2 h-4 w-4" /> Cambiar Contraseña
          </Button>
          <Button variant="ghost" onClick={signOut} className="h-10 w-full justify-start rounded-xl text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
        </div>
      </div>

      <EvolutionSheet open={evolutionOpen} onClose={() => setEvolutionOpen(false)} />

      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="rounded-2xl border-0 bg-card">
          <DialogHeader><DialogTitle className="text-foreground">Meta diaria de pasos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" inputMode="numeric" value={draftGoal}
              onChange={e => setDraftGoal(e.target.value)} className="h-12 rounded-xl border-0 bg-secondary" />
            <Button onClick={saveStepGoal} className="h-12 w-full rounded-xl text-base font-semibold">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="rounded-2xl border-0 bg-card">
          <DialogHeader><DialogTitle className="text-foreground">Cambiar Contraseña</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="Nueva contraseña (mín. 6)" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-xl border-0 bg-secondary" />
            <Button onClick={changePassword} disabled={changingPassword} className="h-12 w-full rounded-xl text-base font-semibold">
              {changingPassword ? 'Guardando...' : 'Actualizar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LabeledNum = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
    <Input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
      className="h-10 rounded-xl border-0 bg-secondary text-sm" />
  </div>
);

const MiniStat = ({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) => (
  <div className="rounded-xl bg-card p-2 text-center">
    <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
    <p className="text-sm font-bold text-foreground">{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default Profile;
