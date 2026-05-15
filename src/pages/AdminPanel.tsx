import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { applyBrandTheme } from '@/lib/brandTheme';
import {
  ArrowDownUp,
  ArrowLeft,
  Check,
  ChevronDown,
  Crown,
  Palette,
  Search,
  Shield,
  Sparkles,
  Star,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  ADMIN_ONLINE_WINDOW_MS,
  compareLastActive,
  formatLastActiveLabel,
  isActivityWithinAge,
  lastActiveDotTone,
} from '@/lib/lastActivityLabel';

// ─── Types ─────────────────────────────────────────────────────────────────

type DirectoryRow = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
  last_active_at: string | null;
  premium_until: string | null;
  theme: string;
  // subscription fields (supplemented after RPC)
  subscription_role: 'free' | 'premium' | 'tester' | null;
  is_admin: boolean;
  subscription_expires_at: string | null;
  notified_tester: boolean;
  notified_premium: boolean;
};

type SubRole = 'free' | 'premium' | 'tester';

const ROLE_META: Record<
  SubRole,
  { label: string; short: string; icon: typeof User; triggerClass: string; itemClass: string }
> = {
  free: {
    label: 'Free',
    short: 'Free',
    icon: User,
    triggerClass:
      'border-zinc-300/80 bg-zinc-500/10 text-zinc-800 dark:border-white/15 dark:bg-zinc-800/60 dark:text-zinc-200',
    itemClass: 'text-zinc-800 dark:text-zinc-200',
  },
  premium: {
    label: 'Premium',
    short: 'Premium',
    icon: Star,
    triggerClass:
      'border-amber-500/40 bg-yellow-500/10 text-yellow-800 dark:border-amber-500/45 dark:bg-amber-500/12 dark:text-amber-300',
    itemClass: 'text-amber-900 dark:text-amber-200',
  },
  tester: {
    label: 'Tester',
    short: 'Tester',
    icon: Sparkles,
    triggerClass:
      'border-primary/45 bg-primary/12 text-primary dark:border-primary/50 dark:bg-primary/12 dark:text-primary',
    itemClass: 'text-primary dark:text-primary',
  },
};

