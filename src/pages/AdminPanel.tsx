import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Shield, Search, User, Users, UserPlus } from 'lucide-react';

type DirectoryRow = {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  registered_at: string;
};

const todayLocalYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const registeredYmdLocal = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_user_directory');
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as DirectoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ').toLowerCase();
      const email = (r.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [rows, query]);

  const todayYmd = todayLocalYmd();
  const totalUsers = rows.length;
  const registeredToday = useMemo(
    () => rows.filter((r) => registeredYmdLocal(r.registered_at) === todayYmd).length,
    [rows, todayYmd],
  );

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-6">
      <div className="mx-auto max-w-4xl space-y-6">
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
          Listado de usuarios (fase de prueba). Los datos provienen de la función RPC{' '}
          <span className="font-mono text-foreground">admin_user_directory</span>.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="text-xs font-medium uppercase tracking-wide">Usuarios totales</span>
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16 rounded-lg" />
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{totalUsers}</p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserPlus className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-xs font-medium uppercase tracking-wide">Registrados hoy</span>
            </div>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16 rounded-lg" />
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{registeredToday}</p>
            )}
          </div>
        </div>

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

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14 pl-4">Foto</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="whitespace-nowrap">Fecha de registro</TableHead>
                  <TableHead className="w-24 text-right pr-4">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      {rows.length === 0 ? 'No hay usuarios para mostrar.' : 'Ningún resultado para tu búsqueda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—';
                    const dateLabel = r.registered_at
                      ? new Date(r.registered_at).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—';
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
                          <div className="mt-0.5 text-xs text-muted-foreground sm:hidden">{r.email || '—'}</div>
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-muted-foreground sm:table-cell">
                          {r.email || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{dateLabel}</TableCell>
                        <TableCell className="pr-4 text-right text-xs text-muted-foreground">—</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
