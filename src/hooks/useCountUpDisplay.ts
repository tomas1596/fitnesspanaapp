import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type Options = {
  /** Bump para reiniciar la animación 0→`end` desde el principio. */
  playKey: string | number;
  durationMs?: number;
};

/**
 * Valor visual entero que anima de 0 a `end` cuando cambia `playKey`.
 * Si `playKey` no cambió y solo cambió `end`, salta directo al nuevo valor (p. ej. nuevos datos en misma vista).
 */
export function useCountUpDisplay(end: number, options: Options): number {
  const prefersReducedMotion = usePrefersReducedMotion();
  const durationMs = options.durationMs ?? 500;
  const { playKey } = options;
  const normalizedEnd = Number.isFinite(end) ? Math.round(end) : 0;

  const [value, setValue] = useState(prefersReducedMotion ? normalizedEnd : 0);
  const lastKeyRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(normalizedEnd);
      lastKeyRef.current = playKey;
      return;
    }

    const sameKeySeq = lastKeyRef.current === playKey;
    lastKeyRef.current = playKey;

    if (sameKeySeq) {
      setValue(normalizedEnd);
      return;
    }

    setValue(0);
    let startTs: number | null = null;
    let raf = 0;
    let cancelled = false;

    const frame = (now: number) => {
      if (cancelled) return;
      if (startTs === null) startTs = now;
      const rawT = Math.min(1, (now - startTs) / durationMs);
      const t = easeOutCubic(rawT);
      const next = Math.round(normalizedEnd * t);
      setValue(rawT >= 1 ? normalizedEnd : next);
      if (rawT < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [normalizedEnd, durationMs, playKey, prefersReducedMotion]);

  return value;
}
