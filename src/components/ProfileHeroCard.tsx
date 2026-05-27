import { useRef } from 'react';
import { Camera, Loader2, Pencil, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type ProfileHeroCardProps = {
  avatarUrl: string | null;
  uploading?: boolean;
  fullName: string;
  email?: string | null;
  onAvatarClick: () => void;
  onViewAvatar?: () => void;
  onEditClick: () => void;
  badges?: ReactNode;
};

const LONG_PRESS_MS = 500;

/** Cabecera de perfil: avatar centrado, nombre y email. */
export function ProfileHeroCard({
  avatarUrl,
  uploading = false,
  fullName,
  email,
  onAvatarClick,
  onViewAvatar,
  onEditClick,
  badges,
}: ProfileHeroCardProps) {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const handleAvatarPointerDown = () => {
    longPressTriggeredRef.current = false;
    if (!avatarUrl || !onViewAvatar) return;
    clearLongPress();
    longPressRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onViewAvatar();
    }, LONG_PRESS_MS);
  };

  const handleAvatarClick = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    onAvatarClick();
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-5 py-8 shadow-sm',
        'dark:border-zinc-800/80 dark:bg-gradient-to-b dark:from-zinc-900 dark:via-zinc-950 dark:to-[#0a0a0a]',
        'dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(
          'absolute right-4 top-4 h-10 w-10 rounded-xl',
          'border-zinc-200 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/80',
        )}
        onClick={onEditClick}
        aria-label="Editar perfil"
      >
        <Pencil className="h-4 w-4" />
      </Button>

      <div className="flex flex-col items-center text-center">
        <button
          type="button"
          onClick={handleAvatarClick}
          onPointerDown={handleAvatarPointerDown}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
          className={cn(
            'relative flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-full',
            'border-[3px] border-primary/80 bg-zinc-900 shadow-lg',
            'ring-4 ring-primary/15 transition active:scale-[0.98]',
            'dark:bg-zinc-950 dark:drop-shadow-[0_0_20px_var(--brand-glow-sm)]',
            'sm:h-32 sm:w-32',
          )}
          aria-label="Opciones de foto de perfil"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover select-none pointer-events-none"
              style={{ WebkitTouchCallout: 'none' }}
            />
          ) : (
            <User className="h-12 w-12 text-primary/85 sm:h-14 sm:w-14" aria-hidden />
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100">
              <Camera className="h-6 w-6 text-white" aria-hidden />
            </div>
          )}
        </button>

        <h2 className="mt-5 max-w-full truncate px-2 text-xl font-bold leading-tight text-zinc-900 dark:text-white sm:text-[1.35rem]">
          {fullName || 'Tu nombre'}
        </h2>

        {email ? (
          <p className="mt-1.5 max-w-full truncate px-4 text-sm font-normal text-zinc-500 dark:text-zinc-400">
            {email}
          </p>
        ) : null}

        {badges ? (
          <div className="mt-4 flex max-w-full flex-wrap items-center justify-center gap-1.5 px-1">
            {badges}
          </div>
        ) : null}
      </div>
    </section>
  );
}
