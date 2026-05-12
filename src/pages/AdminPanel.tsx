import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Ban, Crown, Search, Shield, Star, User, UserPlus, Users } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type DirectoryRow = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
  premium_until: string | null;
};

type SubStatus = 'trial' | 'premium' | 'lifetime' | 'expired';
type PremiumAction = 30 | 'lifetime' | 'revoke';

// ─── Helpers ───────────────────────────────────────────────────────────────

function subLabel(
  premiumUntil: string | null,
  registeredAt: string,
): { text: string; status: SubStatus } {
  const now = new Date();

  if (premiumUntil) {
    const until = new Date(premiumUntil);
    if (until > now) {
      if (until.getFullYear() >= 2049) return { text: 'Tester ∞', status: 'lifetime' };
      const d = until.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
      return { text: `Premium · ${d}`, status: 'premium' };
    }
    return { text: 'Expirado', status: 'expired' };
  }

  const reg = registeredAt ? new Date(registeredAt) : new Date();
  const trialEnd = new Date(reg.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (now < trialEnd) {
    const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { text: `Prueba · ${daysLeft}d`, status: 'trial' };
  }

  return { text: 'Expirado', status: 'expired' };
}

const STATUS_CLS: Record<SubStatus, string> = {
  trial: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  premium: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  lifetime: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
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

  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [actionTarget, setActionTarget] = useState<DirectoryRow | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_user_directory');
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as DirectoryRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadDirectory(); }, [loadDirectory]);

  // ── Actions ────────────────────────────────────────────────────────────

  const handleSetPremium = useCallback(async (row: DirectoryRow, action: PremiumAction) => {
    setActionTarget(null);
    setToggling((prev) => new Set([...prev, row.user_id]));

    let newPremiumUntil: string | null;
    if (action === 'revoke') {
      newPremiumUntil = null;
    } else if (action === 'lifetime') {
      newPremiumUntil = '2050-01-01T00:00:00Z';
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      newPremiumUntil = d.toISOString();
    }

    const { error: rpcError } = await supabase.rpc('set_user_premium', {
      target_user_id: row.user_id,
      new_premium_until: newPremiumUntil,
    });

    if (rpcError) {
      toast({ title: 'Error al actualizar', description: rpcError.message, variant: 'destructive' });
    } else {
      setRows((prev) =>
        prev.map((r) => (r.user_id === row.user_id ? { ...r, premium_until: newPremiumUntil } : r)),
      );
      const msg =
        action === 'revoke'
          ? 'Acceso revocado'
          : action === 'lifetime'
            ? 'Pase de por vida asignado'
            : '30 días asignados';
      toast({ title: msg, description: row.email });
    }

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(row.user_id);
      return next;
    });
  }, [toast]);

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
    () => rows.filter((r) => r.premium_until && new Date(r.premium_until) > new Date()).length,
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
            className="h-10 w-10 shrink-0 rounded-xl"
            onClick={() => navigate(-1)}
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-7 w-7 shrink-0 text-violet-500" />
            <h1 className="text-xl font-bold text-foreground">Panel de Control</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Directorio de usuarios · Suscripciones gestionadas por fecha de vencimiento.
          Hacé clic en el estado de un usuario para editar su acceso.
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
            <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              </div>
              {loading ? (
                <Skeleton className="mt-2 h-8 w-16 rounded-lg" />
              ) : (
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 rounded-xl border border-input bg-card pl-9 text-sm shadow-sm"
            aria-label="Filtrar usuarios"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
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
                  <TableHead className="w-36 pr-4 text-right">Estado</TableHead>
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
                    const { text, status } = subLabel(r.premium_until, r.registered_at);
                    const isBusy = toggling.has(r.user_id);

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
                        <TableCell className="pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => setActionTarget(r)}
                            disabled={isBusy}
                            title="Clic para editar suscripción"
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 disabled:opacity-50 ${STATUS_CLS[status]}`}
                          >
                            {isBusy ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : null}
                            {text}
                          </button>
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

      {/* ── Action Dialog ── */}
      <Dialog open={!!actionTarget} onOpenChange={(open) => { if (!open) setActionTarget(null); }}>
        <DialogContent className="rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Gestionar suscripción</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{actionTarget?.email}</span>
                {actionTarget && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      STATUS_CLS[subLabel(actionTarget.premium_until, actionTarget.registered_at).status]
                    }`}
                  >
                    {subLabel(actionTarget.premium_until, actionTarget.registered_at).text}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-2">
            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-3 rounded-xl bg-amber-500/10 font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
              onClick={() => actionTarget && void handleSetPremium(actionTarget, 30)}
            >
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              Dar 30 días
            </Button>

            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-3 rounded-xl bg-violet-500/10 font-semibold text-violet-700 hover:bg-violet-500/20 dark:text-violet-400"
              onClick={() => actionTarget && void handleSetPremium(actionTarget, 'lifetime')}
            >
              <Crown className="h-4 w-4 text-violet-500" />
              Pase de por vida (Tester)
            </Button>

            <Button
              variant="ghost"
              className="h-11 w-full justify-start gap-3 rounded-xl bg-red-500/10 font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-400"
              onClick={() => actionTarget && void handleSetPremium(actionTarget, 'revoke')}
            >
              <Ban className="h-4 w-4 text-red-500" />
              Revocar acceso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
