import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { newConditioningBlockId } from '@/lib/workoutModality';
import type { FunctionalExerciseLine } from '@/lib/functionalSessionDraft';
import {
  emptyFunctionalPhase,
  emptyFunctionalSessionDraft,
  FUNCTIONAL_METHOD_LABELS,
  FUNCTIONAL_PHASE_LABELS,
  functionalPhaseWithMethod,
  type FunctionalExecutionMethod,
  type FunctionalPhaseDraft,
  type FunctionalPhaseType,
  type FunctionalSessionDraft,
} from '@/lib/functionalSessionDraft';
import {
  WORKOUT_LOG_DIVIDER,
  WORKOUT_LOG_FIELD_LABEL,
  WORKOUT_LOG_GHOST_ACTION,
  WORKOUT_LOG_INNER_CARD,
  WORKOUT_LOG_INPUT,
  WORKOUT_LOG_LIST_SURFACE,
  WORKOUT_LOG_PANEL_SHELL,
  WORKOUT_LOG_SAVE_BTN,
  WORKOUT_LOG_SECONDARY_BTN,
} from '@/lib/workoutPanelSemantics';

type Props = {
  draft: FunctionalSessionDraft;
  onChange: (next: FunctionalSessionDraft) => void;
  onPhaseRemoved?: (removedPhaseId: string, nextPhases: FunctionalPhaseDraft[]) => void;
  onSave: () => void;
  saving?: boolean;
  className?: string;
};

const PHASE_CARD_BORDER: Record<FunctionalPhaseType, string> = {
  warmup:
    "border-l-4 border-l-emerald-500 pl-3 dark:border-l-emerald-400 [html[data-brand='pink']_&]:border-l-emerald-600 [html[data-brand='pink']_&]:dark:border-l-emerald-300",
  main:
    "border-l-4 border-l-red-500 pl-3 dark:border-l-red-400 [html[data-brand='pink']_&]:border-l-rose-600 [html[data-brand='pink']_&]:dark:border-l-rose-400",
  core:
    "border-l-4 border-l-orange-500 pl-3 dark:border-l-orange-400 [html[data-brand='pink']_&]:border-l-orange-600 [html[data-brand='pink']_&]:dark:border-l-orange-300",
  cooldown:
    "border-l-4 border-l-sky-500 pl-3 dark:border-l-sky-400 [html[data-brand='pink']_&]:border-l-sky-600 [html[data-brand='pink']_&]:dark:border-l-sky-300",
};

const selectTriggerClass = cn(
  WORKOUT_LOG_INPUT,
  'flex h-11 w-full items-center justify-between px-3 py-2 text-left [&>span]:line-clamp-1',
);

function newManualLine(): FunctionalExerciseLine {
  return { id: newConditioningBlockId(), name: '' };
}

