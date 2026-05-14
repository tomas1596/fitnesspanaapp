import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionContext } from '@/hooks/useSubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, User, Activity, Flame, Beef, Droplets, Save, Camera, Lock,
  Target, Plus, TrendingUp, Settings2, Sun, Moon, Pencil, LayoutDashboard, HelpCircle,
  FileText, Heart, Sparkles, AlertTriangle, Loader2, Trash2, X, ZoomIn,
} from 'lucide-react';
import StepsRing from '@/components/StepsRing';
import { PageScreenHeader } from '@/components/PageScreenHeader';
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

  // ── Subscription context ───────────────────────────────────────────────
  const {
    state: sub,
    notifiedTester,
    notifiedPremium,
    markTesterNotified,
    markPremiumNotified,
  } = useSubscriptionContext();

  const isTester = sub.status === 'premium' && (sub as { role: string }).role === 'tester' && !isAdmin;
  const isPremium = sub.status === 'premium' && (sub as { role: string }).role === 'premium';
  const isTrial = sub.status === 'trial';
  const isExpiredFree = sub.status === 'expired';
  const premiumDaysLeft = isPremium
    ? Math.max(0, Math.ceil(((sub as Extract<typeof sub, { status: 'premium' }>).until.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const [testerModalOpen, setTesterModalOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  // Show one-time tester welcome modal
  useEffect(() => {
    if (isTester && !notifiedTester) {
      setTesterModalOpen(true);
    }
  }, [isTester, notifiedTester]);

  // Show one-time premium activation modal
  useEffect(() => {
    if (isPremium && !notifiedPremium) {
      setPremiumModalOpen(true);
    }
  }, [isPremium, notifiedPremium]);

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
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
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

  const deleteAvatar = async () => {
    if (!user) return;
    setAvatarModalOpen(false);
    setUploadingAvatar(true);
    if (avatarUrl) {
      const marker = '/storage/v1/object/public/avatars/';
      const idx = avatarUrl.indexOf(marker);
      if (idx !== -1) {
        const storagePath = decodeURIComponent(avatarUrl.slice(idx + marker.length).split('?')[0]);
        await supabase.storage.from('avatars').remove([storagePath]);
      }
    }
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
    setUploadingAvatar(false);
    if (error) {
      toast({ title: 'Error al eliminar foto', description: error.message, variant: 'destructive' });
      return;
    }
    setAvatarUrl(null);
    toast({ title: 'Foto eliminada' });
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
    <div className="min-h-screen bg-background px-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <PageScreenHeader
          title="Perfil"
          right={
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
          }
        />

        <div className="rounded-2xl bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void uploadAvatar(file);
                }}
              />
              <button
                type="button"
                onClick={() => { if (!uploadingAvatar) setAvatarModalOpen(true); }}
                className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent"
                aria-label="Cambiar foto de perfil"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  : <User className="h-6 w-6 text-muted-foreground" />}
                {uploadingAvatar ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-tight text-foreground">
                {fullName || 'Tu nombre'}
              </p>
              {/* ── Role badge ── */}
              <div className="mt-1">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    Admin 👑
                  </span>
                ) : isTester ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#39FF14]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#22c55e] dark:text-[#39FF14]">
                    Tester ∞
                  </span>
                ) : isPremium ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    ✦ Premium · {premiumDaysLeft}d
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Free
                  </span>
                )}
              </div>
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
              Modo Rosita para mi amor. Te amo. Gracias por tu apoyo incondicional.
            </p>
          </div>
        )}

        {/* ── Subscription banners (visible según rol, no para Admin) ── */}
        {!isAdmin && (
          <>
            {/* Trial: days remaining */}
            {isTrial && (
              <div className="flex items-center gap-3 rounded-2xl border border-muted bg-muted/50 px-4 py-3">
                <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Versión de prueba: te quedan{' '}
                  <span className="font-semibold text-foreground">
                    {(sub as Extract<typeof sub, { status: 'trial' }>).daysLeft}{' '}
                    {(sub as Extract<typeof sub, { status: 'trial' }>).daysLeft === 1 ? 'día' : 'días'}
                  </span>
                </p>
              </div>
            )}

            {/* Premium expiry warning: ≤5 days left */}
            {isPremium && premiumDaysLeft <= 5 && premiumDaysLeft > 0 && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Tu Premium vence pronto. Recuerda renovar para no perder acceso.
                </p>
              </div>
            )}

            {/* Free (trial or expired): upgrade CTA */}
            {(isTrial || isExpiredFree) && (
              <button
                type="button"
                onClick={() =>
                  toast({
                    title: '¡Próximamente! 🚀',
                    description: 'La suscripción Premium estará disponible muy pronto.',
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                Mejorar a Premium
              </button>
            )}
          </>
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

        {hasData && (
          <div className="grid grid-cols-4 gap-2">
            <MiniStat icon={Activity} label="IMC" value={imc.toFixed(1)} />
            <MiniStat icon={Flame} label="kcal" value={tdee.toString()} />
            <MiniStat icon={Beef} label="Prot" value={`${proteinGoal}g`} />
            <MiniStat icon={Droplets} label="Agua" value={`${hydrationL}L`} />
          </div>
        )}

        <div className="rounded-2xl bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datos & objetivos</h2>
          <div className="grid grid-cols-2 gap-2">
            <LabeledNum label="Altura (cm)" value={height} onChange={setHeight} />
            <LabeledNum label="Peso (kg)" value={weight} onChange={setWeight} />
            <LabeledNum label="Peso meta (kg)" value={targetWeight} onChange={setTargetWeight} />
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Nivel de actividad</label>
              <Select value={activityLevel || undefined} onValueChange={setActivityLevel}>
                <SelectTrigger className="h-10 rounded-xl border border-zinc-200 bg-white text-sm transition-colors focus:border-primary focus:ring-0 dark:border-border dark:bg-secondary">
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
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Objetivo fitness</label>
              <Select value={fitnessGoal || undefined} onValueChange={setFitnessGoal}>
                <SelectTrigger className="h-10 rounded-xl border border-zinc-200 bg-white text-sm transition-colors focus:border-primary focus:ring-0 dark:border-border dark:bg-secondary">
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
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="mt-3 h-11 w-full rounded-xl text-sm font-bold text-black transition-all duration-300 active:scale-95 dark:text-primary-foreground"
            style={{ boxShadow: '0 0 16px rgba(34,197,94,0.25)' }}
          >
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        {isAdmin && user?.email === ADMIN_EMAIL && <AdminButton />}

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

      {/* ── Avatar options modal ── */}
      {avatarModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center backdrop-blur-sm bg-black/60 sm:items-center"
          onClick={() => setAvatarModalOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview */}
            <div className="flex flex-col items-center gap-3 bg-muted/30 py-6">
              <button
                type="button"
                aria-label="Ver foto completa"
                onClick={() => avatarUrl && setLightboxOpen(true)}
                className="group relative h-24 w-24 overflow-hidden rounded-full bg-accent ring-4 ring-card shadow-lg transition-transform active:scale-95"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>}
                {avatarUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <ZoomIn className="h-6 w-6 text-white opacity-0 transition-opacity drop-shadow-lg group-hover:opacity-100" />
                  </div>
                )}
              </button>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {avatarUrl ? 'Toca para ampliar' : 'Foto de perfil'}
              </p>
            </div>

            {/* Actions */}
            <div className="divide-y divide-border">
              <button
                type="button"
                onClick={() => { setAvatarModalOpen(false); fileInputRef.current?.click(); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/5 active:bg-primary/10"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Camera className="h-4 w-4" />
                </span>
                Subir nueva foto
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => void deleteAvatar()}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/5 active:bg-destructive/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </span>
                  Eliminar foto actual
                </button>
              )}

              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="flex w-full items-center justify-center px-5 py-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent active:bg-accent/80"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Avatar lightbox ── */}
      {lightboxOpen && avatarUrl && (
        <AvatarLightbox src={avatarUrl} onClose={() => setLightboxOpen(false)} />
      )}

      {/* ── Tester welcome modal (shown once) ── */}
      <Dialog
        open={testerModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTesterModalOpen(false);
            void markTesterNotified();
          }
        }}
      >
        <DialogContent className="rounded-2xl border-0 bg-card text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-foreground">¡Bienvenido, Tester! 🎉</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2 pt-1">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#39FF14]/15">
              <span className="text-3xl">∞</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tenés <span className="font-semibold text-foreground">acceso de por vida</span> a todas las funciones de Pana Fitness.
              <br />
              ¡Gracias por testear y ayudarnos a mejorar la app! 🙌
            </p>
            <Button
              className="h-11 w-full rounded-xl font-semibold"
              onClick={() => {
                setTesterModalOpen(false);
                void markTesterNotified();
              }}
            >
              ¡Entendido!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Premium activation modal (shown once) ── */}
      <Dialog
        open={premiumModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPremiumModalOpen(false);
            void markPremiumNotified();
          }
        }}
      >
        <DialogContent className="rounded-2xl border-0 bg-card text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-foreground">¡Premium activado! ✦</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2 pt-1">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
              <span className="text-3xl">⭐</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tu suscripción <span className="font-semibold text-amber-600 dark:text-amber-400">Premium está activa por 30 días</span>.
              <br />
              Tenés acceso completo a todos los entrenamientos y funciones de la app.
            </p>
            <Button
              className="h-11 w-full rounded-xl bg-amber-500 font-semibold hover:bg-amber-600"
              onClick={() => {
                setPremiumModalOpen(false);
                void markPremiumNotified();
              }}
            >
              ¡Comenzar!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</label>
    <Input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={[
        'h-10 rounded-xl text-sm transition-colors duration-200',
        'border border-zinc-200 bg-white text-foreground',
        'focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0',
        'dark:border-border dark:bg-secondary',
        'dark:focus-visible:border-primary',
      ].join(' ')}
    />
  </div>
);

