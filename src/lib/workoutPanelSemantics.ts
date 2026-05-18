import { cn } from '@/lib/utils';

/** Panel principal registro CrossFit / Funcional (sin fondos zinc fijos). */
export const WORKOUT_LOG_PANEL_SHELL = cn(
  'space-y-4 rounded-2xl border border-border/60 bg-background p-4 shadow-md transition-colors duration-200',
  "[html[data-brand='pink']_&]:border-[#ff007f]/25 [html[data-brand='pink']_&]:shadow-none",
  "dark:[html[data-brand='pink']_&]:border-pink-800/45",
);

export const WORKOUT_LOG_FIELD_LABEL = cn(
  'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground',
);

export const WORKOUT_LOG_INPUT = cn(
  'h-11 rounded-xl border border-input bg-secondary text-sm text-foreground placeholder:text-muted-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  "[html[data-brand='pink']_&]:border-[#ff007f]/30",
  "dark:[html[data-brand='pink']_&]:border-pink-800/40",
);

/** Tarjeta anidada (AMRAP n, bloque funcional). */
export const WORKOUT_LOG_INNER_CARD = cn(
  'rounded-xl border border-border/60 bg-muted/25 p-3',
  'dark:bg-muted/15',
  "[html[data-brand='pink']_&]:border-[#ff007f]/22",
  "dark:[html[data-brand='pink']_&]:border-pink-800/35",
);

export const WORKOUT_LOG_DIVIDER = cn(
  'border-t border-border/70 pt-3 dark:border-border/60',
  "[html[data-brand='pink']_&]:border-pink-200/50",
);

export const WORKOUT_LOG_SUBTYPE_PILL_IDLE = cn(
  'shrink-0 rounded-full border border-border bg-secondary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors',
  'hover:bg-accent hover:text-accent-foreground',
  "[html[data-brand='pink']_&]:border-[#ff007f]/35",
  "dark:[html[data-brand='pink']_&]:border-pink-700/40 dark:[html[data-brand='pink']_&]:text-pink-100",
);

export const WORKOUT_LOG_SUBTYPE_PILL_ACTIVE = cn(
  'shrink-0 rounded-full border border-primary bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm',
  "[html[data-brand='pink']_&]:shadow-none",
);

export const WORKOUT_LOG_LIST_SURFACE = cn(
  'space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2',
  "[html[data-brand='pink']_&]:border-[#ff007f]/22",
  "dark:[html[data-brand='pink']_&]:border-pink-800/35",
);

/** “Añadir AMRAP”, “Añadir bloque”, etc. */
export const WORKOUT_LOG_GHOST_ACTION = cn(
  'h-8 rounded-lg px-2 text-xs font-semibold text-foreground hover:bg-accent',
  "[html[data-brand='pink']_&]:text-[#ff007f]",
  "dark:[html[data-brand='pink']_&]:text-fuchsia-200 dark:[html[data-brand='pink']_&]:hover:bg-accent",
);

export const WORKOUT_LOG_SECONDARY_BTN = cn(
  'h-10 shrink-0 rounded-xl border border-border bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
  "[html[data-brand='pink']_&]:border-[#ff007f]/35",
);

export const WORKOUT_LOG_SAVE_BTN = cn(
  'h-11 w-full rounded-xl border-0 bg-primary font-semibold text-primary-foreground shadow-none hover:bg-[color:var(--brand-hover)]',
);

/** Resultado destacado For Time (verde → fucsia en VIP). */
export const WORKOUT_LOG_RESULT_WRAP_FOR_TIME = cn(
  'space-y-1 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3',
  'dark:border-emerald-500/25 dark:bg-emerald-950/30',
  "[html[data-brand='pink']_&]:border-[#ff007f]/45",
  "dark:[html[data-brand='pink']_&]:border-fuchsia-500/35",
);

export const WORKOUT_LOG_RESULT_LABEL_FOR_TIME = cn(
  WORKOUT_LOG_FIELD_LABEL,
  'text-emerald-800 dark:text-emerald-300',
  "[html[data-brand='pink']_&]:text-[#ff007f]",
);

export const WORKOUT_LOG_RESULT_INPUT_FOR_TIME = cn(
  WORKOUT_LOG_INPUT,
  'border-emerald-500/35 font-mono tabular-nums dark:border-emerald-600/35',
  "[html[data-brand='pink']_&]:border-[#ff007f]/40",
);

/** Resultado destacado clásico / benchmark (sky → fucsia en VIP). */
export const WORKOUT_LOG_RESULT_WRAP_CLASSIC = cn(
  'space-y-1 rounded-xl border border-sky-500/35 bg-sky-500/10 p-3',
  'dark:border-sky-500/25 dark:bg-sky-950/30',
  "[html[data-brand='pink']_&]:border-[#ff007f]/45",
  "dark:[html[data-brand='pink']_&]:border-fuchsia-500/35",
);

export const WORKOUT_LOG_RESULT_LABEL_CLASSIC = cn(
  WORKOUT_LOG_FIELD_LABEL,
  'text-sky-800 dark:text-sky-300',
  "[html[data-brand='pink']_&]:text-[#ff007f]",
);

export const WORKOUT_LOG_RESULT_INPUT_CLASSIC = cn(
  WORKOUT_LOG_INPUT,
  'border-sky-500/35 font-mono tabular-nums dark:border-sky-600/35',
  "[html[data-brand='pink']_&]:border-[#ff007f]/40",
);
