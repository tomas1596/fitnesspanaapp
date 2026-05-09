import { Star } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  value: number; // 0..5 with .5 increments
  onChange: (v: number) => void;
  label?: string;
}

const HalfStarRating = ({ value, onChange, label }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent, idx: number) => {
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    onChange(idx + (isLeft ? 0.5 : 1));
  };

  return (
    <div>
      {label && <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>}
      <div ref={ref} className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => {
          const fill = Math.max(0, Math.min(1, value - i));
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleClick(e, i)}
              className="relative h-7 w-7"
              aria-label={`${i + 1} estrellas`}
            >
              <Star className="absolute inset-0 h-7 w-7 text-muted-foreground/30" />
              <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="h-7 w-7 fill-primary text-primary" />
              </div>
            </button>
          );
        })}
        <span className="ml-2 text-sm font-medium text-foreground">{value.toFixed(1)}</span>
      </div>
    </div>
  );
};

export default HalfStarRating;
