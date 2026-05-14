import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Palette, Search, Shield, Star, User, UserPlus, Users } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type DirectoryRow = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
  premium_until: string | null;
  theme: string;
  // subscription fields (supplemented after RPC)
  subscription_role: 'free' | 'premium' | 'tester' | null;
  is_admin: boolean;
  subscription_expires_at: string | null;
  notified_tester: boolean;
  notified_premium: boolean;
};

type SubStatus = 'admin' | 'tester' | 'premium' | 'trial' | 'expired';

// ─── Helpers ───────────────────────────────────────────────────────────────

function resolveStatus(row: DirectoryRow): { text: string; status: SubStatus } {
  if (row.is_admin) return { text: 'Admin 👑', status: 'admin' };

  const role = row.subscription_role ?? 'free';

  if (role === 'tester') return { text: 'Tester ∞', status: 'tester' };

  if (role === 'premium') {
    const raw = row.subscription_expires_at ?? row.premium_until;
    if (raw) {
      const until = new Date(raw);
      if (until > new Date()) {
        const d = until.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        return { text: `Premium · ${d}`, status: 'premium' };
      }
    }
    // premium role but expired → treat as expired
  }

  // legacy premium_until (role=free but date still set)
  if (row.premium_until) {
    const pu = new Date(row.premium_until);
    if (pu > new Date()) {
      const d = pu.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return { text: `Premium · ${d}`, status: 'premium' };
    }
  }

  const reg = row.registered_at ? new Date(row.registered_at) : new Date();
  const trialEnd = new Date(reg.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (new Date() < trialEnd) {
    const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return { text: `Prueba · ${daysLeft}d`, status: 'trial' };
  }

  return { text: 'Expirado', status: 'expired' };
}

const STATUS_CLS: Record<SubStatus, string> = {
  admin: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  tester: 'bg-[#39FF14]/15 text-emerald-700 dark:text-[#39FF14]',
  premium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  trial: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  expired: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const todayLocalYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const registeredYmdLocal = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Component ─────────────────────────────────────────────────────────────

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [themeTarget, setThemeTarget] = useState<DirectoryRow | null>(null);

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
      user_id:               extractId(r),
      email:                 (r.email               as string)  ?? '',
      first_name:            (r.first_name           as string)  ?? null,
      last_name:             (r.last_name            as string)  ?? null,
      avatar_url:            (r.avatar_url           as string)  ?? null,
      registered_at:         (r.registered_at        as string)  ?? '',
      premium_until:         (r.premium_until        as string)  ?? null,
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
        .select('user_id, subscription_role, subscription_expires_at, is_admin, notified_tester, notified_premium')
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
        };
        subMap[r.user_id] = {
          subscription_role:      (r.subscription_role as DirectoryRow['subscription_role']) ?? null,
          subscription_expires_at: r.subscription_expires_at ?? null,
          is_admin:               r.is_admin === true,
          notified_tester:        r.notified_tester === true,
          notified_premium:       r.notified_premium === true,
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
    [toast],
  );

  // ── Theme toggle ───────────────────────────────────────────────────────

  const handleToggleTheme = useCallback(
    async (row: DirectoryRow) => {
      setThemeTarget(null);
      setToggling((prev) => new Set([...prev, row.user_id]));
      const newTheme = row.theme === 'pink' ? 'default' : 'pink';
      const { error: rpcError } = await supabase.rpc('set_user_theme', {
        target_user_id: row.user_id,
        new_theme: newTheme,
      });
      if (rpcError) {
        toast({ title: 'Error al cambiar tema', description: rpcError.message, variant: 'destructive' });
      } else {
        setRows((prev) =>
          prev.map((r) => (r.user_id === row.user_id ? { ...r, theme: newTheme } : r)),
        );
        toast({
          title: newTheme === 'pink' ? '🌸 Modo Rosa VIP activado' : '🟢 Modo Normal restaurado',
          description: row.email,
        });
      }
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(row.user_id);
        return next;
      });
    },
    [toast],
  );

  // ── Derived ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').toLowerCase();
      return name.includes(q) || (r.email ?? '').toLowerCase().includes(q);
    });
  }, [rows, query]);

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
    <div className="min-h-screen bg-background px-4 pb-8 pt-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm transition-all duration-300 active:scale-90"
            onClick={() => navigate(-1)}
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-7 w-7 shrink-0 text-violet-500" />
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Panel de Control</h1>
          </div>
        </div>

        <p className="text-xs font-medium text-muted-foreground/60">
          Directorio de usuarios · Cambiá el rol desde el selector en cada fila.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { Icon: Users, color: 'text-violet-500', label: 'Totales', value: totalUsers },
              { Icon: UserPlus, color: 'text-emerald-500', label: 'Hoy', value: registeredToday },
              { Icon: Star, color: 'text-amber-500', label: 'Activos', value: activeCount },
            ] as const
          ).map(({ Icon, color, label, value }) => (
            <div key={label} className="rounded-2xl border border-border/40 bg-card/80 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${color} opacity-80`} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{label}</span>
              </div>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16 rounded-lg" />
              ) : (
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl border border-border/40 bg-card/80 pl-9 text-sm backdrop-blur-sm"
            aria-label="Filtrar usuarios"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14 pl-4">Foto</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Registro</TableHead>
                  <TableHead className="w-44 pr-4 text-right">Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {rows.length === 0 ? 'No hay usuarios.' : 'Sin resultados para tu búsqueda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const name =
                      [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
                    const dateLabel = r.registered_at
                      ? new Date(r.registered_at).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';
                    const { text, status } = resolveStatus(r);
                    const isBusy = toggling.has(r.user_id);
                    const isSelf = r.user_id === currentUser?.id;

                    return (
                      <TableRow key={r.user_id}>
                        <TableCell className="pl-4">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-accent">
                            {r.avatar_url ? (
                              <img src={r.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <User className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                            {r.email || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-muted-foreground sm:table-cell">
                          {r.email || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {dateLabel}
                        </TableCell>
                        <TableCell className="pr-2 text-right">
                          {/* Admin's own row: static badge, no self-edit */}
                          {isSelf ? (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLS[status]}`}
                            >
                              {text}
                            </span>
                          ) : isBusy ? (
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Guardando…
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {/* Role selector */}
                              <Select
                                value={r.subscription_role || 'free'}
                                onValueChange={(val) =>
                                  void handleSetRole(r, val as 'free' | 'premium' | 'tester')
                                }
                              >
                                <SelectTrigger className="h-8 w-28 rounded-xl border border-input bg-secondary text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="free">Free</SelectItem>
                                  <SelectItem value="premium">Premium</SelectItem>
                                  <SelectItem value="tester">Tester</SelectItem>
                                </SelectContent>
                              </Select>
                              {/* Theme toggle */}
                              <button
                                type="button"
                                title={r.theme === 'pink' ? 'Quitar Modo Rosa' : 'Activar Modo Rosa'}
                                onClick={() => setThemeTarget(r)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-xs transition hover:bg-accent"
                              >
                                <Palette className={`h-3.5 w-3.5 ${r.theme === 'pink' ? 'text-pink-500' : 'text-muted-foreground'}`} />
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Theme confirmation dialog ── */}
      <Dialog open={!!themeTarget} onOpenChange={(open) => { if (!open) setThemeTarget(null); }}>
        <DialogContent className="rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {themeTarget?.theme === 'pink' ? 'Quitar Modo Rosa VIP' : 'Activar Modo Rosa VIP 🌸'}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {themeTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Button
              variant="ghost"
              className={`h-11 w-full justify-start gap-3 rounded-xl font-semibold ${
                themeTarget?.theme === 'pink'
                  ? 'bg-zinc-500/10 text-zinc-600 hover:bg-zinc-500/20 dark:text-zinc-400'
                  : 'bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 dark:text-pink-400'
              }`}
              onClick={() => themeTarget && void handleToggleTheme(themeTarget)}
            >
              <Palette className={`h-4 w-4 ${themeTarget?.theme === 'pink' ? 'text-zinc-500' : 'text-pink-500'}`} />
              {themeTarget?.theme === 'pink' ? 'Quitar Modo Rosa VIP' : 'Activar Modo Rosa VIP 🌸'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
