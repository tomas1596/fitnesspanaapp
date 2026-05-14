import { useEffect, useRef, useState } from 'react';
import { Plus, Flame, Trash2, MoreVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExerciseSet {
  id: string;
  set_number: number;
  reps: number;
  weight: number;
  rir: number;
  to_failure: boolean;
}

interface ExerciseCardProps {
  id: string;
  name: string;
  muscleGroup: string;
  sets: ExerciseSet[];
  lastPerformance?: { weight: number; reps: number };
  autoFocusWeight?: boolean;
  onAddSet: (exerciseId: string) => void;
  onUpdateSet: (setId: string, field: 'reps' | 'weight' | 'rir' | 'to_failure', value: number | boolean) => void;
  onDeleteSet: (setId: string) => void;
  onDeleteExercise: () => void;
  onRenameExercise: (newName: string) => void;
}

const muscleGroupColors: Record<string, string> = {
  Pecho: 'bg-primary/20 text-primary',
  Espalda: 'bg-blue-500/20 text-blue-400',
  Piernas: 'bg-orange-500/20 text-orange-400',
  Brazos: 'bg-purple-500/20 text-purple-400',
  Hombros: 'bg-yellow-500/20 text-yellow-400',
  Core: 'bg-teal-500/20 text-teal-400',
};

const ExerciseCard = ({
  id,
  name,
  muscleGroup,
  sets,
  lastPerformance,
  autoFocusWeight,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onDeleteExercise,
  onRenameExercise,
}: ExerciseCardProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);

  // Refs for weight inputs (indexed by set position)
  const weightRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus last weight input when a new set is added and autoFocusWeight is true
  useEffect(() => {
    if (autoFocusWeight && sets.length > 0) {
      const lastIdx = sets.length - 1;
      const timer = setTimeout(() => {
        weightRefs.current[lastIdx]?.focus();
        weightRefs.current[lastIdx]?.select();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [sets.length, autoFocusWeight]);

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name) onRenameExercise(trimmed);
    setEditOpen(false);
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card/80 p-5 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold tracking-tight text-foreground">{name}</h3>
          <span
            className={`mt-1.5 inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${
              muscleGroupColors[muscleGroup] || 'bg-muted text-muted-foreground'
            }`}
          >
            {muscleGroup}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground/50 hover:bg-accent hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-card">
            <DropdownMenuItem
              onClick={() => { setEditName(name); setEditOpen(true); }}
              className="cursor-pointer text-foreground focus:bg-accent"
            >
              <Pencil className="mr-2 h-4 w-4" /> Editar nombre
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDeleteExercise}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar ejercicio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Last performance hint */}
      {lastPerformance && (
        <p
          className="mb-3 text-xs font-semibold"
          style={{ color: 'var(--brand-color)', opacity: 0.85 }}
        >
          Último: {lastPerformance.weight}kg × {lastPerformance.reps}
        </p>
      )}

      {sets.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="grid grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_48px_44px_44px] items-end gap-2 px-0.5">
            <span className="text-center text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">#</span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Reps</span>
            <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Peso</span>
            <span className="text-center text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">RIR</span>
            <span className="sr-only">Al fallo</span>
            <span className="sr-only">Eliminar</span>
          </div>
          {sets.map((set, index) => (
            <div
              key={set.id}
              className="grid grid-cols-[32px_minmax(0,1fr)_minmax(0,1fr)_48px_44px_44px] items-center gap-2 rounded-xl bg-accent/80 p-2.5 dark:bg-accent/50"
            >
              <span className="text-center text-xl font-bold tabular-nums text-zinc-600 dark:text-zinc-300">
                {set.set_number}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={set.reps || ''}
                onChange={(e) => onUpdateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                className="h-12 min-h-[48px] rounded-xl border-none bg-secondary text-center text-xl font-bold tabular-nums text-foreground"
              />
              <Input
                ref={(el) => { weightRefs.current[index] = el; }}
                type="number"
                inputMode="decimal"
                value={set.weight || ''}
                onChange={(e) => onUpdateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                className="h-12 min-h-[48px] rounded-xl border-none bg-secondary text-center text-xl font-bold tabular-nums text-foreground"
                style={{ caretColor: 'var(--brand-color)' }}
              />
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={5}
                value={set.to_failure ? '' : (set.rir || '')}
                disabled={set.to_failure}
                onChange={(e) => {
                  const v = Math.min(5, Math.max(0, parseInt(e.target.value) || 0));
                  onUpdateSet(set.id, 'rir', v);
                }}
                className="h-12 min-h-[48px] rounded-xl border-none bg-secondary text-center text-lg font-bold tabular-nums text-foreground disabled:opacity-40"
              />
              <button
                type="button"
                onClick={() => onUpdateSet(set.id, 'to_failure', !set.to_failure)}
                className={
                  set.to_failure
                    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25'
                    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20'
                }
                aria-label="Al fallo"
              >
                <Flame
                  className={
                    set.to_failure
                      ? 'h-4 w-4 fill-destructive text-destructive'
                      : 'h-4 w-4 text-primary'
                  }
                  strokeWidth={2}
                />
              </button>
              <button
                type="button"
                onClick={() => onDeleteSet(set.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200/90 hover:text-destructive dark:bg-zinc-800 dark:hover:bg-zinc-700"
                aria-label="Eliminar serie"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        onClick={() => onAddSet(id)}
        className="h-12 w-full rounded-xl border-0 bg-primary/10 text-sm font-semibold text-primary shadow-none hover:bg-primary/20"
      >
        <Plus className="mr-2 h-4 w-4" strokeWidth={2} /> Agregar serie
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-none bg-card text-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar nombre</DialogTitle>
          </DialogHeader>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            className="h-14 rounded-xl border-none bg-accent text-foreground"
            autoFocus
          />
          <Button onClick={handleSaveName} className="h-12 w-full rounded-xl font-semibold">
            Guardar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExerciseCard;
