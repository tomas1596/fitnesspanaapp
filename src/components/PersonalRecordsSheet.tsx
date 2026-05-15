import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';

type PersonalRecordRow = Tables<'personal_records'>;

interface PersonalRecordsSheetProps {
  open: boolean;
  onClose: () => void;
}

const formatDateISO = (d: Date) => d.toISOString().split('T')[0];

type ExercisePrGroup = {
  key: string;
  displayName: string;
  maxWeight: number;
  /** Fecha más reciente en la que se alcanzó el peso máximo */
  maxAchievedDate: string;
  records: PersonalRecordRow[];
};

function buildExerciseGroups(rows: PersonalRecordRow[]): ExercisePrGroup[] {
  const byKey = new Map<string, PersonalRecordRow[]>();
  for (const r of rows) {
    const key = r.exercise_name.trim().toLowerCase();
    if (!key) continue;
    const prev = byKey.get(key);
    if (prev) prev.push(r);
    else byKey.set(key, [r]);
  }

  const groups: ExercisePrGroup[] = [];
  for (const [key, recsRaw] of byKey) {
    const records = [...recsRaw].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return (b.id ?? '').localeCompare(a.id ?? '');
    });

    let maxWeight = -Infinity;
    for (const r of records) {
      const w = Number(r.weight);
      if (!Number.isNaN(w) && w > maxWeight) maxWeight = w;
    }
    if (maxWeight <= 0) continue;

    const atMax = records.filter((r) => Number(r.weight) === maxWeight);
    const pickDisplay = [...atMax].sort((a, b) => {
      const cmp = b.date.localeCompare(a.date);
      if (cmp !== 0) return cmp;
      return (b.id ?? '').localeCompare(a.id ?? '');
    })[0]!;

    const maxAchievedDate = [...atMax]
      .map((r) => r.date)
      .sort((a, b) => b.localeCompare(a))[0]!;

    groups.push({
      key,
      displayName: pickDisplay.exercise_name.trim(),
      maxWeight,
      maxAchievedDate,
      records,
    });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' }));
  return groups;
}

function PersonalRecordsSheet({ open, onClose }: PersonalRecordsSheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<PersonalRecordRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formWeight, setFormWeight] = useState('');
  const [formDate, setFormDate] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PersonalRecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setExpanded(new Set());
      setShowForm(false);
      setEditingId(null);
      setFormName('');
      setFormWeight('');
      setFormDate('');
      setDeleteTarget(null);
    }
  }, [open]);

  const groups = useMemo(() => buildExerciseGroups(rows), [rows]);

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const resetFormFields = () => {
    setFormName('');
    setFormWeight('');
    setFormDate(formatDateISO(new Date()));
    setEditingId(null);
  };

  const openNewForm = () => {
    resetFormFields();
    setShowForm(true);
  };

  const startEditRecord = (r: PersonalRecordRow) => {
    setEditingId(r.id);
    setFormName(r.exercise_name.trim());
    setFormWeight(String(r.weight));
    setFormDate(r.date);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    resetFormFields();
  };

  const submitForm = async () => {
    if (!user) return;
    const name = formName.trim();
    const w = parseFloat(formWeight.replace(',', '.'));
    const dateStr = formDate.trim();

    if (!name || Number.isNaN(w) || w <= 0) {
      toast({
        title: 'Datos incompletos',
        description: 'Indica el ejercicio y un peso válido.',
        variant: 'destructive',
      });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      toast({
        title: 'Fecha inválida',
        description: 'Usa una fecha completa.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from('personal_records')
        .update({
          exercise_name: name,
          weight: w,
          date: dateStr,
        })
        .eq('id', editingId)
        .eq('user_id', user.id);

      setSaving(false);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'PR actualizado', description: `${name} · ${w} kg` });
    } else {
      const { error } = await supabase.from('personal_records').insert({
        user_id: user.id,
        exercise_name: name,
        weight: w,
        date: dateStr,
      });
      setSaving(false);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'PR guardado', description: `${name} · ${w} kg` });
    }

    cancelForm();
    load();
  };

  const confirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('personal_records')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('user_id', user.id);

    setDeleting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setDeleteTarget(null);
    toast({ title: 'Entrada eliminada' });
    load();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-border bg-background"
        >
          <SheetHeader className="space-y-1 border-b border-border/40 pb-4 text-left">
            <SheetTitle className="text-lg font-semibold tracking-tight">Récords personales</SheetTitle>
            <p className="text-xs font-normal text-muted-foreground">
              Cada marca es una entrada en el historial. El máximo muestra tu mejor peso y cuándo lo lograste.
            </p>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {!showForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-primary/25 bg-primary/5 text-primary hover:bg-primary/10"
                onClick={openNewForm}
              >
                <Plus className="mr-2 h-4 w-4" />
                Registrar PR
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 text-card-foreground shadow-sm">
                <p className="text-sm font-semibold text-foreground">
                  {editingId ? 'Editar entrada' : 'Nuevo PR'}
                </p>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Ejercicio
                    </label>
                    <Input
                      placeholder="Ej. Press banca"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Peso (kg)
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={formWeight}
                      onChange={(e) => setFormWeight(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Fecha
                    </label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="h-11 rounded-xl border-border/60 bg-background"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" className="rounded-xl" onClick={cancelForm}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-[color:var(--brand-hover)]"
                    disabled={saving}
                    onClick={submitForm}
                  >
                    {editingId ? 'Guardar cambios' : 'Guardar nuevo PR'}
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Cargando…</p>
            ) : groups.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground/70">
                Aún no hay PRs. Registra tu primera marca.
              </p>
            ) : (
              <ul className="space-y-2 pt-1">
                {groups.map((g) => {
                  const isOpen = expanded.has(g.key);
                  return (
                    <li
                      key={g.key}
                      className="overflow-hidden rounded-xl border border-border/50 bg-muted/30 shadow-sm transition-colors"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleExpanded(g.key)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left',
                          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        )}
                      >
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            isOpen ? 'rotate-180' : 'rotate-0',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{g.displayName}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Max{' '}
                            <span className="font-semibold tabular-nums text-primary">{g.maxWeight}</span> kg ·{' '}
                            {new Date(g.maxAchievedDate + 'T12:00:00').toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </button>

                      {isOpen && (
                        <ul className="space-y-1 border-t border-border/60 bg-accent/35 px-2 py-2 pl-[2.125rem] text-accent-foreground">
                          {g.records.map((rec) => (
                            <li
                              key={rec.id}
                              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 px-2 py-1.5"
                            >
                              <div className="min-w-0 flex-1 text-xs tabular-nums leading-snug text-foreground">
                                <span className="font-medium text-primary">{Number(rec.weight)}</span>
                                <span className="text-muted-foreground"> kg</span>
                                <span className="mx-2 text-muted-foreground/80">—</span>
                                <span className="text-muted-foreground">
                                  {new Date(rec.date + 'T12:00:00').toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                  aria-label={`Editar ${g.displayName} ${rec.date}`}
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    startEditRecord(rec);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                                  aria-label={`Eliminar ${g.displayName} ${rec.date}`}
                                  onClick={(ev) => {
                                    ev.preventDefault();
                                    ev.stopPropagation();
                                    setDeleteTarget(rec);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-border bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar esta entrada</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Seguro que quieres borrar este registro del historial? No se pueden deshacer los cambios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default PersonalRecordsSheet;
