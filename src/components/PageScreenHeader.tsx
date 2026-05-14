import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Cabecera unificada para pestañas principales (mismo anclaje y tipografía). */
const ROW = 'flex items-center justify-between pt-8 pb-4';
const TITLE = 'text-3xl font-extrabold tracking-tight text-foreground antialiased';

type Props = {
  title: string;
  /** Botones, selectores, etc. Alineados a la derecha. */
  right?: ReactNode;
  className?: string;
  /** Solo si una pantalla necesita forzar color del título (p. ej. Timer sobre fondo claro). */
  titleClassName?: string;
};

export function PageScreenHeader({ title, right, className, titleClassName }: Props) {
  return (
    <header className={cn(ROW, className)}>
      <h1 className={cn(TITLE, titleClassName)}>{title}</h1>
      {right != null ? <div className="flex shrink-0 items-center">{right}</div> : null}
    </header>
  );
}
