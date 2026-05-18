import { Footprints } from 'lucide-react';

interface Props {
  steps: number;
  goal?: number;
  size?: number;
  /** Compacto para widgets: centro con % o solo ícono; sin recuento de pasos dentro del anillo. */
  variant?: 'default' | 'compact';
  /** Si `variant === 'compact'`, qué dibujar al centro del anillo. */
  compactCenter?: 'percent' | 'icon';
}

/**
 * Anillo de pasos: SVG + fill explícito (Chrome Android / modo oscuro).
 */
const StepsRing = ({
  steps,
  goal = 10000,
  size = 96,
  variant = 'default',
  compactCenter = 'percent',
}: Props) => {
  const pctDen = goal > 0 ? goal : 1;
  const pct = Math.min(100, (steps / pctDen) * 100);
  const strokeWidth = variant === 'compact' ? 5 : 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const c = size / 2;
  const pctLabel = `${Math.round(pct)}%`;

  return (
    <div
      className="relative shrink-0 overflow-visible"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      <svg
        className="block h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="transparent"
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="transparent"
          className="stroke-green-600 dark:stroke-primary dark:drop-shadow-[0_0_10px_var(--brand-glow-sm)] [html[data-brand='pink']_&]:stroke-[#ff007f] [html[data-brand='pink']_&]:drop-shadow-none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {variant === 'compact' ? (
          compactCenter === 'percent' ? (
            <span className="text-[11px] font-black tabular-nums tracking-tight text-primary dark:text-black">
              {pctLabel}
            </span>
          ) : (
            <Footprints className="h-5 w-5 shrink-0 text-primary dark:text-black" aria-hidden />
          )
        ) : (
          <>
            <Footprints className="mb-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {steps.toLocaleString()}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default StepsRing;
