import { Star } from 'lucide-react';

interface Props {
  value: number; // 0..5 with .5 increments
  size?: number;
}

const StarDisplay = ({ value, size = 14 }: Props) => {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <div key={i} className="relative" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-muted-foreground/30" style={{ width: size, height: size }} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="fill-primary text-primary" style={{ width: size, height: size }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StarDisplay;
