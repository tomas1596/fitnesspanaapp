import { Moon, Smartphone, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ThemeChoice = 'light' | 'dark' | 'system';

type Props = {
  value: ThemeChoice;
  onChange: (t: ThemeChoice) => void;
};

/** Selector Día / Noche / Sistema — píldoras con thumb deslizante (Perfil, Auth, etc.) */
export function ThemeSegmentedControl({ value, onChange }: Props) {
  const segments: { id: ThemeChoice; icon: typeof Sun; label: string }[] = [
    { id: 'light', icon: Sun, label: 'Modo día' },
    { id: 'dark', icon: Moon, label: 'Modo noche' },
    { id: 'system', icon: Smartphone, label: 'Tema automático según el sistema' },
  ];
  const idx = value === 'light' ? 0 : value === 'dark' ? 1 : 2;

  return (
    <div
      className="relative isolate flex h-12 w-[9.5rem] shrink-0 items-stretch rounded-full bg-zinc-100 p-1 shadow-inner shadow-zinc-900/5 dark:bg-zinc-800/50 dark:shadow-black/30"
      role="group"
      aria-label="Tema de la app"
    >
      <div className="pointer-events-none absolute inset-y-1 left-1 right-1" aria-hidden>
        <div
          className="h-full w-1/3 rounded-full bg-pink-500 shadow-md transition-transform duration-300 ease-out dark:shadow-pink-500/25"
          style={{ transform: `translateX(${idx * 100}%)` }}
        />
      </div>
      <div className="relative z-[1] grid min-h-0 w-full grid-cols-3">
        {segments.map(({ id, icon: Icon, label }) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-label={label}
              aria-pressed={selected}
              title={label}
              className={cn(
                'flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-full transition-colors duration-200',
                selected ? 'text-white' : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.35} aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}