function ManualExerciseListEditor({
  lines,
  onLinesChange,
  placeholder,
}: {
  lines: FunctionalExerciseLine[];
  onLinesChange: (next: FunctionalExerciseLine[]) => void;
  placeholder?: string;
}) {
  const [pending, setPending] = React.useState('');
  const add = () => {
    const t = pending.trim();
    if (!t) return;
    onLinesChange([...lines, { ...newManualLine(), name: t }]);
    setPending('');
  };
  const removeAt = (i: number) => {
    onLinesChange(lines.filter((_, idx) => idx !== i));
  };
  return (
    <div className="space-y-2">
      {lines.length > 0 ? (
        <ul className={WORKOUT_LOG_LIST_SURFACE}>
          {lines.map((line, i) => (
            <li key={line.id} className="flex items-center gap-2 text-sm text-foreground">
              <span className="min-w-0 flex-1 truncate">{line.name}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Quitar ejercicio"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">Sin ejercicios en esta fase.</p>
      )}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder ?? 'Ejercicio'}
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          className={cn(WORKOUT_LOG_INPUT, 'h-10 flex-1')}
        />
        <Button type="button" variant="secondary" className={WORKOUT_LOG_SECONDARY_BTN} onClick={add}>
          Añadir
        </Button>
      </div>
    </div>
  );
}

export function FunctionalSessionLogPanel({
  draft,
  onChange,
  onPhaseRemoved,
  onSave,
  saving,
  className,
}: Props) {
  const patchPhase = React.useCallback(
    (id: string, fn: (p: FunctionalPhaseDraft) => FunctionalPhaseDraft) => {
      onChange({
        ...draft,
        phases: draft.phases.map((p) => (p.id === id ? fn(p) : p)),
      });
    },
    [draft, onChange],
  );

  const addPhase = () => {
    onChange({
      ...draft,
      phases: [...draft.phases, emptyFunctionalPhase('free')],
    });
  };

  const removePhase = (id: string) => {
    const next = draft.phases.filter((p) => p.id !== id);
    onPhaseRemoved?.(id, next);
    onChange({ ...draft, phases: next });
  };

  const formWrap = 'animate-in fade-in duration-200';

  return (
    <div className={cn(WORKOUT_LOG_PANEL_SHELL, className)}>
      <div>
        <h4 className="text-sm font-semibold tracking-tight text-foreground">Sesión funcional</h4>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Organiza por fases (calentamiento, principal, core, enfriamiento) y método de trabajo. Sin formatos de
          CrossFit.
        </p>
      </div>

      <div className="space-y-1">
        <label className={WORKOUT_LOG_FIELD_LABEL}>Nombre de la sesión</label>
        <Input
          value={draft.session_name}
          onChange={(e) => onChange({ ...draft, session_name: e.target.value })}
          className={WORKOUT_LOG_INPUT}
          placeholder="Ej. Funcional full body"
        />
      </div>

      <div className="space-y-1">
        <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo total de la sesión (opcional)</label>
        <Input
          value={draft.total_session_time}
          onChange={(e) => onChange({ ...draft, total_session_time: e.target.value })}
          className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
          placeholder="ej. 50 min"
        />
      </div>

      <div className={cn('flex flex-wrap items-center justify-between gap-2', WORKOUT_LOG_DIVIDER)}>
        <span className={WORKOUT_LOG_FIELD_LABEL}>Fases</span>
        <Button type="button" variant="ghost" size="sm" className={WORKOUT_LOG_GHOST_ACTION} onClick={addPhase}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Añadir fase
        </Button>
      </div>

      {draft.phases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-3 py-4 text-center text-xs text-muted-foreground dark:bg-muted/10">
          Aún no hay fases. Usa «Añadir fase» para crear calentamiento, bloque principal, core o enfriamiento.
        </p>
      ) : (
        <div className="space-y-4">
          {draft.phases.map((phase, phaseIndex) => (
            <div
              key={phase.id}
              className={cn(WORKOUT_LOG_INNER_CARD, PHASE_CARD_BORDER[phase.phase_type], formWrap)}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">Fase {phaseIndex + 1}</span>
                <button
                  type="button"
                  onClick={() => removePhase(phase.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Quitar fase"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={WORKOUT_LOG_FIELD_LABEL}>Tipo de fase</label>
                  <Select
                    value={phase.phase_type}
                    onValueChange={(v) =>
                      patchPhase(phase.id, (p) => ({ ...p, phase_type: v as FunctionalPhaseType }))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {FUNCTIONAL_PHASE_LABELS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className={WORKOUT_LOG_FIELD_LABEL}>Método de ejecución</label>
                  <Select
                    value={phase.method}
                    onValueChange={(v) =>
                      patchPhase(phase.id, (p) => functionalPhaseWithMethod(p, v as FunctionalExecutionMethod))
                    }
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-popover text-popover-foreground">
                      {FUNCTIONAL_METHOD_LABELS.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={cn('mt-3 space-y-3 border-t border-border/60 pt-3 dark:border-border/50')}>
                {phase.method === 'free' && (
                  <>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios</label>
                      <ManualExerciseListEditor
                        lines={phase.exercises}
                        onLinesChange={(exercises) =>
                          patchPhase(phase.id, (p) => (p.method === 'free' ? { ...p, exercises } : p))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Nota (opcional)</label>
                      <Textarea
                        value={phase.note}
                        onChange={(e) =>
                          patchPhase(phase.id, (p) => (p.method === 'free' ? { ...p, note: e.target.value } : p))
                        }
                        className={cn(WORKOUT_LOG_INPUT, 'min-h-[72px] resize-y py-2')}
                        placeholder="Movilidad, técnica ligera, etc."
                      />
                    </div>
                  </>
                )}

                {phase.method === 'rounds_circuit' && (
                  <>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Cantidad de rondas</label>
                      <Input
                        value={phase.round_count}
                        onChange={(e) =>
                          patchPhase(phase.id, (p) =>
                            p.method === 'rounds_circuit' ? { ...p, round_count: e.target.value } : p,
                          )
                        }
                        className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
                        placeholder="ej. 4"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios del circuito</label>
                      <ManualExerciseListEditor
                        lines={phase.exercises}
                        onLinesChange={(exercises) =>
                          patchPhase(phase.id, (p) =>
                            p.method === 'rounds_circuit' ? { ...p, exercises } : p,
                          )
                        }
                      />
                    </div>
                  </>
                )}

                {phase.method === 'time_intervals' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo trabajo</label>
                        <Input
                          value={phase.work_time}
                          onChange={(e) =>
                            patchPhase(phase.id, (p) =>
                              p.method === 'time_intervals' ? { ...p, work_time: e.target.value } : p,
                            )
                          }
                          className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
                          placeholder="45 s"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo descanso</label>
                        <Input
                          value={phase.rest_time}
                          onChange={(e) =>
                            patchPhase(phase.id, (p) =>
                              p.method === 'time_intervals' ? { ...p, rest_time: e.target.value } : p,
                            )
                          }
                          className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
                          placeholder="15 s"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={WORKOUT_LOG_FIELD_LABEL}>Vueltas / tandas</label>
                        <Input
                          value={phase.rounds}
                          onChange={(e) =>
                            patchPhase(phase.id, (p) =>
                              p.method === 'time_intervals' ? { ...p, rounds: e.target.value } : p,
                            )
                          }
                          className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
                          placeholder="ej. 8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios</label>
                      <ManualExerciseListEditor
                        lines={phase.exercises}
                        onLinesChange={(exercises) =>
                          patchPhase(phase.id, (p) =>
                            p.method === 'time_intervals' ? { ...p, exercises } : p,
                          )
                        }
                      />
                    </div>
                  </>
                )}

                {phase.method === 'tabata' && (
                  <>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      Formato estándar: <span className="font-medium text-foreground">20 s trabajo</span> ·{' '}
                      <span className="font-medium text-foreground">10 s descanso</span> ·{' '}
                      <span className="font-medium text-foreground">8 rondas</span>.
                    </p>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios</label>
                      <ManualExerciseListEditor
                        lines={phase.exercises}
                        onLinesChange={(exercises) =>
                          patchPhase(phase.id, (p) => (p.method === 'tabata' ? { ...p, exercises } : p))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className={WORKOUT_LOG_FIELD_LABEL}>Nota opcional (variantes)</label>
                      <Input
                        value={phase.tabata_note}
                        onChange={(e) =>
                          patchPhase(phase.id, (p) =>
                            p.method === 'tabata' ? { ...p, tabata_note: e.target.value } : p,
                          )
                        }
                        className={WORKOUT_LOG_INPUT}
                        placeholder="Ej. dos movimientos alternados"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" disabled={saving} onClick={onSave} className={WORKOUT_LOG_SAVE_BTN}>
        {saving ? 'Guardando…' : 'Guardar registro'}
      </Button>
    </div>
  );
}

export function defaultFunctionalSessionDraft(): FunctionalSessionDraft {
  return emptyFunctionalSessionDraft();
}
