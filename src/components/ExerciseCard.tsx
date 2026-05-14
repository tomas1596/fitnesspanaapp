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
  Core: 'bg-pink-500/20 text-pink-400',
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
          <div className="grid grid-cols-[28px_1fr_1fr_44px_28px_28px] gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            <span>#</span>
            <span>Reps</span>
            <span>Peso</span>
            <span>RIR</span>
            <span className="text-center">🔥</span>
            <span></span>
          </div>
          {sets.map((set, index) => (
            <div
              key={set.id}
              className="grid grid-cols-[28px_1fr_1fr_44px_28px_28px] items-center gap-1.5 rounded-lg bg-accent p-2"
            >
              <span className="text-center text-sm font-medium text-muted-foreground">
                {set.set_number}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                value={set.reps || ''}
                onChange={(e) => onUpdateSet(set.id, 'reps', parseInt(e.target.value) || 0)}
                className="h-10 rounded-lg border-none bg-secondary text-center text-foreground"
              />
              <Input
                ref={(el) => { weightRefs.current[index] = el; }}
                type="number"
                inputMode="decimal"
                value={set.weight || ''}
                onChange={(e) => onUpdateSet(set.id, 'weight', parseFloat(e.target.value) || 0)}
                className="h-10 rounded-lg border-none bg-secondary text-center text-foreground"
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
                className="h-10 rounded-lg border-none bg-secondary text-center text-foreground disabled:opacity-40"
              />
              <button
                onClick={() => onUpdateSet(set.id, 'to_failure', !set.to_failure)}
                className={`flex h-10 w-full items-center justify-center rounded-lg transition-colors ${
                  set.to_failure ? 'bg-destructive/20' : 'bg-secondary'
                }`}
                aria-label="Al fallo"
              >
                <Flame
                  className={`h-4 w-4 ${
                    set.to_failure ? 'fill-destructive text-destructive' : 'text-muted-foreground/40'
                  }`}
                />
              </button>
              <button
                onClick={() => onDeleteSet(set.id)}
                className="flex h-10 w-full items-center justify-center rounded-lg bg-secondary transition-colors hover:bg-destructive/20"
                aria-label="Eliminar serie"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => onAddSet(id)}
        className="h-10 w-full rounded-xl text-sm font-semibold text-primary/70 hover:bg-primary/10 hover:text-primary"
      >
        <Plus className="mr-1 h-4 w-4 opacity-70" /> Agregar Serie
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
