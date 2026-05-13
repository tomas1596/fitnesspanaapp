import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, User, Activity, Flame, Beef, Droplets, Save, Camera, Lock,
  Target, Plus, TrendingUp, Settings2, Sun, Moon, Pencil, LayoutDashboard, HelpCircle,
  FileText, Heart,
} from 'lucide-react';
import StepsRing from '@/components/StepsRing';
import { FAQBottomSheet } from '@/components/FAQBottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_GOAL_OPTIONS } from '@/lib/profileOptions';
import { calculateAge } from '@/lib/age';

const ADMIN_EMAIL = 'thomzonlyskills@gmail.com';

const todayStr = () => new Date().toISOString().split('T')[0];

/** Convierte input de formulario a número para columnas numeric en `profiles` (null si vacío o inválido). */
const parseProfileNumber = (raw: string): number | null => {
  const t = String(raw).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const AdminButton = () => {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      onClick={() => navigate('/admin')}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-600/15 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-600/25 dark:text-violet-300"
    >
      <LayoutDashboard className="h-4 w-4" />
      Panel de Control
    </Button>
  );
};

const Profile = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [draftFirst, setDraftFirst] = useState('');
  const [draftLast, setDraftLast] = useState('');
  const [draftDob, setDraftDob] = useState('');
  const [draftGender, setDraftGender] = useState('');
  const [savingIdentity, setSavingIdentity] = useState(false);

  const [steps, setSteps] = useState(0);
  const [stepsId, setStepsId] = useState<string | null>(null);
  const [stepGoal, setStepGoal] = useState(10000);
  const [goalDialog, setGoalDialog] = useState(false);
  const [draftGoal, setDraftGoal] = useState('10000');

  const [faqOpen, setFaqOpen] = useState(false);
  /** Tema de marca leído de profiles.theme ('default' | 'pink') */
  const [brandTheme, setBrandTheme] = useState<string>('default');

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const today = todayStr();
    const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    const { data, error } = await supabase.from('profiles').select(
      'first_name, last_name, date_of_birth, height, weight, gender, target_weight, avatar_url, step_goal, activity_level, fitness_goal, theme',
    ).eq('user_id', user.id).maybeSingle();
    const pick = (db: string | null | undefined, metaKey: string) =>
      (db != null && String(db).trim() !== '' ? String(db).trim() : '') || (meta[metaKey]?.trim() ?? '');
    if (data) {
      setFirstName(pick(data.first_name, 'first_name'));
      setLastName(pick(data.last_name, 'last_name'));
      setDateOfBirth(pick(data.date_of_birth, 'date_of_birth'));
      setHeight(data.height?.toString() || '');
      setWeight(data.weight?.toString() || '');
      setGender(pick(data.gender, 'gender'));
      setTargetWeight(data.target_weight?.toString() || '');
      setActivityLevel(data.activity_level || '');
      setFitnessGoal(data.fitness_goal || '');
      setAvatarUrl(data.avatar_url || null);
      setStepGoal(data.step_goal || 10000);
      setDraftGoal((data.step_goal || 10000).toString());
      setBrandTheme((data as { theme?: string }).theme || 'default');
    } else {
      setFirstName(meta.first_name?.trim() ?? '');
      setLastName(meta.last_name?.trim() ?? '');
      setDateOfBirth(meta.date_of_birth?.trim() ?? '');
      setGender(meta.gender?.trim() ?? '');
    }
    const { data: s } = await supabase.from('step_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle();
    if (s) { setSteps(s.steps); setStepsId(s.id); } else { setSteps(0); setStepsId(null); }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const openEditProfile = () => {
    setDraftFirst(firstName);
    setDraftLast(lastName);
    setDraftDob(dateOfBirth);
    setDraftGender(gender);
    setEditProfileOpen(true);
  };

  const saveIdentity = async () => {
    if (!user) return;
    const fn = draftFirst.trim();
    const ln = draftLast.trim();
    if (!fn || !ln || !draftDob || !draftGender) {
      toast({
        title: 'Faltan datos',
        description: 'Nombre, apellido, fecha de nacimiento y género son obligatorios.',
        variant: 'destructive',
      });
      return;
    }
    setSavingIdentity(true);
    const displayName = [fn, ln].filter(Boolean).join(' ');
    const { error } = await supabase.from('profiles').update({
      first_name: fn,
      last_name: ln,
      date_of_birth: draftDob,
      gender: draftGender,
      display_name: displayName,
    }).eq('user_id', user.id);
    setSavingIdentity(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setFirstName(fn);
    setLastName(ln);
    setDateOfBirth(draftDob);
    setGender(draftGender);
    setEditProfileOpen(false);
    toast({ title: 'Perfil actualizado' });
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const heightNum = parseProfileNumber(height);
    const weightNum = parseProfileNumber(weight);
    const targetWeightNum = parseProfileNumber(targetWeight);
    const activity = activityLevel.trim() || null;
    const fitness = fitnessGoal.trim() || null;
    const avatar = avatarUrl?.trim() || null;

    const { data, error } = await supabase
      .from('profiles')
      .update({
        height: heightNum,
        weight: weightNum,
        target_weight: targetWeightNum,
        activity_level: activity,
        fitness_goal: fitness,
        avatar_url: avatar,
      })
      .eq('user_id', user.id)
      .select('height, weight, target_weight, activity_level, fitness_goal, avatar_url')
      .maybeSingle();

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    const row = data;
    if (row) {
      setHeight(row.height != null ? String(row.height) : '');
      setWeight(row.weight != null ? String(row.weight) : '');
      setTargetWeight(row.target_weight != null ? String(row.target_weight) : '');
      setActivityLevel(row.activity_level ?? '');
      setFitnessGoal(row.fitness_goal ?? '');
      setAvatarUrl(row.avatar_url ?? null);
    } else {
      setHeight(heightNum != null ? String(heightNum) : '');
      setWeight(weightNum != null ? String(weightNum) : '');
      setTargetWeight(targetWeightNum != null ? String(targetWeightNum) : '');
      setActivityLevel(activityLevel);
      setFitnessGoal(fitnessGoal);
      setAvatarUrl(avatarUrl);
    }

    toast({ title: 'Guardado', description: 'Datos actualizados.' });
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Error al subir imagen', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('user_id', user.id);
    if (profileError) {
      toast({ title: 'Error al guardar foto', description: profileError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }
    setAvatarUrl(url);
    setUploadingAvatar(false);
    toast({ title: 'Foto actualizada' });
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
        { user_id: user.id, log_date: today, steps: next },
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

  const w = parseFloat(weight);
  const h = parseFloat(height);
  const tw = parseFloat(targetWeight);
  const ageYears = calculateAge(dateOfBirth);
  const hasData = w > 0 && h > 0 && ageYears != null && ageYears > 0 && !!gender;
  const imc = hasData ? w / ((h / 100) ** 2) : 0;
  const bmr = hasData ? (gender === 'male' ? 10 * w + 6.25 * h - 5 * ageYears + 5 : 10 * w + 6.25 * h - 5 * ageYears - 161) : 0;
  const tdee = Math.round(bmr * 1.55);
  const proteinGoal = hasData ? Math.round(w * 2) : 0;
  const hydrationL = hasData ? ((w * 35) / 1000).toFixed(1) : '0';
  const weightDiff = w > 0 && tw > 0 ? (w - tw) : null;

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const ageLabel = ageYears != null ? `${ageYears} años` : 'Completá tu fecha de nacimiento';

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <div className="w-48">
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="h-10 rounded-xl border border-input bg-card text-xs font-medium text-foreground shadow-sm">
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
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> :
                  <User className="h-6 w-6 text-muted-foreground" />}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <Camera className="h-4 w-4 text-white" />
                </div>
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-tight text-foreground">
                {fullName || 'Tu nombre'}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{ageLabel}</p>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={openEditProfile} aria-label="Editar perfil">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Banner Modo Rosita (solo para usuarios VIP) ── */}
        {brandTheme === 'pink' && (
          <div className="flex items-center gap-3 rounded-2xl border border-pink-300/60 bg-pink-100/50 px-4 py-3 dark:border-pink-500/30 dark:bg-pink-500/10">
            <Heart className="h-5 w-5 shrink-0 fill-pink-500 text-pink-500" />
            <p className="text-sm font-semibold text-pink-600 dark:text-pink-400">
              Modo Rosita para mi amor ♥ Te amo
            </p>
          </div>
        )}

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
                  className="h-10 rounded-xl border border-input bg-secondary text-sm"
                />
                <Button size="sm" variant="secondary" onClick={() => updateSteps(steps + 1000)} className="h-10 rounded-xl px-3">
                  <Plus className="mr-1 h-3 w-3" /> 1k
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && user?.email === ADMIN_EMAIL && <AdminButton />}

        <div className="rounded-2xl bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datos & objetivos</h2>
          <div className="grid grid-cols-2 gap-2">
            <LabeledNum label="Altura (cm)" value={height} onChange={setHeight} />
            <LabeledNum label="Peso (kg)" value={weight} onChange={setWeight} />
            <LabeledNum label="Peso meta (kg)" value={targetWeight} onChange={setTargetWeight} />
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">Nivel de actividad</label>
              <Select value={activityLevel || undefined} onValueChange={setActivityLevel}>
                <SelectTrigger className="h-10 rounded-xl border border-input bg-secondary text-sm">
                  <SelectValue placeholder="Elegir nivel" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">Objetivo fitness</label>
              <Select value={fitnessGoal || undefined} onValueChange={setFitnessGoal}>
                <SelectTrigger className="h-10 rounded-xl border border-input bg-secondary text-sm">
                  <SelectValue placeholder="Elegir objetivo" />
                </SelectTrigger>
                <SelectContent>
                  {FITNESS_GOAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
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

        {hasData && (
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={Activity} label="IMC" value={imc.toFixed(1)} />
            <MiniStat icon={Flame} label="kcal" value={tdee.toString()} />
            <MiniStat icon={Beef} label="Prot" value={`${proteinGoal}g`} />
            <MiniStat icon={Droplets} label="Agua" value={`${hydrationL}L`} />
          </div>
        )}

        {/* ── Suscripción ── */}
        <div className="rounded-2xl bg-card p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFaqOpen(true)}
            className="h-10 w-full justify-start rounded-xl text-sm font-medium"
          >
            <HelpCircle className="mr-2 h-4 w-4 text-primary" /> Suscripción y Ayuda
          </Button>
        </div>

        {/* ── Ayuda e Información ── */}
        <div className="rounded-2xl bg-card p-3">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ayuda e Información
          </p>

          {/* Soporte directo por WhatsApp */}
          <a
            href="https://wa.me/5493388414236?text=Hola,%20necesito%20ayuda%20con%20Pana%20Fitness"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              {/* WhatsApp official SVG */}
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#25D366" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </span>
            Soporte directo
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">WhatsApp</span>
          </a>

          {/* Términos y Condiciones — mismo patrón visual que el <a> de arriba */}
          <button
            type="button"
            onClick={() => navigate('/terminos')}
            className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </span>
            Términos y Condiciones
          </button>
        </div>

        {/* ── Cuenta ── */}
        <div className="rounded-2xl bg-card p-3">
          <Button variant="ghost" onClick={() => setPasswordDialog(true)} className="h-10 w-full justify-start rounded-xl text-sm">
            <Lock className="mr-2 h-4 w-4" /> Cambiar Contraseña
          </Button>
          <Button variant="ghost" onClick={signOut} className="h-10 w-full justify-start rounded-xl text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
        </div>
      </div>

      <FAQBottomSheet open={faqOpen} onOpenChange={setFaqOpen} />

      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="rounded-2xl border-0 bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
              <Input value={draftFirst} onChange={(e) => setDraftFirst(e.target.value)} className="h-11 rounded-xl border border-input bg-secondary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Apellido</label>
              <Input value={draftLast} onChange={(e) => setDraftLast(e.target.value)} className="h-11 rounded-xl border border-input bg-secondary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fecha de nacimiento</label>
              <Input type="date" value={draftDob} onChange={(e) => setDraftDob(e.target.value)} className="h-11 rounded-xl border border-input bg-secondary" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Género</label>
              <Select value={draftGender} onValueChange={setDraftGender}>
                <SelectTrigger className="h-11 rounded-xl border border-input bg-secondary">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => void saveIdentity()} disabled={savingIdentity} className="h-11 w-full rounded-xl font-semibold">
              {savingIdentity ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="rounded-2xl border-0 bg-card">
          <DialogHeader><DialogTitle className="text-foreground">Meta diaria de pasos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" inputMode="numeric" value={draftGoal}
              onChange={e => setDraftGoal(e.target.value)} className="h-12 rounded-xl border border-input bg-secondary" />
            <Button onClick={saveStepGoal} className="h-12 w-full rounded-xl text-base font-semibold">Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="rounded-2xl border-0 bg-card">
          <DialogHeader><DialogTitle className="text-foreground">Cambiar Contraseña</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="password" placeholder="Nueva contraseña (mín. 6)" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-xl border border-input bg-secondary" />
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
      className="h-10 rounded-xl border border-input bg-secondary text-sm" />
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