const MiniStat = ({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) => (
  <div className="rounded-xl bg-white p-2 text-center shadow-sm dark:bg-card/80 dark:shadow-none dark:border dark:border-border/40">
    <Icon className="mx-auto mb-1 h-4 w-4 text-primary/80" />
    <p className="text-sm font-bold text-foreground">{value}</p>
    <p className="text-[10px] text-muted-foreground/70">{label}</p>
  </div>
);

export default Profile;

/* ─────────────────────────────────────────────────────────────────────────────
   AvatarLightbox — full-screen image viewer with pinch/wheel zoom + pan
───────────────────────────────────────────────────────────────────────────── */
function AvatarLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const swipeRef = useRef<{ y: number } | null>(null);
  const scaleRef = useRef(1);

  const MIN = 1;
  const MAX = 6;
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

  const applyScale = (next: number) => {
    const s = clamp(next);
    scaleRef.current = s;
    setScale(s);
    if (s <= 1) setOffset({ x: 0, y: 0 });
  };

  /* Non-passive wheel listener so we can preventDefault (stops page scroll) */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      applyScale(scaleRef.current * (e.deltaY > 0 ? 0.88 : 1.14));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* ── Mouse drag ── */
  const onMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.px,
      y: dragStart.current.oy + e.clientY - dragStart.current.py,
    });
  };

  const onMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragStart.current = null;
  };

  /* ── Touch: pinch-to-zoom + pan + swipe-down-to-close ── */
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy) };
      swipeRef.current = null;
    } else if (e.touches.length === 1) {
      swipeRef.current = { y: e.touches[0].clientY };
      if (scaleRef.current > 1) {
        dragStart.current = {
          px: e.touches[0].clientX,
          py: e.touches[0].clientY,
          ox: offset.x,
          oy: offset.y,
        };
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      applyScale(scaleRef.current * (newDist / pinchRef.current.dist));
      pinchRef.current.dist = newDist;
    } else if (e.touches.length === 1 && scaleRef.current > 1 && dragStart.current) {
      setOffset({
        x: dragStart.current.ox + e.touches[0].clientX - dragStart.current.px,
        y: dragStart.current.oy + e.touches[0].clientY - dragStart.current.py,
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    /* Swipe-down to close only when not zoomed in */
    if (swipeRef.current && scaleRef.current <= 1.05 && e.changedTouches.length === 1) {
      const dy = e.changedTouches[0].clientY - swipeRef.current.y;
      if (dy > 90) { onClose(); return; }
    }
    if (e.touches.length === 0) dragStart.current = null;
    swipeRef.current = null;
  };

  /* Double-tap to reset zoom */
  const lastTapRef = useRef(0);
  const onTouchEndForDoubleTap = (e: React.TouchEvent) => {
    onTouchEnd(e);
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      scaleRef.current <= 1.05 ? applyScale(2.5) : applyScale(1);
    }
    lastTapRef.current = now;
  };

  const cursor = scaleRef.current > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';

  return (
    <div
      className="fixed inset-0 z-[300] bg-black select-none"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        aria-label="Cerrar visualizador"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-90"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <X className="h-5 w-5" />
      </button>

      {/* Zoom hint */}
      {scale <= 1 && (
        <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-xs text-white/40 select-none">
          Pellizca para hacer zoom · Desliza abajo para cerrar
        </p>
      )}

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ cursor, touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEndForDoubleTap}
      >
        <img
          src={src}
          alt="Foto de perfil"
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: isDragging || pinchRef.current ? 'none' : 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)',
            maxWidth: '92vw',
            maxHeight: '92vh',
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </div>
    </div>
  );
}
