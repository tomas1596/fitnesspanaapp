import { Footprints } from 'lucide-react';

interface Props {
  steps: number;
  goal?: number;
  size?: number;
}

/**
 * Anillo de pasos: SVG con viewBox + fill explícito (Android Chrome / modo oscuro).
 * Strokes vía clases Tailwind — evita `currentColor` y `hsl(var(--…))` que a veces rompen en móvil.
 */
const StepsRing = ({ steps, goal = 10000, size = 96 }: Props) => {
  const pct = Math.min(100, (steps / goal) * 100);
  const radius = (size - 14) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const c = size / 2;

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
          strokeWidth="7"
        />
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="transparent"
          className="stroke-primary dark:drop-shadow-[0_0_10px_var(--brand-glow-sm)]"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <Footprints className="mb-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{steps.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default StepsRing;
