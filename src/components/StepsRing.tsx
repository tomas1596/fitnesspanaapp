import { Footprints } from 'lucide-react';

interface Props {
  steps: number;
  goal?: number;
  size?: number;
}

const StepsRing = ({ steps, goal = 10000, size = 96 }: Props) => {
  const pct = Math.min(100, (steps / goal) * 100);
  const radius = (size - 14) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth="7" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Footprints className="mb-0.5 h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-bold tabular-nums text-foreground">{steps.toLocaleString()}</span>
      </div>
    </div>
  );
};

export default StepsRing;
