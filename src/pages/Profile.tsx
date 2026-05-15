import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionContext } from '@/hooks/useSubscriptionStatus';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import {
  LogOut, User, Activity, Flame, Beef, Droplets, Save, Camera, Lock,
  Target, Plus, TrendingUp, Settings2, Pencil, LayoutDashboard, HelpCircle,
  FileText, Heart, Sparkles, AlertTriangle, Loader2, Trash2, X, ZoomIn, ChevronRight,
  Eye, EyeOff,
} from 'lucide-react';
import StepsRing from '@/components/StepsRing';
import { AvatarCropModal } from '@/components/AvatarCropModal';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import { FAQBottomSheet } from '@/components/FAQBottomSheet';
import { useTheme } from '@/hooks/useTheme';
import { ACTIVITY_LEVEL_OPTIONS, FITNESS_GOAL_OPTIONS } from '@/lib/profileOptions';
import { calculateAge } from '@/lib/age';
import { todayLocalYMD, localDayBoundsISO } from '@/lib/nutritionDay';
import { cn } from '@/lib/utils';
import { passwordMeetsPolicy } from '@/lib/passwordPolicy';
import { PasswordRequirementsList } from '@/components/PasswordRequirementsList';

const ADMIN_EMAIL = 'thomzonlyskills@gmail.com';

/** Valor estable para `<Select controlled>` antes de elegir opción — evita `undefined` → warning uncontrolled/controlado. */
const PROFILE_SELECT_UNSET = '__unset__';

function profileActivitySelectValue(activityLevel: string): string {
  const t = activityLevel.trim();
  if (!t) return PROFILE_SELECT_UNSET;
  return ACTIVITY_LEVEL_OPTIONS.some((o) => o.value === t) ? t : PROFILE_SELECT_UNSET;
}

function profileFitnessSelectValue(fitnessGoal: string): string {
  const t = fitnessGoal.trim();
  if (!t) return PROFILE_SELECT_UNSET;
  return FITNESS_GOAL_OPTIONS.some((o) => o.value === t) ? t : PROFILE_SELECT_UNSET;
}

const todayStr = () => new Date().toISOString().split('T')[0];

/** Fecha corta estilo feedback producto ("Lun. 11 Nov") para pasos diarios */
const formatStepsHeaderDate = (d = new Date()) => {
  const dow = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
  const mon = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][d.getMonth()];
  return `${dow}. ${d.getDate()} ${mon}`;
};

