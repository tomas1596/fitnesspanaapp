import { Dumbbell, Timer, Footprints, Flame, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { path: '/', icon: Dumbbell },
  { path: '/timer', icon: Timer },
  { path: '/cardio', icon: Footprints },
  { path: '/nutrition', icon: Flame },
  { path: '/profile', icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname.startsWith('/actividad/')) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around py-2.5">
        {tabs.map(({ path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={path}
              className={`flex items-center justify-center rounded-xl p-2 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
