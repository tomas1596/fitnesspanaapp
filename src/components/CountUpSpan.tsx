import { cn } from '@/lib/utils';
import { useCountUpDisplay } from '@/hooks/useCountUpDisplay';

type Props = {
  value: number;
  playKey: string | number;
  durationMs?: number;
  className?: string;
};

/** Número con animación tipo count-up cuando cambia `playKey`. Respeta prefers-reduced-motion vía hook. */
export function CountUpSpan({ value, playKey, durationMs = 500, className }: Props) {
  const displayed = useCountUpDisplay(Number.isFinite(value) ? Math.round(value) : 0, { playKey, durationMs });
  return <span className={cn('tabular-nums', className)}>{displayed}</span>;
}
