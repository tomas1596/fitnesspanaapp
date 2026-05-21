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
        'workout-modality-tabs flex gap-1 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/5',
        "[html[data-brand='pink']_&]:border-[#ff007f]/25",
        "dark:[html[data-brand='pink']_&]:border-pink-800/45",
        className,
      )}
    >
      {visible.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex-1 rounded-xl px-1 py-2 text-center text-xs font-semibold transition-all duration-200 active:scale-[0.97] sm:text-sm',
              active
                ? "bg-primary text-zinc-950 shadow-[0_4px_12px_-2px_rgba(57,255,20,0.25)] dark:text-zinc-950 [html[data-brand='pink']_&]:shadow-none"
                : 'bg-transparent text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
