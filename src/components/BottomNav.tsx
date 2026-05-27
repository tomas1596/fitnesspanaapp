import { Dumbbell, Timer, Footprints, Flame, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hapticsNavTap } from '@/lib/haptics';

const tabs = [
  { path: '/', icon: Dumbbell, label: 'Entreno' },
  { path: '/timer', icon: Timer, label: 'Timer' },
  { path: '/cardio', icon: Footprints, label: 'Cardio' },
  { path: '/nutrition', icon: Flame, label: 'Nutrición' },
  { path: '/profile', icon: User, label: 'Perfil' },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith('/actividad/')) return null;
  if (/^\/cardio\/.+/.test(location.pathname)) return null;
      if (location.pathname === '/admin') return null;
      if (location.pathname === '/coach') return null;

  return (
    <nav
      className={[
        'fixed bottom-0 z-50 w-full',
        /* Light */ 'border-t border-zinc-200 bg-white shadow-[0_-1px_8px_rgba(0,0,0,0.06)]',
        /* Dark  */ 'dark:border-white/[0.06] dark:bg-zinc-950/85 dark:backdrop-blur-xl dark:shadow-none',
      ].join(' ')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => {
                if (location.pathname !== path) {
                  hapticsNavTap();
                }
                navigate(path);
              }}
              aria-label={label}
              className="group flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-300 active:scale-90"
            >
              <span
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-300',
                  active ? 'scale-110 bg-primary/10 dark:bg-primary/15' : 'scale-100 bg-transparent',
                ].join(' ')}
                style={active ? { boxShadow: '0 0 12px var(--brand-glow-sm)' } : undefined}
              >
                <Icon
                  className={[
                    'transition-all duration-300',
                    active
                      ? 'h-6 w-6 text-primary drop-shadow-[0_0_5px_var(--brand-glow-sm)]'
                      : 'h-5 w-5 text-zinc-500 dark:text-muted-foreground/50',
                  ].join(' ')}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </span>
              <span
                className={[
                  'text-[10px] font-semibold tracking-wide transition-all duration-300',
                  active
                    ? 'text-primary'
                    : 'text-zinc-500 dark:text-muted-foreground/40',
                ].join(' ')}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
