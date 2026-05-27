import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProfileAvatarSheetProps = {
  open: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  fileInputId: string;
  onDelete: () => void;
  uploading?: boolean;
};

/** Bottom sheet de foto de perfil: vista previa + acciones. */
export function ProfileAvatarSheet({
  open,
  onClose,
  avatarUrl,
  fileInputId,
  onDelete,
  uploading = false,
}: ProfileAvatarSheetProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!open) setLightboxOpen(false);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden={false}
      >
        <section
          role="dialog"
          aria-labelledby="profile-avatar-sheet-title"
          aria-modal="true"
          className={cn(
            'mx-auto w-full max-w-lg',
            'bg-[#1a1a1a] rounded-t-3xl p-6 shadow-2xl',
            'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <p
            id="profile-avatar-sheet-title"
            className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
          >
            Foto de perfil
          </p>

          <div className="mb-5 flex justify-center">
            {avatarUrl ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                disabled={uploading}
                className={cn(
                  'relative overflow-hidden rounded-2xl ring-1 ring-white/10',
                  'transition active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Ver foto de perfil en pantalla completa"
              >
                <img
                  src={avatarUrl}
                  alt="Vista previa de tu foto de perfil"
                  className="h-36 w-36 object-cover sm:h-40 sm:w-40"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                    <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden />
                  </div>
                )}
              </button>
            ) : (
              <div
                className="flex h-36 w-36 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-white/10 sm:h-40 sm:w-40"
                aria-hidden
              >
                <User className="h-14 w-14 text-zinc-500" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor={fileInputId}
              onClick={onClose}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5',
                'text-sm font-semibold text-primary transition-colors',
                'hover:bg-white/5 active:bg-white/10',
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Camera className="h-4 w-4" />
              </span>
              Cambiar foto
            </label>

            {avatarUrl && (
              <button
                type="button"
                onClick={onDelete}
                disabled={uploading}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left',
                  'text-sm font-semibold text-red-400 transition-colors',
                  'hover:bg-red-500/10 active:bg-red-500/15',
                  'disabled:pointer-events-none disabled:opacity-50',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                  <Trash2 className="h-4 w-4" />
                </span>
                Eliminar foto
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-1 w-full rounded-xl py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 active:text-zinc-200"
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>

      {lightboxOpen && avatarUrl && (
        <AvatarLightbox src={avatarUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}

/* ── Visor a pantalla completa ── */
function AvatarLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const swipeRef = useRef<{ y: number } | null>(null);
  const scaleRef = useRef(1);

  const MIN = 1;
  const MAX = 6;
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

  const applyScale = useCallback((next: number) => {
    const s = clamp(next);
    scaleRef.current = s;
    setScale(s);
    if (s <= 1) setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      applyScale(scaleRef.current * (e.deltaY > 0 ? 0.88 : 1.14));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [applyScale]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !dragStart.current) return;
    setOffset({
      x: dragStart.current.ox + e.clientX - dragStart.current.px,
      y: dragStart.current.oy + e.clientY - dragStart.current.py,
    });
  };

  const onMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    dragStart.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy) };
      swipeRef.current = null;
    } else if (e.touches.length === 1) {
      swipeRef.current = { y: e.touches[0].clientY };
      if (scaleRef.current > 1) {
        dragStart.current = {
          px: e.touches[0].clientX,
          py: e.touches[0].clientY,
          ox: offset.x,
          oy: offset.y,
        };
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      applyScale(scaleRef.current * (newDist / pinchRef.current.dist));
      pinchRef.current.dist = newDist;
    } else if (e.touches.length === 1 && scaleRef.current > 1 && dragStart.current) {
      setOffset({
        x: dragStart.current.ox + e.touches[0].clientX - dragStart.current.px,
        y: dragStart.current.oy + e.touches[0].clientY - dragStart.current.py,
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (swipeRef.current && scaleRef.current <= 1.05 && e.changedTouches.length === 1) {
      const dy = e.changedTouches[0].clientY - swipeRef.current.y;
      if (dy > 90) {
        onClose();
        return;
      }
    }
    if (e.touches.length === 0) dragStart.current = null;
    swipeRef.current = null;
  };

  const lastTapRef = useRef(0);
  const onTouchEndForDoubleTap = (e: React.TouchEvent) => {
    onTouchEnd(e);
    if (e.changedTouches.length !== 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (scaleRef.current <= 1.05) applyScale(2.5);
      else applyScale(1);
    }
    lastTapRef.current = now;
  };

  const cursor = scaleRef.current > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in';

  return (
    <div
      className="fixed inset-0 z-[300] bg-black select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Foto de perfil ampliada"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Cerrar visualizador"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25 active:scale-90"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <X className="h-5 w-5" />
      </button>

      {scale <= 1 && (
        <p className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-xs text-white/40 select-none">
          Pellizca para hacer zoom · Desliza abajo para cerrar
        </p>
      )}

      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ cursor, touchAction: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEndForDoubleTap}
      >
        <img
          src={src}
          alt="Foto de perfil"
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: isDragging || pinchRef.current ? 'none' : 'transform 0.2s cubic-bezier(0.25,0.46,0.45,0.94)',
            maxWidth: '92vw',
            maxHeight: '92vh',
            objectFit: 'contain',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      </div>
    </div>
  );
}