function RoleDropdown({
  row,
  disabled,
  current,
  onSelect,
}: {
  row: DirectoryRow;
  disabled: boolean;
  current: SubRole;
  onSelect: (r: DirectoryRow, role: SubRole) => void;
}) {
  const meta = ROLE_META[current];
  const Icon = meta.icon;
  const hints: Record<SubRole, string> = {
    free: 'Sin suscripción',
    premium: '+30 días al asignar',
    tester: 'Acceso ilimitado QA',
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex min-w-[8rem] items-center justify-between gap-2 rounded-full border px-3 py-2 text-xs font-bold shadow-sm transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
            meta.triggerClass,
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            {meta.short}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[100] w-64 rounded-xl border border-zinc-200/90 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-zinc-900"
      >
        {(['free', 'premium', 'tester'] as const).map((role) => {
          const m = ROLE_META[role];
          const I = m.icon;
          const selected = current === role;
          return (
            <DropdownMenuItem
              key={role}
              onClick={() => {
                if (!selected) onSelect(row, role);
              }}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-semibold focus:bg-zinc-100 data-[highlighted]:bg-zinc-100 dark:focus:bg-zinc-800 dark:data-[highlighted]:bg-zinc-800',
                selected && 'bg-zinc-50 dark:bg-zinc-800/80',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                  m.triggerClass,
                )}
              >
                <I className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <div className={cn('leading-tight', m.itemClass)}>{m.label}</div>
                <div className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                  {hints[role]}
                </div>
              </div>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const todayLocalYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const registeredYmdLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function LastActivityCell({ iso, refreshTick }: { iso: string | null; refreshTick: number }) {
  void refreshTick;
  const now = new Date();

  const isOnlineNow = isActivityWithinAge(iso, ADMIN_ONLINE_WINDOW_MS, now);

  const tone = lastActiveDotTone(iso);
  const dotClass =
    tone === 'live'
      ? 'bg-emerald-500 shadow-[0_0_7px_rgba(34,197,94,0.45)]'
      : tone === 'stale'
        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.35)]'
        : tone === 'idle'
          ? 'bg-zinc-400 dark:bg-zinc-500'
          : 'bg-zinc-400/45 dark:bg-zinc-600';

  const title = isOnlineNow
    ? 'Usando la app en los últimos 3 minutos'
    : tone === 'live'
      ? 'Activo en las últimas 24 h'
      : tone === 'stale'
        ? 'Sin usar la app 7 días o más'
        : tone === 'idle'
          ? 'Activo entre hace 1 y 7 días'
          : 'Sin marca de última actividad';

  return (
    <div className="flex min-w-0 items-start gap-2">
      {isOnlineNow ? (
        <span
          className="min-w-0 select-none tabular-nums tracking-tight break-words font-semibold text-xs leading-snug text-lime-500 drop-shadow-[0_0_10px_rgba(163,230,53,0.75)] dark:text-lime-200 dark:drop-shadow-[0_0_12px_rgba(190,242,100,0.55)]"
          title={title}
        >
          ● En Línea
        </span>
      ) : (
        <>
          <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClass)} title={title} aria-hidden />
          <span className="min-w-0 break-words text-xs leading-snug text-zinc-600 dark:text-zinc-400">
            {formatLastActiveLabel(iso)}
          </span>
        </>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, refreshIsAdmin } = useAuth();

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [themeTarget, setThemeTarget] = useState<DirectoryRow | null>(null);
  const [pendingSelfAdminRole, setPendingSelfAdminRole] = useState<{
    row: DirectoryRow;
    newRole: SubRole;
  } | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<DirectoryRow | null>(null);
  const [deleteAccountDoing, setDeleteAccountDoing] = useState(false);
  const [activitySort, setActivitySort] = useState<'default' | 'recent' | 'oldest'>('default');
  /** Sin refetch RPC: re-render cada 1 min y al abrir para recalcular relativo / «En Línea». */
  const [activityRefreshTick, setActivityRefreshTick] = useState(0);

  // ── Data ───────────────────────────────────────────────────────────────

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Base directory via RPC (runs SECURITY DEFINER — bypasses RLS)
    const { data: dirData, error: rpcError } = await supabase.rpc('admin_user_directory');
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const rawRows = (dirData ?? []) as Record<string, unknown>[];

    // Log the raw RPC shape once so we can verify which fields it returns
    if (rawRows.length > 0) {
      console.log('🔍 admin_user_directory keys:', Object.keys(rawRows[0]));
      console.log('🔍 admin_user_directory first row:', rawRows[0]);
    }

    // Build rows directly from RPC data.
    // The RPC may or may not include subscription_role — we capture it if present.
    // ID can be 'user_id' or 'id' depending on how the function was written.
    const extractId = (r: Record<string, unknown>): string =>
      (r.user_id as string) || (r.id as string) || '';

    const merged: DirectoryRow[] = rawRows.map((r) => ({
      user_id: extractId(r),
      email: (r.email as string) ?? '',
      first_name: (r.first_name as string) ?? null,
      last_name: (r.last_name as string) ?? null,
      avatar_url: (r.avatar_url as string) ?? null,
      registered_at: (r.registered_at as string) ?? '',
      last_active_at: (typeof r.last_active_at === 'string' ? r.last_active_at : null) ?? null,
      premium_until: (r.premium_until as string) ?? null,
      theme:                 (r.theme                as string)  ?? 'default',
      // Subscription fields — present when admin_user_directory includes them
      subscription_role:     ((r.subscription_role   as string)  ?? null) as DirectoryRow['subscription_role'],
      subscription_expires_at: (r.subscription_expires_at as string) ?? null,
      is_admin:              (r.is_admin             as boolean) ?? false,
      notified_tester:       (r.notified_tester      as boolean) ?? false,
      notified_premium:      (r.notified_premium     as boolean) ?? false,
    }));

    // 2. If admin_user_directory does NOT include subscription_role (all null),
    //    try a direct profiles query as fallback.
    //    NOTE: this only works if RLS has a policy allowing admin to read all rows.
    //    If it returns 0 rows or only the admin's own row, you need to add the
    //    subscription fields to admin_user_directory in Supabase instead.
    const rpcIncludesSubs = rawRows.some((r) => r.subscription_role != null);
    if (!rpcIncludesSubs && merged.length > 0) {
      console.warn('⚠️ admin_user_directory no incluye subscription_role. Intentando query directa a profiles...');

      const userIds = merged.map((r) => r.user_id).filter(Boolean);
      const { data: subData, error: subError } = await supabase
        .from('profiles')
        .select(
          'user_id, subscription_role, subscription_expires_at, is_admin, notified_tester, notified_premium, last_active_at',
        )
        .in('user_id', userIds);

      if (subError) {
        console.error('❌ profiles query error (probable causa: RLS bloqueó el acceso):', subError);
      } else {
        console.log(`✅ profiles query devolvió ${(subData ?? []).length} de ${userIds.length} filas`);
      }

      const subMap: Record<string, Partial<DirectoryRow>> = {};
      for (const row of subData ?? []) {
        const r = row as {
          user_id: string;
          subscription_role: string | null;
          subscription_expires_at: string | null;
          is_admin: boolean | null;
          notified_tester: boolean | null;
          notified_premium: boolean | null;
          last_active_at: string | null;
        };
        subMap[r.user_id] = {
          subscription_role: (r.subscription_role as DirectoryRow['subscription_role']) ?? null,
          subscription_expires_at: r.subscription_expires_at ?? null,
          is_admin: r.is_admin === true,
          notified_tester: r.notified_tester === true,
          notified_premium: r.notified_premium === true,
          last_active_at: r.last_active_at ?? null,
        };
      }

      for (const row of merged) {
        if (subMap[row.user_id]) {
          Object.assign(row, subMap[row.user_id]);
        }
      }
    }

    console.log('📋 Roles cargados:', merged.map((r) => ({ email: r.email, role: r.subscription_role })));

    setRows(merged);
    setLoading(false);
  }, []);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);

  useEffect(() => {
    const pulse = () => setActivityRefreshTick((n) => n + 1);
    pulse();
    const id = window.setInterval(pulse, 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Role change ────────────────────────────────────────────────────────

  const handleSetRole = useCallback(
    async (row: DirectoryRow, newRole: 'free' | 'premium' | 'tester') => {
      setToggling((prev) => new Set([...prev, row.user_id]));

      const expiresAt =
        newRole === 'premium'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      try {
        const targetId = row.user_id;
        console.log('🚀 Enviando ID a Supabase:', targetId, 'para el rol:', newRole);

        if (!targetId) {
          throw new Error('user_id está vacío — verifica el campo que devuelve admin_user_directory');
        }

        const { error: rpcError } = await supabase.rpc('set_user_subscription_role', {
          target_user_id: targetId,
          new_role: newRole,
          new_expires_at: expiresAt,
        });

        if (rpcError) throw rpcError;

        if (currentUser?.id === row.user_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('theme')
            .eq('user_id', row.user_id)
            .maybeSingle();
          applyBrandTheme(prof?.theme === 'pink' ? 'pink' : 'default');
          await refreshIsAdmin();
          void loadDirectory();
        }

        setRows((prev) =>
          prev.map((r) =>
            r.user_id === row.user_id
              ? {
                  ...r,
                  subscription_role: newRole,
                  subscription_expires_at: expiresAt,
                  notified_premium: newRole === 'premium' ? false : r.notified_premium,
                  notified_tester: newRole === 'tester' ? false : r.notified_tester,
                }
              : r,
          ),
        );

        const labels: Record<string, string> = {
          free: 'Rol cambiado a Free',
          premium: '30 días Premium asignados',
          tester: 'Acceso Tester ∞ activado',
        };
        toast({ title: labels[newRole], description: row.email });
      } catch (err) {
        console.error('Error de Supabase RPC:', err);
        const msg =
          err != null && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : typeof err === 'string'
              ? err
              : 'Error desconocido al actualizar';
        toast({
          title: 'Error al actualizar rol',
          description: msg,
          variant: 'destructive',
        });
      }

      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(row.user_id);
        return next;
      });
    },
    [toast, currentUser?.id, refreshIsAdmin, loadDirectory],
  );

  const requestRoleChange = useCallback(
    (row: DirectoryRow, newRole: SubRole) => {
      const isSelf = row.user_id === currentUser?.id;
      const current = (row.subscription_role || 'free') as SubRole;
      if (isSelf && row.is_admin && newRole !== current) {
        setPendingSelfAdminRole({ row, newRole });
        return;
      }
      void handleSetRole(row, newRole);
    },
    [currentUser?.id, handleSetRole],
  );

  // ── Theme toggle ───────────────────────────────────────────────────────

  const handleConfirmDeleteAccount = useCallback(async () => {
    const row = deleteAccountTarget;
    if (!row?.user_id || !currentUser) return;
    setDeleteAccountDoing(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
      }>('admin-delete-user', { body: { target_user_id: row.user_id } });

      if (fnErr) {
        let msg = fnErr.message;
        const ctx = (fnErr as { context?: Response }).context;
        if (ctx) {
          try {
            const j = (await ctx.clone().json()) as { error?: string };
            if (typeof j?.error === 'string') msg = j.error;
          } catch {
            /* keep Supabase message */
          }
        }
        throw new Error(msg);
      }

      if (data?.error) {
        throw new Error(data.error);
      }
      if (!data?.ok) {
        throw new Error('La eliminación no se completó. Revisa que la función esté desplegada.');
      }

      setRows((prev) => prev.filter((r) => r.user_id !== row.user_id));
      setDeleteAccountTarget(null);
      toast({
        title: 'Cuenta eliminada',
        description: row.email ?? row.user_id,
      });
      void loadDirectory();
    } catch (err) {
      const msg =
        err != null && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'No se pudo eliminar la cuenta';
      toast({ title: 'Error al eliminar', description: msg, variant: 'destructive' });
    } finally {
      setDeleteAccountDoing(false);
    }
  }, [deleteAccountTarget, currentUser, toast, loadDirectory]);

  const handleToggleTheme = useCallback(
    async (row: DirectoryRow) => {
      setThemeTarget(null);
      setToggling((prev) => new Set([...prev, row.user_id]));
      const newTheme = row.theme === 'pink' ? 'default' : 'pink';
      try {
        const { error: rpcError } = await supabase.rpc('set_user_theme', {
          target_user_id: row.user_id,
          new_theme: newTheme,
        });
        if (rpcError) throw rpcError;

        setRows((prev) =>
          prev.map((r) => (r.user_id === row.user_id ? { ...r, theme: newTheme } : r)),
        );
        if (row.user_id === currentUser?.id) {
          applyBrandTheme(newTheme === 'pink' ? 'pink' : 'default');
        }
        toast({
          title: newTheme === 'pink' ? '🌸 Modo Rosa VIP activado' : '🟢 Modo Normal restaurado',
          description: row.email,
        });
      } catch (err) {
        const msg =
          err != null && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : typeof err === 'string'
              ? err
              : 'No se pudo actualizar el tema';
        toast({ title: 'Error al cambiar tema', description: msg, variant: 'destructive' });
      } finally {
        setToggling((prev) => {
          const next = new Set(prev);
          next.delete(row.user_id);
          return next;
        });
      }
    },
    [toast, currentUser?.id],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || (r.email ?? '').toLowerCase().includes(q);
    });
  }, [rows, query]);

  const sortedMembers = useMemo(() => {
    if (activitySort === 'default') return filtered;
    const dir = activitySort === 'recent' ? ('recent' as const) : ('oldest' as const);
    return [...filtered].sort((a, b) => compareLastActive(a.last_active_at, b.last_active_at, dir));
  }, [filtered, activitySort]);

  const todayYmd = todayLocalYmd();
  const totalUsers = rows.length;
  const registeredToday = useMemo(
    () => rows.filter((r) => registeredYmdLocal(r.registered_at) === todayYmd).length,
    [rows, todayYmd],
  );
  const activeCount = useMemo(
    () =>
      rows.filter((r) => {
        if (r.is_admin) return true;
        const role = r.subscription_role;
        if (role === 'tester') return true;
        if (role === 'premium' && r.subscription_expires_at) {
          return new Date(r.subscription_expires_at) > new Date();
        }
        // legacy
        if (r.premium_until && new Date(r.premium_until) > new Date()) return true;
        return false;
      }).length,
    [rows],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'min-h-screen bg-white px-4 pb-8 pt-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50',
        "[html[data-brand='pink']_&]:bg-gradient-to-b [html[data-brand='pink']_&]:from-zinc-950 [html[data-brand='pink']_&]:to-zinc-900",
        "dark:[html[data-brand='pink']_&]:from-zinc-950 dark:[html[data-brand='pink']_&]:to-zinc-900",
      )}
    >
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-zinc-200/80 bg-zinc-50 transition-all duration-300 active:scale-90 dark:border-white/10 dark:bg-zinc-900/80"
            onClick={() => navigate(-1)}
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-7 w-7 shrink-0 text-primary" />
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de Control</h1>
          </div>
        </div>

        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Directorio de usuarios · Cambiá el rol desde el menú en cada fila.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {(
            [
              { Icon: Users, label: 'Totales', value: totalUsers },
              { Icon: UserPlus, label: 'Hoy', value: registeredToday },
              { Icon: Star, label: 'Activos', value: activeCount },
            ] as const
          ).map(({ Icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-md shadow-zinc-900/5 dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-black/40 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {label}
                </span>
              </div>
              {loading ? (
                <Skeleton className="mt-3 h-9 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              ) : (
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-white">
                  {value}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <Input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-full border-zinc-200/90 bg-zinc-100 pl-11 pr-4 text-sm text-zinc-900 shadow-inner shadow-zinc-900/5 placeholder:text-zinc-400 focus-visible:ring-primary/30 dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            aria-label="Filtrar usuarios"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Directorio — filas tipo tarjeta */}
        <div>
          <p className="mb-2 hidden text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:grid sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_6.75rem_minmax(0,12.5rem)_auto] sm:gap-3 sm:px-4 dark:text-zinc-400">
            <span />
            <span>Usuario</span>
            <span className="min-w-0 truncate">Email</span>
            <span>Alta</span>
            <span className="min-w-0">
              <button
                type="button"
                onClick={() =>
                  setActivitySort((prev) =>
                    prev === 'default' ? 'recent' : prev === 'recent' ? 'oldest' : 'default',
                  )
                }
                className="inline-flex w-full items-center gap-1 rounded-lg px-0.5 py-0.5 text-left uppercase text-primary transition hover:bg-primary/10"
                aria-label={`Ordenar por última actividad${activitySort === 'recent' ? ' (recientes primero)' : activitySort === 'oldest' ? ' (más tiempo sin usar primero)' : ''}`}
              >
                Actividad
                <ArrowDownUp className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              </button>
              {activitySort !== 'default' ? (
                <span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-zinc-400">
                  {activitySort === 'recent' ? 'Primero últimos activos' : 'Primero llevan más sin entrar'}
                </span>
              ) : (
                <span className="mt-1 block text-[9px] font-normal normal-case tracking-normal text-zinc-400">
                  Tap para ordenar
                </span>
              )}
            </span>
            <span className="text-right">Acciones</span>
          </p>
          <div className="space-y-2.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-2 dark:border-white/10 dark:bg-zinc-900/40">
            {loading ? (
              <div className="space-y-3 p-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                ))}
              </div>
            ) : sortedMembers.length === 0 ? (
              <div className="py-14 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {rows.length === 0 ? 'No hay usuarios.' : 'Sin resultados para tu búsqueda.'}
              </div>
            ) : (
              sortedMembers.map((r) => {
                const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
                const dateLabel = r.registered_at
                  ? new Date(r.registered_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—';
                const isBusy = toggling.has(r.user_id);
                const currentRole = (r.subscription_role || 'free') as SubRole;
                const canOfferAccountDelete =
                  Boolean(r.user_id) &&
                  r.user_id !== currentUser?.id &&
                  !r.is_admin;

                return (
                  <div
                    key={r.user_id}
                    className="rounded-2xl border border-transparent px-4 py-4 transition-colors hover:border-zinc-200/80 hover:bg-white dark:hover:border-white/10 dark:hover:bg-zinc-800/50 sm:py-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
                      <div className="flex items-start gap-3 sm:items-center">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-zinc-100 dark:bg-zinc-800">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-zinc-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 sm:hidden">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
                          <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{r.email || '—'}</div>
                          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">Alta {dateLabel}</div>
                          <div className="mt-3 sm:hidden">
                            <LastActivityCell iso={r.last_active_at} refreshTick={activityRefreshTick} />
                          </div>
                        </div>
                      </div>

                      <div className="hidden min-w-0 flex-1 sm:block">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{name}</div>
                      </div>
                      <div className="hidden min-w-0 max-w-[220px] truncate text-sm text-zinc-600 dark:text-zinc-400 sm:block">
                        {r.email || '—'}
                      </div>
                      <div className="hidden whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400 sm:block">
                        {dateLabel}
                      </div>
                      <div className="hidden min-w-0 sm:block lg:max-w-[230px]">
                        <LastActivityCell iso={r.last_active_at} refreshTick={activityRefreshTick} />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto sm:flex-nowrap">
                        {isBusy ? (
                          <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Guardando…
                          </span>
                        ) : r.is_admin ? (
                          <>
                            <Badge
                              variant="outline"
                              role="status"
                              aria-label="Administrador"
                              className={cn(
                                'pointer-events-none min-w-[8rem] justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold shadow-none',
                                'border-blue-500/35 bg-blue-500/10 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300',
                              )}
                            >
                              <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Admin
                            </Badge>
                            <button
                              type="button"
                              title={r.theme === 'pink' ? 'Quitar Modo Rosa' : 'Activar Modo Rosa'}
                              onClick={() => setThemeTarget(r)}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-xs shadow-sm transition hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            >
                              <Palette
                                className={`h-4 w-4 ${r.theme === 'pink' ? 'text-primary' : 'text-zinc-400'}`}
                              />
                            </button>
                            {canOfferAccountDelete ? (
                              <button
                                type="button"
                                title="Eliminar cuenta permanentemente"
                                disabled={isBusy || deleteAccountDoing}
                                onClick={() => setDeleteAccountTarget(r)}
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-white text-red-500 shadow-sm transition hover:border-red-500/40 hover:bg-red-500/[0.07] disabled:opacity-50 dark:border-red-500/30 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-500/15',
                                  "[html[data-brand='pink']_&]:border-rose-500/35 [html[data-brand='pink']_&]:text-rose-400 [html[data-brand='pink']_&]:hover:bg-rose-500/10 dark:[html[data-brand='pink']_&]:text-rose-300",
                                )}
                                aria-label="Eliminar cuenta de usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <RoleDropdown
                              row={r}
                              disabled={isBusy}
                              current={currentRole}
                              onSelect={(row2, role) => requestRoleChange(row2, role)}
                            />
                            <button
                              type="button"
                              title={r.theme === 'pink' ? 'Quitar Modo Rosa' : 'Activar Modo Rosa'}
                              onClick={() => setThemeTarget(r)}
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200/90 bg-white text-xs shadow-sm transition hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            >
                              <Palette
                                className={`h-4 w-4 ${r.theme === 'pink' ? 'text-primary' : 'text-zinc-400'}`}
                              />
                            </button>
                            {canOfferAccountDelete ? (
                              <button
                                type="button"
                                title="Eliminar cuenta permanentemente"
                                disabled={isBusy || deleteAccountDoing}
                                onClick={() => setDeleteAccountTarget(r)}
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-white text-red-500 shadow-sm transition hover:border-red-500/40 hover:bg-red-500/[0.07] disabled:opacity-50 dark:border-red-500/30 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-red-500/15',
                                  "[html[data-brand='pink']_&]:border-rose-500/35 [html[data-brand='pink']_&]:text-rose-400 [html[data-brand='pink']_&]:hover:bg-rose-500/10 dark:[html[data-brand='pink']_&]:text-rose-300",
                                )}
                                aria-label="Eliminar cuenta de usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Theme confirmation dialog ── */}
      <Dialog open={!!themeTarget} onOpenChange={(open) => { if (!open) setThemeTarget(null); }}>
        <DialogContent className={cn(
          'rounded-2xl border-zinc-200/80 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100',
          "[html[data-brand='pink']_&]:border-pink-800/40 [html[data-brand='pink']_&]:bg-zinc-900 [html[data-brand='pink']_&]:text-pink-50",
        )}>
          <DialogHeader>
            <DialogTitle>
              {themeTarget?.theme === 'pink' ? 'Quitar Modo Rosa VIP' : 'Activar Modo Rosa VIP 🌸'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400">
              {themeTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Button
              variant="ghost"
              className={`h-11 w-full justify-start gap-3 rounded-xl font-semibold ${
                themeTarget?.theme === 'pink'
                  ? 'bg-zinc-500/10 text-zinc-600 hover:bg-zinc-500/20 dark:text-zinc-400'
                  : 'bg-primary/10 text-primary hover:bg-primary/20 dark:text-primary'
              }`}
              onClick={() => themeTarget && void handleToggleTheme(themeTarget)}
            >
              <Palette className={`h-4 w-4 ${themeTarget?.theme === 'pink' ? 'text-zinc-500' : 'text-primary'}`} />
              {themeTarget?.theme === 'pink' ? 'Quitar Modo Rosa VIP' : 'Activar Modo Rosa VIP 🌸'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteAccountTarget}
        onOpenChange={(open) => {
          if (!open && !deleteAccountDoing) setDeleteAccountTarget(null);
        }}
      >
        <AlertDialogContent
          className={cn(
            'rounded-2xl border-zinc-200/80 bg-white dark:border-white/10 dark:bg-zinc-900',
            "[html[data-brand='pink']_&]:border-pink-800/40 [html[data-brand='pink']_&]:bg-zinc-900",
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="sr-only">Eliminar cuenta</AlertDialogTitle>
            <AlertDialogDescription className={cn(
              'text-sm font-medium leading-relaxed text-zinc-700 dark:text-zinc-200',
              "[html[data-brand='pink']_&]:text-pink-50/95",
            )}>
              ¿Eliminar cuenta permanentemente? Esta acción no se puede deshacer y borrará todos los entrenamientos,
              registros y acceso del usuario.
              {deleteAccountTarget?.email ? (
                <span className="mt-3 block rounded-lg bg-zinc-100 px-3 py-2 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:[html[data-brand='pink']_&]:bg-zinc-800/90 dark:[html[data-brand='pink']_&]:text-pink-100">
                  {deleteAccountTarget.email}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={cn(
                'rounded-xl border-zinc-200 dark:border-white/15',
                "[html[data-brand='pink']_&]:border-pink-800/35 [html[data-brand='pink']_&]:text-pink-100",
              )}
              disabled={deleteAccountDoing}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAccountDoing}
              className={cn(
                'rounded-xl bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500',
                "[html[data-brand='pink']_&]:bg-rose-600 [html[data-brand='pink']_&]:hover:bg-rose-500",
              )}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDeleteAccount();
              }}
            >
              {deleteAccountDoing ? 'Eliminando…' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingSelfAdminRole}
        onOpenChange={(open) => {
          if (!open) setPendingSelfAdminRole(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl border-zinc-200/80 bg-white dark:border-white/10 dark:bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-900 dark:text-zinc-50">Cambiar tu rol</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
              ¿Estás seguro? Perderás el acceso al Panel de Control si dejas de ser Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              onClick={() => {
                if (!pendingSelfAdminRole) return;
                const { row, newRole } = pendingSelfAdminRole;
                setPendingSelfAdminRole(null);
                void handleSetRole(row, newRole);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
