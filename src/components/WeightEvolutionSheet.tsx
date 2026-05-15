import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MoreHorizontal, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useBrandColorHex } from '@/hooks/useBrandColorHex';
import { useTheme } from '@/hooks/useTheme';
import { syncProfileWeightFromLogs } from '@/lib/weightProfileSync';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type WeightLogRow = Tables<'weight_logs'>;

const todayIsoDate = () => new Date().toISOString().split('T')[0];

function parseWeightInput(raw: string): number | null {
  const t = String(raw).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || n >= 700) return null;
  return Math.round(n * 100) / 100;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  onSynced?: () => void;
};

export function WeightEvolutionSheet({ open, onOpenChange, userId, onSynced }: Props) {
  const { toast } = useToast();
  const { resolved } = useTheme();
  const brandHex = useBrandColorHex();
  const chartAxisColor = resolved === 'dark' ? '#a1a1aa' : '#71717a';
  const chartGridColor = resolved === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const [rows, setRows] = useState<WeightLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [draftDate, setDraftDate] = useState(todayIsoDate());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WeightLogRow | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: 'Error al cargar peso', description: error.message, variant: 'destructive' });
      setRows([]);
      return;
    }
    setRows((data ?? []) as WeightLogRow[]);
  }, [userId, toast]);

  useEffect(() => {
    if (open && userId) void load();
  }, [open, userId, load]);

  const chartData = useMemo(() => {
    const asc = [...rows].sort((a, b) => {
      const ld = a.log_date.localeCompare(b.log_date);
      if (ld !== 0) return ld;
      return a.created_at.localeCompare(b.created_at);
    });
    return asc.map((r) => ({
      id: r.id,
      w: Number(r.weight),
      tick: format(parseISO(r.log_date), 'd MMM', { locale: es }),
      logDate: r.log_date,
    }));
  }, [rows]);

  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const vals = chartData.map((d) => d.w);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max(1, (hi - lo) * 0.15 || 1);
    return [Math.max(0, lo - pad), hi + pad];
  }, [chartData]);

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setDraftWeight('');
    setDraftDate(todayIsoDate());
    setFormOpen(true);
  };

  const openEdit = (row: WeightLogRow) => {
    setFormMode('edit');
    setEditingId(row.id);
    setDraftWeight(String(row.weight).replace('.', ','));
    setDraftDate(row.log_date);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!userId) return;
    const w = parseWeightInput(draftWeight);
    if (!w) {
      toast({ title: 'Peso no válido', description: 'Ingresá un número entre 0 y 700 kg.', variant: 'destructive' });
      return;
    }
    if (!draftDate) {
      toast({ title: 'Elegí una fecha', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (formMode === 'add') {
      const { error } = await supabase.from('weight_logs').insert({
        user_id: userId,
        weight: w,
        log_date: draftDate,
      });
      setSaving(false);
      if (error) {
        toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
        return;
      }
    } else if (editingId) {
      const { error } = await supabase
        .from('weight_logs')
        .update({ weight: w, log_date: draftDate })
        .eq('id', editingId)
        .eq('user_id', userId);
      setSaving(false);
      if (error) {
        toast({ title: 'No se pudo actualizar', description: error.message, variant: 'destructive' });
        return;
      }
    }
    const { error: syncErr } = await syncProfileWeightFromLogs(userId);
    if (syncErr) {
      toast({ title: 'Peso guardado', description: 'No se pudo sincronizar el perfil: ' + syncErr.message });
    } else {
      toast({ title: formMode === 'add' ? 'Pesaje registrado' : 'Pesaje actualizado' });
    }
    setFormOpen(false);
    await load();
    onSynced?.();
  };

  const confirmDelete = async () => {
    if (!userId || !deleteTarget) return;
    setSaving(true);
    const { error } = await supabase.from('weight_logs').delete().eq('id', deleteTarget.id).eq('user_id', userId);
    setSaving(false);
    setDeleteTarget(null);
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
      return;
    }
    const { error: syncErr } = await syncProfileWeightFromLogs(userId);
    if (syncErr) {
      toast({ title: 'Eliminado', description: syncErr.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro eliminado' });
    }
    await load();
    onSynced?.();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-3xl border-t border-zinc-200 p-0 dark:border-zinc-800"
        >
          <SheetHeader className="shrink-0 border-b border-zinc-100 px-5 pb-4 pt-6 text-left dark:border-zinc-800">
            <SheetTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
              <Scale className="h-5 w-5 text-primary" aria-hidden />
              Evolución de peso
            </SheetTitle>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Historial y sincronización con tu peso actual en el perfil.
            </p>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
            <Button
              type="button"
              onClick={openAdd}
              disabled={!userId}
              className={cn(
                'mb-4 h-12 w-full rounded-xl border-0 bg-primary font-bold text-primary-foreground shadow-md',
                'shadow-[0_10px_24px_var(--brand-glow-sm)] hover:bg-[color:var(--brand-hover)]',
                'active:scale-[0.98] disabled:opacity-50 dark:text-black',
              )}
            >
              <Plus className="mr-2 h-5 w-5" aria-hidden />
              Registrar peso hoy
            </Button>

            <div className="mb-4 min-h-[220px] rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              {loading ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-3 px-4">
                  <Skeleton className="h-full w-full rounded-xl" />
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-[200px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Scale className="h-7 w-7 text-primary opacity-80" />
                  </div>
                  <p className="max-w-xs text-sm font-medium leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Aún no hay registros. ¡Anotá tu primer pesaje para ver tu evolución!
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} vertical={false} />
                    <XAxis
                      dataKey="tick"
                      tick={{ fontSize: 10, fill: chartAxisColor }}
                      axisLine={{ stroke: chartGridColor }}
                      tickLine={{ stroke: chartGridColor }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={yDomain}
                      tick={{ fontSize: 10, fill: chartAxisColor }}
                      axisLine={{ stroke: chartGridColor }}
                      tickLine={{ stroke: chartGridColor }}
                      width={40}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`${value.toFixed(2).replace('.', ',')} kg`, 'Peso']}
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload as { logDate?: string } | undefined;
                        if (!p?.logDate) return '';
                        try {
                          return format(parseISO(p.logDate), "d MMMM yyyy", { locale: es });
                        } catch {
                          return p.logDate;
                        }
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="w"
                      stroke={brandHex}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: brandHex, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: brandHex }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Historial
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : rows.length === 0 ? null : (
              <ScrollArea className="h-[min(40vh,320px)] pr-2">
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {Number(r.weight).toFixed(2).replace('.', ',')} kg
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {format(parseISO(r.log_date), "EEE d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full"
                            aria-label="Opciones"
                          >
                            <MoreHorizontal className="h-5 w-5 text-zinc-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-50">
              {formMode === 'add' ? 'Registrar peso' : 'Editar pesaje'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="weight-kg">Peso (kg)</Label>
              <Input
                id="weight-kg"
                inputMode="decimal"
                placeholder="Ej: 72,5"
                value={draftWeight}
                onChange={(e) => setDraftWeight(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-date">Fecha</Label>
              <Input
                id="weight-date"
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void submitForm()}
              disabled={saving}
              className="bg-primary font-semibold text-primary-foreground hover:bg-[color:var(--brand-hover)] dark:text-black"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pesaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará este registro del historial. El peso del perfil se actualizará al último pesaje restante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
