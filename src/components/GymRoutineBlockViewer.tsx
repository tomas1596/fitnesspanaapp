import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { GymRoutineWorkoutPayload } from '@/lib/gymRoutineWorkoutData';
import {
  CROSSFIT_SUBTYPE_LABELS,
  crossfitWarmupHasContent,
  type CrossfitLogDraft,
  type ManualExerciseLine,
} from '@/lib/crossfitWodDraft';
import {
  FUNCTIONAL_METHOD_LABELS,
  FUNCTIONAL_PHASE_LABELS,
  type FunctionalPhaseDraft,
  type FunctionalSessionDraft,
} from '@/lib/functionalSessionDraft';

function MovementList({
  lines,
  className,
  chalkboard,
}: {
  lines: ManualExerciseLine[];
  className?: string;
  chalkboard?: boolean;
}) {
  const named = lines.filter((e) => e.name.trim());
  if (named.length === 0) {
    return (
      <p
        className={cn(
          'mt-1.5 text-xs italic',
          chalkboard ? 'text-zinc-500' : 'text-muted-foreground',
        )}
      >
        Sin movimientos cargados en este bloque (avisá al coach si falta algo).
      </p>
    );
  }
  return (
    <ol
      className={cn(
        'mt-1.5 list-decimal space-y-1 pl-4 marker:text-[11px] marker:font-semibold',
        chalkboard ? 'marker:text-zinc-500' : 'marker:text-muted-foreground',
        className,
      )}
    >
      {named.map((e) => (
        <li
          key={e.id}
          className={cn(
            'text-xs leading-snug',
            chalkboard ? 'text-zinc-100' : 'text-foreground',
          )}
        >
          <span className="font-medium">{e.name.trim()}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "(10 MIN)" para tiempos en badges CrossFit / tiempo total de sesión funcional.
 * Añade " MIN" solo si es un número sin unidad; respeta mm:ss, MIN ya escrito y marcas de segundos.
 */
function formatBadgeMinutesParen(durationRaw: string): string {
  const t = durationRaw.trim();
  if (!t) return '';

  const core = t.replace(/\s+/g, ' ').trim();
  const upper = core.toUpperCase();

  const hasMinWord = /\bMIN\b|\bMINUTO|\bMINUTOS\b/i.test(core);
  const looksLikeClock = /^\d{1,2}:\d{2}(:\d{2})?$/.test(core);
  const hasSecondsPrime = /[″']/.test(core);
  const mentionsSec = /\b(SEG|SEC)\b/i.test(core);
  const isBareNumber = /^\d+(\.\d+)?$/.test(core);

  let display = upper;
  if (!hasMinWord && !looksLikeClock && !hasSecondsPrime && !mentionsSec && isBareNumber) {
    display = `${core} MIN`.toUpperCase();
  }

  return ` (${display})`;
}

/** Tiempo dentro del badge verde: mayúsculas + dígitos legibles. */
function BadgeTimeParen({
  durationRaw,
  chalkboard,
}: {
  durationRaw: string;
  chalkboard?: boolean;
}) {
  const paren = formatBadgeMinutesParen(durationRaw);
  if (!paren) return null;
  return (
    <span
      className={cn(
        'font-extrabold tracking-normal tabular-nums [font-variant-numeric:lining-nums]',
        chalkboard ? 'font-mono text-zinc-100' : 'text-foreground',
      )}
    >
      {paren}
    </span>
  );
}

/** Duración / presets en el título de fases funcionales con tiempo o rondas. */
function functionalPhaseDurationParen(phase: FunctionalPhaseDraft): string {
  switch (phase.method) {
    case 'rounds_circuit':
      return phase.round_count.trim() ? ` (${phase.round_count.trim().toUpperCase()} RONDAS)` : '';
    case 'time_intervals': {
      const bits = [
        phase.work_time.trim().toUpperCase(),
        phase.rest_time.trim().toUpperCase(),
        phase.rounds.trim() ? `${phase.rounds.trim().toUpperCase()} TANDAS` : '',
      ].filter(Boolean);
      return bits.length ? ` (${bits.join(' · ')})` : '';
    }
    case 'tabata':
      return ' (20″ TRABAJO · 10″ DESCANSO · 8 RONDAS)';
    default:
      return '';
  }
}

function BlockTitleBadge({
  children,
  chalkboard,
}: {
  children: ReactNode;
  chalkboard?: boolean;
}) {
  if (chalkboard) {
    return (
      <div className="inline-flex w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-sm font-black uppercase tracking-wide text-zinc-100">
        {children}
      </div>
    );
  }
  return (
    <div className="gym-routine-block-badge inline-flex w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-primary/35 bg-primary/12 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
      {children}
    </div>
  );
}

function chalkboardBlockShell(chalkboard: boolean, className?: string) {
  return cn(
    chalkboard
      ? 'border-b border-dashed border-zinc-800 py-4 last:border-b-0'
      : cn(
          'rounded-xl border border-border/50 bg-card/80 p-3',
          "[html[data-brand='pink']_&]:border-[#ff007f]/25 dark:[html[data-brand='pink']_&]:border-pink-700/35",
        ),
    className,
  );
}

function chalkboardMutedShell(chalkboard: boolean, className?: string) {
  return cn(
    chalkboard
      ? 'border-b border-dashed border-zinc-800 py-4 last:border-b-0'
      : cn(
          'rounded-xl border border-border/50 bg-muted/25 p-3 dark:bg-muted/15',
          "[html[data-brand='pink']_&]:border-[#ff007f]/25 dark:[html[data-brand='pink']_&]:border-pink-700/35",
        ),
    className,
  );
}

function amrapBlockDurationSource(
  blockDuration: string,
  globalAmrapTotal: string,
  blockIndex: number,
): string {
  const d = blockDuration.trim();
  if (d) return d;
  if (blockIndex === 0 && globalAmrapTotal.trim()) return globalAmrapTotal.trim();
  return '';
}

function CrossfitRoutinePreview({
  draft,
  chalkboard,
}: {
  draft: CrossfitLogDraft;
  chalkboard?: boolean;
}) {
  const subtypeLabel = CROSSFIT_SUBTYPE_LABELS.find((x) => x.id === draft.subtype)?.label ?? draft.subtype;
  const warmup = draft.warmup_skill;

  return (
    <div className="space-y-3 text-sm">
      <div
        className={cn(
          chalkboard
            ? 'border-b border-dashed border-zinc-800 pb-4'
            : 'rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 dark:bg-muted/10',
        )}
      >
        <p
          className={cn(
            'text-[11px] font-semibold uppercase tracking-wide',
            chalkboard ? 'text-zinc-400' : 'text-muted-foreground',
          )}
        >
          Formato
        </p>
        <p
          className={cn(
            'font-semibold',
            chalkboard ? 'font-mono text-base font-black uppercase text-zinc-100' : 'text-foreground',
          )}
        >
          {subtypeLabel}
        </p>
        {draft.wod_name.trim() ? (
          <p
            className={cn(
              'mt-1 text-sm font-medium',
              chalkboard ? 'text-zinc-100' : 'text-foreground/95',
            )}
          >
            {draft.wod_name.trim()}
          </p>
        ) : null}
      </div>

      {crossfitWarmupHasContent(warmup) ? (
        <div className={chalkboardMutedShell(chalkboard)}>
          <BlockTitleBadge chalkboard={chalkboard}>Calentamiento</BlockTitleBadge>
          {warmup!.note.trim() ? (
            <p
              className={cn(
                'mt-2 whitespace-pre-wrap text-xs leading-snug',
                chalkboard ? 'text-zinc-400' : 'text-foreground/90',
              )}
            >
              {warmup!.note.trim()}
            </p>
          ) : null}
          <MovementList lines={warmup!.exercises} chalkboard={chalkboard} />
        </div>
      ) : null}

      <div className="space-y-2.5">
        {draft.subtype === 'amrap' ? (
          <>
            {draft.blocks.map((b, i) => (
              <div key={b.id} className={chalkboardBlockShell(chalkboard)}>
                <BlockTitleBadge chalkboard={chalkboard}>
                  <span>AMRAP {i + 1}</span>
                  <BadgeTimeParen
                    durationRaw={amrapBlockDurationSource(
                      b.duration,
                      draft.global_amraps_total_time,
                      i,
                    )}
                    chalkboard={chalkboard}
                  />
                </BlockTitleBadge>
                <MovementList lines={b.exercises} chalkboard={chalkboard} />
              </div>
            ))}
          </>
        ) : null}

        {draft.subtype === 'emom' ? (
          <div className={chalkboardBlockShell(chalkboard)}>
            <BlockTitleBadge chalkboard={chalkboard}>
              <span>EMOM</span>
              <BadgeTimeParen durationRaw={draft.total_emom_time} chalkboard={chalkboard} />
            </BlockTitleBadge>
            <MovementList lines={draft.exercises} chalkboard={chalkboard} />
          </div>
        ) : null}

        {draft.subtype === 'for_time' ? (
          <div className={chalkboardBlockShell(chalkboard)}>
            <BlockTitleBadge chalkboard={chalkboard}>
              <span>For time</span>
              <BadgeTimeParen durationRaw={draft.time_cap} chalkboard={chalkboard} />
              {draft.rounds_to_complete.trim() ? (
                <span
                  className={cn(
                    'font-extrabold tracking-normal tabular-nums',
                    chalkboard
                      ? 'font-mono text-zinc-100'
                      : 'text-foreground [font-variant-numeric:lining-nums]',
                  )}
                >
                  {' '}
                  · {draft.rounds_to_complete.trim().toUpperCase()} VUELTAS
                </span>
              ) : null}
            </BlockTitleBadge>
            <MovementList lines={draft.exercises} chalkboard={chalkboard} />
          </div>
        ) : null}

        {draft.subtype === 'classic_benchmark_tabata' ? (
          <div className={chalkboardBlockShell(chalkboard)}>
            <BlockTitleBadge chalkboard={chalkboard}>
              <span>Clásico / benchmark / tabata</span>
              <BadgeTimeParen durationRaw={draft.target_time} chalkboard={chalkboard} />
            </BlockTitleBadge>
            <MovementList lines={draft.exercises} chalkboard={chalkboard} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function functionalPhaseDetailLines(phase: FunctionalPhaseDraft): string[] {
  switch (phase.method) {
    case 'free':
      return phase.note.trim() ? [phase.note.trim()] : [];
    case 'rounds_circuit':
      return [];
    case 'time_intervals':
      return [];
    case 'tabata': {
      const n = phase.tabata_note.trim();
      return n ? [n] : [];
    }
    default:
      return [];
  }
}

function FunctionalPhasePreview({
  phase,
  index,
  chalkboard,
}: {
  phase: FunctionalPhaseDraft;
  index: number;
  chalkboard?: boolean;
}) {
  const phaseLabel = FUNCTIONAL_PHASE_LABELS.find((x) => x.id === phase.phase_type)?.label ?? '';
  const methodLabel = FUNCTIONAL_METHOD_LABELS.find((x) => x.id === phase.method)?.label ?? '';
  const detailLines = functionalPhaseDetailLines(phase);
  const durationInTitle = functionalPhaseDurationParen(phase);

  return (
    <div
      className={cn(
        chalkboard
          ? 'border-b border-dashed border-zinc-800 py-4 last:border-b-0'
          : cn(
              'rounded-xl border border-border/50 bg-muted/20 p-3 dark:bg-muted/15',
              "[html[data-brand='pink']_&]:border-[#ff007f]/25 dark:[html[data-brand='pink']_&]:border-pink-700/35",
            ),
      )}
    >
      <BlockTitleBadge chalkboard={chalkboard}>
        <span>
          Fase {index + 1} · {(phaseLabel || 'Fase').toUpperCase()}
        </span>
        {methodLabel.trim() ? (
          <span className={chalkboard ? 'text-zinc-400' : 'text-foreground/90'}>
            {' '}
            · {methodLabel.toUpperCase()}
          </span>
        ) : null}
        {durationInTitle ? (
          <span
            className={cn(
              'font-extrabold tracking-normal tabular-nums',
              chalkboard
                ? 'font-mono text-zinc-100'
                : 'text-foreground [font-variant-numeric:lining-nums]',
            )}
          >
            {durationInTitle}
          </span>
        ) : null}
      </BlockTitleBadge>
      {detailLines.length ? (
        <div className="mt-2 space-y-1">
          {detailLines.map((line, i) => (
            <p
              key={i}
              className={cn(
                'text-[11px] leading-snug',
                chalkboard ? 'text-zinc-400' : 'text-muted-foreground',
              )}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}
      <MovementList lines={phase.exercises} chalkboard={chalkboard} />
    </div>
  );
}

function FunctionalRoutinePreview({
  draft,
  chalkboard,
}: {
  draft: FunctionalSessionDraft;
  chalkboard?: boolean;
}) {
  const sessionTitle = draft.session_name.trim();
  const sessionTime = draft.total_session_time.trim();

  return (
    <div className="space-y-2.5 text-sm">
      {sessionTitle || sessionTime ? (
        <BlockTitleBadge chalkboard={chalkboard}>
          <span>{sessionTitle ? sessionTitle.toUpperCase() : 'SESIÓN FUNCIONAL'}</span>
          {sessionTime ? <BadgeTimeParen durationRaw={sessionTime} chalkboard={chalkboard} /> : null}
        </BlockTitleBadge>
      ) : null}
      {draft.phases.map((p, i) => (
        <FunctionalPhasePreview key={p.id} phase={p} index={i} chalkboard={chalkboard} />
      ))}
    </div>
  );
}

export function GymRoutineBlockViewer({
  payload,
  title,
  dayNumber,
  coachNotes,
  hideDayBanner,
  hideCoachNotesSection,
  variant = 'default',
}: {
  payload: GymRoutineWorkoutPayload;
  title: string;
  dayNumber: number;
  coachNotes?: string | null;
  /** Oculta la franja «Día N» (p. ej. vista previa en Mis Rutinas). */
  hideDayBanner?: boolean;
  /** Oculta instrucciones del coach / estado vacío (p. ej. plantillas guardadas). */
  hideCoachNotesSection?: boolean;
  /** Estética de pizarra digital para la vista de detalle en Modo Gimnasio. */
  variant?: 'default' | 'chalkboard';
}) {
  const notes = coachNotes?.trim() ?? '';
  const titleTrim = title.trim();
  const chalkboard = variant === 'chalkboard';

  return (
    <div
      className={cn(
        chalkboard
          ? 'gym-chalkboard-panel rounded-2xl border border-zinc-800/50 bg-zinc-950 p-5 shadow-lg sm:p-6'
          : 'space-y-5',
      )}
    >
      {chalkboard ? (
        <h2 className="mb-5 text-center text-xs font-black uppercase tracking-widest text-primary">
          RUTINA DEL DÍA
        </h2>
      ) : null}

      {!hideDayBanner ? (
        <p
          className={cn(
            'text-center text-[11px] font-semibold uppercase tracking-[0.12em]',
            chalkboard ? 'mb-4 text-zinc-400' : 'text-muted-foreground',
          )}
        >
          Día {dayNumber}
        </p>
      ) : null}

      {!hideCoachNotesSection ? (
        notes ? (
          <div
            className={cn(
              chalkboard
                ? 'mb-4 border-b border-dashed border-zinc-800 pb-4'
                : 'workout-coach-notes-panel rounded-2xl border-2 border-primary/45 bg-primary/12 p-4 shadow-md dark:bg-primary/14',
            )}
          >
            <p
              className={cn(
                'text-center text-[11px] font-bold uppercase tracking-wide',
                chalkboard ? 'text-primary' : 'text-primary',
              )}
            >
              Instrucciones del coach
            </p>
            <p
              className={cn(
                'mt-3 whitespace-pre-wrap text-sm leading-relaxed',
                chalkboard ? 'text-zinc-400' : 'text-foreground',
              )}
            >
              {notes}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'text-center text-xs',
              chalkboard
                ? 'mb-4 border-b border-dashed border-zinc-800 pb-4 text-zinc-500'
                : 'rounded-xl border border-dashed border-border/60 bg-muted/10 px-3 py-3 text-muted-foreground',
            )}
          >
            Sin notas del coach para este día.
          </div>
        )
      ) : null}

      <div
        className={cn(
          'space-y-3',
          !chalkboard && 'border-t border-border/40 pt-4',
          chalkboard && !hideCoachNotesSection && 'pt-1',
        )}
      >
        <div
          className={cn(
            chalkboard && 'border-b border-dashed border-zinc-800 pb-4',
          )}
        >
          <p
            className={cn(
              'text-[11px] font-bold uppercase tracking-wide',
              chalkboard ? 'text-zinc-400' : 'text-primary',
            )}
          >
            Entrenamiento
          </p>
          {titleTrim ? (
            <h3
              className={cn(
                'mt-1 text-lg font-bold tracking-tight',
                chalkboard ? 'text-zinc-100' : 'text-foreground',
              )}
            >
              {titleTrim}
            </h3>
          ) : (
            <h3
              className={cn(
                'mt-1 text-lg font-bold tracking-tight',
                chalkboard ? 'text-zinc-100' : 'text-foreground',
              )}
            >
              Rutina del día
            </h3>
          )}
        </div>

        {payload.modality === 'crossfit' ? (
          <CrossfitRoutinePreview draft={payload.draft} chalkboard={chalkboard} />
        ) : payload.modality === 'funcional' ? (
          <FunctionalRoutinePreview draft={payload.draft} chalkboard={chalkboard} />
        ) : (
          <ul className="space-y-3">
            {payload.exercises
              .filter((e) => e.name.trim() || e.muscle_group.trim())
              .map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    chalkboard
                      ? 'border-b border-dashed border-zinc-800 pb-3 last:border-b-0'
                      : cn(
                          'rounded-xl border border-border/50 bg-card/80 px-4 py-3',
                          "[html[data-brand='pink']_&]:border-[#ff007f]/25 dark:[html[data-brand='pink']_&]:border-pink-700/35",
                        ),
                  )}
                >
                  <p className={cn('font-semibold', chalkboard ? 'text-zinc-100' : 'text-foreground')}>
                    {e.name.trim() || '—'}
                  </p>
                  <p className={cn('text-xs', chalkboard ? 'text-zinc-400' : 'text-muted-foreground')}>
                    {e.muscle_group.trim() || '—'}
                  </p>
                  {e.prescription_note ? (
                    <p
                      className={cn(
                        'mt-2 text-xs',
                        chalkboard
                          ? 'font-mono font-bold text-zinc-100'
                          : 'text-muted-foreground/90',
                      )}
                    >
                      {e.prescription_note}
                    </p>
                  ) : null}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