/** Convierte input de formulario a número para columnas numeric en `profiles` (null si vacío o inválido). */
const parseProfileNumber = (raw: string): number | null => {
  const t = String(raw).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Inputs / selects en «Datos & objetivos»: contraste y focus neón. */
const profileFormInputClass =
  'min-h-[2.875rem] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base shadow-none outline-none ring-0 ring-offset-0 md:text-sm ' +
  'text-zinc-900 placeholder:text-zinc-400 transition-[border-color,box-shadow] duration-200 ' +
  'focus-visible:!border-primary focus-visible:!outline-none focus-visible:!ring-1 focus-visible:!ring-primary focus-visible:!ring-offset-0 ' +
  'dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 ' +
  'dark:focus-visible:!border-primary dark:focus-visible:!ring-primary disabled:opacity-60';

/** SelectTrigger: foco compacto tipo iOS sin doble ring gris por defecto. */
const profileFormSelectTriggerClass =
  'min-h-[2.875rem] h-auto w-full justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-base md:text-sm ' +
  'text-zinc-900 shadow-none outline-none ring-0 ring-offset-0 transition-[border-color,box-shadow] duration-200 ' +
  'focus:!border-primary focus:!outline-none focus:!ring-1 focus:!ring-primary focus:!ring-offset-0 ' +
  'focus-visible:!border-primary focus-visible:!ring-1 focus-visible:!ring-primary focus-visible:!ring-offset-0 ' +
  'data-[state=open]:!border-primary data-[state=open]:!ring-1 data-[state=open]:!ring-primary data-[state=open]:!ring-offset-0 ' +
  'dark:border-zinc-700 dark:bg-zinc-900 dark:text-white ' +
  'dark:focus:!border-primary dark:focus:!ring-primary dark:data-[state=open]:!border-primary dark:data-[state=open]:!ring-primary ' +
  'disabled:opacity-60 data-[placeholder]:text-zinc-400 dark:data-[placeholder]:text-zinc-500';

const settingsListCardCn =
  'overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none';

const settingsListRowCn =
  'flex min-h-[3rem] w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-zinc-900 ' +
  'transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900/70 dark:active:bg-zinc-800/80';

const settingsListSectionHeaderCn =
  'border-b border-zinc-100 bg-zinc-50/90 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70';

/** Inputs en modal «Editar perfil»: fondo suave y radios amplios */
const editModalInputClass =
  'h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 text-base text-zinc-900 shadow-none outline-none transition ' +
  'placeholder:text-zinc-400 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary ' +
  'dark:border-zinc-600/80 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-primary dark:focus-visible:ring-primary';

const modalSurfaceClass =
  'max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl ' +
  'dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100';

const profileNeonButtonClass =
  'w-full rounded-xl border-0 bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-md shadow-[0_10px_24px_var(--brand-glow-sm)] transition hover:bg-[color:var(--brand-hover)] hover:shadow-[0_12px_30px_var(--brand-glow)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:text-black';

const AdminButton = () => {
  const navigate = useNavigate();
  return (
    <div className={cn(settingsListCardCn)}>
      <button
        type="button"
        onClick={() => navigate('/admin')}
        className={cn(settingsListRowCn)}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
          <LayoutDashboard className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
        </span>
        <span className="min-w-0 flex-1 text-left font-medium leading-snug">Panel de Control</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
      </button>
    </div>
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
  const [showNewPassword, setShowNewPassword] = useState(false);
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
  /** Calorías y prote registradas hoy + vasos (hidratación) para barras de avance sutiles */
  const [todayMacroTotals, setTodayMacroTotals] = useState({ calories: 0, protein: 0, glasses: 0 });
  /** Tema de marca leído de profiles.theme ('default' | 'pink') */
  const [brandTheme, setBrandTheme] = useState<string>('default');
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [logoutWorking, setLogoutWorking] = useState(false);

  /** Recorte de avatar: preview local + archivo original conservado para futura subida HR. */
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const avatarOriginalDraftRef = useRef<File | null>(null);

  const endAvatarCropSession = useCallback(() => {
    avatarOriginalDraftRef.current = null;
    setAvatarCropOpen(false);
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const openAvatarCropFromFile = useCallback((file: File) => {
    avatarOriginalDraftRef.current = file;
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setAvatarCropOpen(true);
  }, []);

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

  const loadTodayMacroTotals = useCallback(async () => {
    if (!user) return;
    const day = todayLocalYMD();
    const { start, end } = localDayBoundsISO(day);
    const [{ data: feRows }, { data: nlRows }, { data: hyd }] = await Promise.all([
      supabase.from('food_entries').select('calories, protein').eq('user_id', user.id).eq('entry_date', day),
      supabase
        .from('nutrition_logs')
        .select('calories, protein')
        .eq('user_id', user.id)
        .gte('consumed_at', start)
        .lte('consumed_at', end),
      supabase.from('hydration_logs').select('glasses').eq('user_id', user.id).eq('log_date', day).maybeSingle(),
    ]);
    let calories = 0;
    let protein = 0;
    for (const r of feRows || []) {
      calories += Number((r as { calories: unknown }).calories ?? 0);
      protein += Number((r as { protein: unknown }).protein ?? 0);
    }
    for (const r of nlRows || []) {
      calories += Number((r as { calories: unknown }).calories ?? 0);
      protein += Number((r as { protein: unknown }).protein ?? 0);
    }
    setTodayMacroTotals({
      calories: Math.round(calories),
      protein: Math.round(protein),
      glasses: hyd?.glasses ?? 0,
    });
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    void loadTodayMacroTotals();
  }, [loadTodayMacroTotals]);

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

  const uploadAvatar = async (file: File): Promise<boolean> => {
    if (!user) return false;
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Error al subir imagen', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return false;
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
      return false;
    }
    setAvatarUrl(url);
    setUploadingAvatar(false);
    toast({ title: 'Foto actualizada' });
    return true;
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

  const newPasswordOk = passwordMeetsPolicy(newPassword);

  const changePassword = async () => {
    if (!newPasswordOk) {
      toast({
        title: 'Contraseña no válida',
        description: 'Revisá los requisitos debajo del campo.',
        variant: 'destructive',
      });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contraseña actualizada' });
    setNewPassword(''); setPasswordDialog(false);
  };

  const handleConfirmLogout = useCallback(async () => {
    setLogoutWorking(true);
    try {
      await signOut();
      setLogoutDialogOpen(false);
      navigate('/auth', { replace: true });
    } finally {
      setLogoutWorking(false);
    }
  }, [signOut, navigate]);

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
  const hydrationGlassGoal = hasData ? Math.max(8, Math.round((w * 35) / 250)) : 0;
  const weightDiff = w > 0 && tw > 0 ? (w - tw) : null;

  const handleAvatarCropApply = async (blob: Blob) => {
    const thumbnail = new File([blob], 'avatar.jpg', {
      type: blob.type.startsWith('image/') ? blob.type : 'image/jpeg',
    });
    const ok = await uploadAvatar(thumbnail);
    if (!ok) return;
    /* Futuro HR: usar `avatarOriginalDraftRef.current` antes de `endAvatarCropSession`
       para una segunda subida (`profiles.avatar_original_url`, bucket dedicado). */
    endAvatarCropSession();
  };

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const ageLabel = ageYears != null ? `${ageYears} años` : 'Completá tu fecha de nacimiento';
  const stepsProgressPct = stepGoal > 0 ? Math.min(100, Math.round((steps / stepGoal) * 100)) : 0;
  const kcalProgressPct = hasData && tdee > 0 ? Math.min(100, Math.round((todayMacroTotals.calories / tdee) * 100)) : 0;
  const proteinProgressPct = hasData && proteinGoal > 0 ? Math.min(100, Math.round((todayMacroTotals.protein / proteinGoal) * 100)) : 0;
  const hydrationProgressPct = hasData && hydrationGlassGoal > 0 ? Math.min(100, Math.round((todayMacroTotals.glasses / hydrationGlassGoal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-background px-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <PageScreenHeader
          title="Perfil"
          right={<ThemeSegmentedControl value={theme} onChange={setTheme} />}
        />

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
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
                  if (!file) return;
                  if (!file.type.startsWith('image/')) {
                    toast({
                      title: 'Archivo no válido',
                      description: 'Seleccioná una imagen (JPG, PNG, etc.).',
                      variant: 'destructive',
                    });
                    return;
                  }
                  setAvatarModalOpen(false);
                  openAvatarCropFromFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => { if (!uploadingAvatar) setAvatarModalOpen(true); }}
                className={cn(
                  'relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-accent',
                  'drop-shadow-none dark:drop-shadow-[0_0_8px_var(--brand-glow)]',
                )}
                aria-label="Cambiar foto de perfil"
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  : <User className="h-6 w-6 text-primary/85 dark:text-primary/90" />}
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
              <p className="text-lg font-semibold leading-tight text-zinc-900 dark:text-zinc-100">
                {fullName || 'Tu nombre'}
              </p>
              {/* ── Role badge ── */}
              <div className="mt-1">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    Admin 👑
                  </span>
                ) : isTester ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary">
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
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{ageLabel}</p>
            </div>
            <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={openEditProfile} aria-label="Editar perfil">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Banner Modo Rosita (solo para usuarios VIP) ── */}
        {brandTheme === 'pink' && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 dark:border-primary/30 dark:bg-primary/10">
            <Heart className="h-5 w-5 shrink-0 fill-primary text-primary" />
            <p className="text-sm font-semibold text-primary dark:text-primary">
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

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-none">
          <div className="flex items-center gap-4">
            <StepsRing steps={steps} goal={stepGoal} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                    Pasos hoy
                  </p>
                  <p className="text-sm font-semibold leading-tight tracking-tight text-zinc-800 dark:text-zinc-100">
                    {formatStepsHeaderDate()}
                  </p>
                  <div className="flex flex-wrap items-baseline gap-x-2 pt-1 text-[13px] leading-snug sm:gap-x-3 sm:text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Meta:{' '}
                      <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {stepGoal.toLocaleString()}
                      </span>
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-600 select-none" aria-hidden>
                      |
                    </span>
                    <span className="font-bold tabular-nums text-primary dark:text-primary">
                      {stepsProgressPct}%
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGoalDialog(true)}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/10 dark:text-primary"
                >
                  <Settings2 className="h-3 w-3" /> Meta
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={steps || ''}
                  placeholder="0"
                  onChange={e => updateSteps(parseInt(e.target.value) || 0)}
                  className={cn(profileFormInputClass, 'flex-1')}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => updateSteps(steps + 1000)}
                  className="h-10 shrink-0 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  <Plus className="mr-1 h-3 w-3" /> 1k
                </Button>
              </div>
            </div>
          </div>
        </div>

        {hasData && (
          <div className="rounded-2xl border border-zinc-200 bg-white px-2 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none sm:px-5">
            <div className="grid grid-cols-4 gap-x-2 sm:gap-x-8">
              <MiniStat icon={Activity} label="IMC" value={imc.toFixed(1)} />
              <MiniStat icon={Flame} label="kcal" value={tdee.toString()} progressPct={kcalProgressPct} />
              <MiniStat icon={Beef} label="Prot" value={`${proteinGoal}g`} progressPct={proteinProgressPct} />
              <MiniStat icon={Droplets} label="Agua" value={`${hydrationL}L`} progressPct={hydrationProgressPct} />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none sm:px-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Datos & objetivos
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            <LabeledNum label="Altura (cm)" value={height} onChange={setHeight} />
            <LabeledNum label="Peso (kg)" value={weight} onChange={setWeight} />
            <LabeledNum label="Peso meta (kg)" value={targetWeight} onChange={setTargetWeight} />
            <div className="col-span-2 space-y-1.5">
              <label htmlFor="profile-activity-level" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Nivel de actividad
              </label>
              <Select
                value={profileActivitySelectValue(activityLevel)}
                onValueChange={(v) => setActivityLevel(v === PROFILE_SELECT_UNSET ? '' : v)}
              >
                <SelectTrigger id="profile-activity-level" className={cn(profileFormSelectTriggerClass)}>
                  <SelectValue placeholder="Elegir nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROFILE_SELECT_UNSET} className="text-muted-foreground">
                    Elegir nivel
                  </SelectItem>
                  {ACTIVITY_LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label htmlFor="profile-fitness-goal" className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Objetivo fitness
              </label>
              <Select
                value={profileFitnessSelectValue(fitnessGoal)}
                onValueChange={(v) => setFitnessGoal(v === PROFILE_SELECT_UNSET ? '' : v)}
              >
                <SelectTrigger id="profile-fitness-goal" className={cn(profileFormSelectTriggerClass)}>
                  <SelectValue placeholder="Elegir objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROFILE_SELECT_UNSET} className="text-muted-foreground">
                    Elegir objetivo
                  </SelectItem>
                  {FITNESS_GOAL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {weightDiff !== null && (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Target className="h-3 w-3" />
              {weightDiff > 0 ? `Faltan ${weightDiff.toFixed(1)} kg` :
                weightDiff < 0 ? `${Math.abs(weightDiff).toFixed(1)} kg bajo la meta` : '¡En tu meta! 🎉'}
            </p>
          )}
          <Button
            onClick={saveProfile}
            disabled={saving}
            className="mt-5 w-full rounded-xl border-0 bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-md shadow-[0_10px_24px_var(--brand-glow-sm)] transition hover:bg-[color:var(--brand-hover)] hover:shadow-[0_12px_30px_var(--brand-glow)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:text-black"
          >
            <Save className="mr-2 h-4 w-4" /> {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>

        {isAdmin && user?.email === ADMIN_EMAIL && <AdminButton />}

        {/* ── Suscripción ── */}
        <div className={cn(settingsListCardCn)}>
          <button
            type="button"
            onClick={() => setFaqOpen(true)}
            className={cn(settingsListRowCn)}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12">
              <HelpCircle className="h-[18px] w-[18px] text-primary dark:text-primary" />
            </span>
            <span className="min-w-0 flex-1 text-left font-medium leading-snug">Suscripción y Ayuda</span>
            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
          </button>
        </div>

        {/* ── Ayuda e Información ── */}
        <div className={cn(settingsListCardCn)}>
          <div className={cn(settingsListSectionHeaderCn)}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Ayuda e Información
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <a
              href="https://wa.me/5493388414236?text=Hola,%20necesito%20ayuda%20con%20Pana%20Fitness"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(settingsListRowCn)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="#25D366" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 truncate text-left leading-snug">Soporte directo</span>
              <span className="mr-1 shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary dark:text-primary">
                WhatsApp
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => navigate('/terminos')}
              className={cn(settingsListRowCn)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <FileText className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" />
              </span>
              <span className="min-w-0 flex-1 text-left font-medium leading-snug">Términos y Condiciones</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Cuenta ── */}
        <div className={cn(settingsListCardCn)}>
          <div className={cn(settingsListSectionHeaderCn)}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Cuenta
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <button type="button" onClick={() => setPasswordDialog(true)} className={cn(settingsListRowCn)}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <Lock className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" />
              </span>
              <span className="min-w-0 flex-1 text-left font-medium leading-snug">Cambiar contraseña</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setLogoutDialogOpen(true)}
              className={cn(settingsListRowCn, 'text-red-600 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/40 dark:active:bg-red-950/60')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                <LogOut className="h-[18px] w-[18px] text-red-600 dark:text-red-400" />
              </span>
              <span className="min-w-0 flex-1 text-left font-semibold leading-snug">Cerrar sesión</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-red-400/80 dark:text-red-400/70" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <FAQBottomSheet open={faqOpen} onOpenChange={setFaqOpen} />

      <AvatarCropModal
        imageSrc={avatarCropSrc}
        open={avatarCropOpen}
        onCancel={endAvatarCropSession}
        onApply={handleAvatarCropApply}
      />

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
                className={cn(
                  'group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-accent transition-transform active:scale-95',
                  'drop-shadow-none dark:drop-shadow-[0_0_8px_var(--brand-glow)]',
                )}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center">
                      <User className="h-10 w-10 text-primary/85 dark:text-primary/90" />
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
        <DialogContent className={cn(modalSurfaceClass, 'text-center')}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold text-zinc-900 dark:text-zinc-50">
              ¡Bienvenido, Tester! 🎉
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2 pt-1">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <span className="text-3xl">∞</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Tenés <span className="font-semibold text-zinc-900 dark:text-zinc-100">acceso de por vida</span> a todas
              las funciones de Pana Fitness.
              <br />
              ¡Gracias por testear y ayudarnos a mejorar la app! 🙌
            </p>
            <Button
              className={cn('h-12', profileNeonButtonClass)}
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
        <DialogContent className={cn(modalSurfaceClass, 'text-center')}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold text-zinc-900 dark:text-zinc-50">
              ¡Premium activado! ✦
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pb-2 pt-1">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
              <span className="text-3xl">⭐</span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Tu suscripción{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Premium está activa por 30 días
              </span>
              .
              <br />
              Tenés acceso completo a todos los entrenamientos y funciones de la app.
            </p>
            <Button
              className="h-12 w-full rounded-xl border-0 bg-amber-500 font-bold text-zinc-950 shadow-md transition hover:bg-amber-600 active:scale-[0.98] dark:text-black"
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
        <DialogContent className={cn(modalSurfaceClass)}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Editar perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Nombre
              </label>
              <Input
                value={draftFirst}
                onChange={(e) => setDraftFirst(e.target.value)}
                className={editModalInputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Apellido
              </label>
              <Input
                value={draftLast}
                onChange={(e) => setDraftLast(e.target.value)}
                className={editModalInputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Fecha de nacimiento
              </label>
              <Input
                type="date"
                value={draftDob}
                onChange={(e) => setDraftDob(e.target.value)}
                className={editModalInputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Género
              </label>
              <div className="flex gap-2 rounded-2xl border border-zinc-200 bg-zinc-100/50 p-1 dark:border-zinc-700 dark:bg-zinc-900/50">
                {(
                  [
                    { value: 'male' as const, label: 'Masculino' },
                    { value: 'female' as const, label: 'Femenino' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraftGender(value)}
                    className={cn(
                      'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all',
                      draftGender === value
                        ? 'bg-primary text-primary-foreground shadow-md shadow-[0_8px_20px_var(--brand-glow-sm)] dark:text-black'
                        : 'text-zinc-500 hover:bg-white/60 dark:text-zinc-400 dark:hover:bg-zinc-800/80',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => void saveIdentity()}
              disabled={savingIdentity}
              className={cn('mt-1 h-12', profileNeonButtonClass)}
            >
              {savingIdentity ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className={cn(modalSurfaceClass)}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Meta diaria de pasos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              inputMode="numeric"
              value={draftGoal}
              onChange={(e) => setDraftGoal(e.target.value)}
              className={editModalInputClass}
            />
            <Button onClick={saveStepGoal} className={cn('h-12', profileNeonButtonClass)}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialog}
        onOpenChange={(open) => {
          setPasswordDialog(open);
          if (!open) setShowNewPassword(false);
        }}
      >
        <DialogContent className={cn(modalSurfaceClass)}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Nueva contraseña"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={cn(editModalInputClass, 'pr-12')}
                autoComplete="new-password"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordRequirementsList password={newPassword} />
            <Button
              onClick={() => void changePassword()}
              disabled={changingPassword || !newPasswordOk}
              className={cn('h-12', profileNeonButtonClass)}
            >
              {changingPassword ? 'Guardando...' : 'Actualizar contraseña'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={logoutDialogOpen}
        onOpenChange={(open) => {
          setLogoutDialogOpen(open);
          if (!open) setLogoutWorking(false);
        }}
      >
        <AlertDialogContent
          className={cn(
            'gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-100 sm:max-w-md',
            'duration-300',
          )}
        >
          <AlertDialogHeader className="space-y-3 sm:text-left">
            <AlertDialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              ¿Cerrar sesión?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              ¿Estás seguro de que quieres salir de tu cuenta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-0 sm:gap-2">
            <AlertDialogCancel
              type="button"
              disabled={logoutWorking}
              className={cn(
                'mt-0 h-11 rounded-xl border-zinc-300 bg-zinc-50 font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
              )}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={logoutWorking}
              variant={brandTheme === 'pink' ? 'default' : 'destructive'}
              className={cn(
                'h-11 rounded-xl border-0 px-5 text-sm font-bold shadow-md sm:min-w-[8.75rem]',
                brandTheme === 'pink' &&
                  'shadow-[0_8px_22px_var(--brand-glow-sm)] hover:bg-[color:var(--brand-hover)] hover:shadow-[0_10px_26px_var(--brand-glow)] dark:text-black',
              )}
              onClick={() => void handleConfirmLogout()}
            >
              {logoutWorking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saliendo…
                </>
              ) : (
                'Sí, salir'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const LabeledNum = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <label className="block text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
    <Input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={profileFormInputClass}
    />
  </div>
);

const MiniStat = ({
  icon: Icon,
  label,
  value,
  progressPct,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  /** Avance respecto del objetivo diario (% 0–100); si no viene, sin barra (ej. IMC). */
  progressPct?: number;
}) => (
  <div className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center sm:px-1">
    <Icon className="mb-2 h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" strokeWidth={2.25} aria-hidden />
    <p className="text-2xl font-bold tabular-nums leading-none tracking-tight text-zinc-900 dark:text-white">{value}</p>
    {progressPct !== undefined ? (
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance ${label}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
    ) : null}
    <p
      className={cn(
        'max-w-full text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400',
        progressPct !== undefined ? 'mt-1.5' : 'mt-2',
      )}
    >
      {label}
    </p>
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
