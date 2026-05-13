import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeToDeleteProps {
  onDelete: () => void;
  children: React.ReactNode;
}

const SwipeToDelete = ({ onDelete, children }: SwipeToDeleteProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    const newX = Math.min(0, dx);
    setTranslateX(newX);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (translateX < -100) {
      setTranslateX(-1000);
      setTimeout(onDelete, 300);
    } else {
      setTranslateX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-end bg-destructive px-4">
        <div className="flex items-center gap-1.5 text-destructive-foreground">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm font-semibold">Eliminar</span>
        </div>
      </div>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
        }}
        className="relative bg-card"
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeToDelete;
