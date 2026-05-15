import { cn } from '@/lib/utils';
import { WORKOUT_MODALITY_OPTIONS, type WorkoutModalityId } from '@/lib/workoutModality';

type Props = {
  value: WorkoutModalityId;
  onChange: (m: WorkoutModalityId) => void;
  className?: string;
  /** Si se pasa, solo se muestran estas modalidades (vista Gimnasio). */
  allowedModalities?: WorkoutModalityId[] | null;
};

export function WorkoutModalityTabs({ value, onChange, className, allowedModalities }: Props) {
  const options =
    allowedModalities != null && allowedModalities.length > 0
      ? WORKOUT_MODALITY_OPTIONS.filter((o) => allowedModalities.includes(o.id))
      : WORKOUT_MODALITY_OPTIONS;

  const visible = options.length > 0 ? options : WORKOUT_MODALITY_OPTIONS;

  return (
    <div
      className={cn(
        'flex gap-1 rounded-2xl border border-border/40 bg-muted/90 p-1 transition-colors duration-200',
        'dark:bg-secondary/90',
        "[html[data-brand='pink']_&]:border-pink-700/35 [html[data-brand='pink']_&]:bg-zinc-900/95",
        "dark:[html[data-brand='pink']_&]:border-pink-800/45 dark:[html[data-brand='pink']_&]:bg-zinc-950/90",
        className,
      )}
      style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}
    >
      {visible.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex-1 rounded-xl px-1 py-2 text-center text-xs font-semibold transition-colors duration-200 sm:text-sm',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : cn(
                    'bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    "[html[data-brand='pink']_&]:hover:bg-zinc-800/90 [html[data-brand='pink']_&]:hover:text-pink-100",
                  ),
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
