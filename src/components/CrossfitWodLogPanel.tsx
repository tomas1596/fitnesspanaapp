import * as React from 'react';
import { ChevronDown, Flame, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  type AmrapBlockDraft,
  type CrossfitLogDraft,
  type CrossfitWodSubtype,
  type ManualExerciseLine,
  emptyAmrapBlock,
  emptyCrossfitDraft,
  emptyManualLine,
  emptyWarmupSkillDraft,
  CROSSFIT_SUBTYPE_LABELS,
} from '@/lib/crossfitWodDraft';
import {
  WORKOUT_LOG_DIVIDER,
  WORKOUT_LOG_FIELD_LABEL,
  WORKOUT_LOG_GHOST_ACTION,
  WORKOUT_LOG_INNER_CARD,
  WORKOUT_LOG_INPUT,
  WORKOUT_LOG_LIST_SURFACE,
  WORKOUT_LOG_PANEL_SHELL,
  WORKOUT_LOG_RESULT_INPUT_CLASSIC,
  WORKOUT_LOG_RESULT_INPUT_FOR_TIME,
  WORKOUT_LOG_RESULT_LABEL_CLASSIC,
  WORKOUT_LOG_RESULT_LABEL_FOR_TIME,
  WORKOUT_LOG_RESULT_WRAP_CLASSIC,
  WORKOUT_LOG_RESULT_WRAP_FOR_TIME,
  WORKOUT_LOG_SAVE_BTN,
  WORKOUT_LOG_SECONDARY_BTN,
  WORKOUT_LOG_SUBTYPE_PILL_ACTIVE,
  WORKOUT_LOG_SUBTYPE_PILL_IDLE,
} from '@/lib/workoutPanelSemantics';

type Props = {
  draft: CrossfitLogDraft;
  onChange: (next: CrossfitLogDraft) => void;
  onSubtypeChange?: (subtype: CrossfitWodSubtype, nextDraft: CrossfitLogDraft) => void;
  onAmrapBlockRemoved?: (removedBlockId: string, nextBlocks: AmrapBlockDraft[]) => void;
  onSave: () => void;
  saving?: boolean;
  className?: string;
};

function ManualExerciseEditor({
  lines,
  onLinesChange,
  placeholder,
}: {
  lines: ManualExerciseLine[];
  onLinesChange: (next: ManualExerciseLine[]) => void;
  placeholder?: string;
}) {
  const [pending, setPending] = React.useState('');
  const add = () => {
    const t = pending.trim();
    if (!t) return;
    onLinesChange([...lines, { ...emptyManualLine(), name: t }]);
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
        <p className="text-[11px] text-muted-foreground">Aún no hay ejercicios en este bloque.</p>
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
        <Button
          type="button"
          variant="secondary"
          className={WORKOUT_LOG_SECONDARY_BTN}
          onClick={add}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}

export function CrossfitWodLogPanel({
  draft,
  onChange,
  onSubtypeChange,
  onAmrapBlockRemoved,
  onSave,
  saving,
  className,
}: Props) {
  const switchSubtype = (s: CrossfitWodSubtype) => {
    if (draft.subtype === s) return;
    const name = draft.wod_name;
    const warm = draft.warmup_skill;
    const next = emptyCrossfitDraft(s);
    next.wod_name = name;
    next.warmup_skill = warm;
    onSubtypeChange?.(s, next);
    onChange(next);
  };

  const patchWarmup = (ws: NonNullable<CrossfitLogDraft['warmup_skill']>) => {
    onChange({ ...draft, warmup_skill: ws });
  };

  const formWrap = 'animate-in fade-in duration-200';

  return (
    <div className={cn(WORKOUT_LOG_PANEL_SHELL, className)}>
      <div>
        <h4 className="text-sm font-semibold tracking-tight text-foreground">Registro CrossFit</h4>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Calentamiento o técnica opcional, luego el formato del WOD principal. También puedes usar las tarjetas de
          abajo.
        </p>
      </div>

      <div className="space-y-1">
        <label className={WORKOUT_LOG_FIELD_LABEL}>Nombre del WOD</label>
        <Input
          value={draft.wod_name}
          onChange={(e) => onChange({ ...draft, wod_name: e.target.value })}
          className={WORKOUT_LOG_INPUT}
          placeholder="Ej. Hero WOD Murph"
        />
      </div>

      {draft.warmup_skill === null ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(WORKOUT_LOG_GHOST_ACTION, 'h-9 w-full justify-center rounded-xl border border-dashed border-border/70 bg-secondary/50')}
          onClick={() => onChange({ ...draft, warmup_skill: emptyWarmupSkillDraft() })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Añadir Calentamiento o Técnica
        </Button>
      ) : (
        <Collapsible defaultOpen className="group overflow-hidden rounded-xl border border-border bg-secondary">
          <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-accent/40">
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold text-foreground',
                "[html[data-brand='pink']_&]:text-fuchsia-300 dark:[html[data-brand='pink']_&]:text-fuchsia-200",
              )}
            >
              <Flame
                className="h-3.5 w-3.5 shrink-0 text-orange-500 opacity-90 dark:text-orange-400 [html[data-brand='pink']_&]:text-fuchsia-400 dark:[html[data-brand='pink']_&]:text-fuchsia-300"
                aria-hidden
              />
              Calentamiento / Técnica
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border/60 px-3 pb-3 pt-2 dark:border-border/50">
            <div className="space-y-1">
              <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios (manual)</label>
              <ManualExerciseEditor
                lines={draft.warmup_skill.exercises}
                onLinesChange={(exercises) => patchWarmup({ ...draft.warmup_skill!, exercises })}
                placeholder="Movilidad articular, jumping jacks…"
              />
            </div>
            <div className="mt-3 space-y-1">
              <label className={WORKOUT_LOG_FIELD_LABEL}>Notas (opcional)</label>
              <Textarea
                value={draft.warmup_skill.note}
                onChange={(e) => patchWarmup({ ...draft.warmup_skill!, note: e.target.value })}
                className={cn(WORKOUT_LOG_INPUT, 'min-h-[68px] resize-y py-2')}
                placeholder='Ej. Movilidad de hombros y 3 rondas de 10 burpees'
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-8 w-full text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange({ ...draft, warmup_skill: null })}
            >
              Quitar calentamiento / técnica
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className={cn('flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', WORKOUT_LOG_DIVIDER)}>
        {CROSSFIT_SUBTYPE_LABELS.map(({ id, short }) => (
          <button
            key={id}
            type="button"
            onClick={() => switchSubtype(id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors',
              draft.subtype === id ? WORKOUT_LOG_SUBTYPE_PILL_ACTIVE : WORKOUT_LOG_SUBTYPE_PILL_IDLE,
            )}
          >
            {short}
          </button>
        ))}
      </div>

      {draft.subtype === 'amrap' && (
        <div key="amrap" className={formWrap}>
          <div className="space-y-1">
            <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo total de los AMRAPs (opcional)</label>
            <Input
              value={draft.global_amraps_total_time}
              onChange={(e) => onChange({ ...draft, global_amraps_total_time: e.target.value })}
              className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
              placeholder="ej. 15 min total"
            />
          </div>

          <div className={cn('space-y-3', WORKOUT_LOG_DIVIDER)}>
            <div className="flex items-center justify-between gap-2">
              <span className={WORKOUT_LOG_FIELD_LABEL}>AMRAPs</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={WORKOUT_LOG_GHOST_ACTION}
                onClick={() =>
                  onChange({
                    ...draft,
                    blocks: [...draft.blocks, emptyAmrapBlock()],
                  })
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Añadir AMRAP
              </Button>
            </div>

            {draft.blocks.map((block, index) => (
              <div
                key={block.id}
                className={WORKOUT_LOG_INNER_CARD}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">AMRAP {index + 1}</span>
                  {draft.blocks.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const removedId = block.id;
                        let nextBlocks = draft.blocks.filter((b) => b.id !== removedId);
                        if (nextBlocks.length === 0) nextBlocks = [emptyAmrapBlock()];
                        onAmrapBlockRemoved?.(removedId, nextBlocks);
                        onChange({ ...draft, blocks: nextBlocks });
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Quitar AMRAP"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo del AMRAP</label>
                  <Input
                    value={block.duration}
                    onChange={(e) => {
                      const blocks = draft.blocks.map((b, i) =>
                        i === index ? { ...b, duration: e.target.value } : b,
                      );
                      onChange({ ...draft, blocks });
                    }}
                    className={WORKOUT_LOG_INPUT}
                    placeholder="ej. 5 min"
                  />
                </div>
                <div className="mt-3 space-y-1">
                  <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios (manual)</label>
                  <ManualExerciseEditor
                    lines={block.exercises}
                    onLinesChange={(exercises) => {
                      const blocks = draft.blocks.map((b, i) => (i === index ? { ...b, exercises } : b));
                      onChange({ ...draft, blocks });
                    }}
                    placeholder="Thrusters, Pull-ups…"
                  />
                </div>
                <div className="mt-3 space-y-1">
                  <label className={WORKOUT_LOG_FIELD_LABEL}>Rondas / vueltas logradas</label>
                  <Input
                    value={block.rounds_completed}
                    onChange={(e) => {
                      const blocks = draft.blocks.map((b, i) =>
                        i === index ? { ...b, rounds_completed: e.target.value } : b,
                      );
                      onChange({ ...draft, blocks });
                    }}
                    className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
                    placeholder="ej. 8"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {draft.subtype === 'emom' && (
        <div key="emom" className={formWrap}>
          <div className="space-y-1">
            <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo total del EMOM</label>
            <Input
              value={draft.total_emom_time}
              onChange={(e) => onChange({ ...draft, total_emom_time: e.target.value })}
              className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
              placeholder="ej. 10 min"
            />
          </div>
          <div className={cn('space-y-1', WORKOUT_LOG_DIVIDER)}>
            <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios por minuto (manual)</label>
            <ManualExerciseEditor
              lines={draft.exercises}
              onLinesChange={(exercises) => onChange({ ...draft, exercises })}
              placeholder="Movimiento que toca cada minuto…"
            />
          </div>
        </div>
      )}

      {draft.subtype === 'for_time' && (
        <div key="for_time" className={formWrap}>
          <div className="space-y-1">
            <label className={WORKOUT_LOG_FIELD_LABEL}>Time cap / tiempo límite (opcional)</label>
            <Input
              value={draft.time_cap}
              onChange={(e) => onChange({ ...draft, time_cap: e.target.value })}
              className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
              placeholder="ej. 20 min cap"
            />
          </div>
          <div className={cn('space-y-1', WORKOUT_LOG_DIVIDER)}>
            <label className={WORKOUT_LOG_FIELD_LABEL}>Cantidad de vueltas / rondas</label>
            <Input
              value={draft.rounds_to_complete}
              onChange={(e) => onChange({ ...draft, rounds_to_complete: e.target.value })}
              className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
              placeholder="ej. 5 rondas"
            />
          </div>
          <div className="space-y-1">
            <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios (manual)</label>
            <ManualExerciseEditor lines={draft.exercises} onLinesChange={(exercises) => onChange({ ...draft, exercises })} />
          </div>
          <div className={WORKOUT_LOG_RESULT_WRAP_FOR_TIME}>
            <label className={WORKOUT_LOG_RESULT_LABEL_FOR_TIME}>Tiempo real de finalización</label>
            <Input
              value={draft.final_time}
              onChange={(e) => onChange({ ...draft, final_time: e.target.value })}
              className={cn(WORKOUT_LOG_RESULT_INPUT_FOR_TIME, 'text-foreground')}
              placeholder="ej. 14:32"
            />
          </div>
        </div>
      )}

      {draft.subtype === 'classic_benchmark_tabata' && (
        <div key="classic" className={formWrap}>
          <div className="space-y-1">
            <label className={WORKOUT_LOG_FIELD_LABEL}>Tiempo objetivo (opcional)</label>
            <Input
              value={draft.target_time}
              onChange={(e) => onChange({ ...draft, target_time: e.target.value })}
              className={cn(WORKOUT_LOG_INPUT, 'font-mono tabular-nums')}
              placeholder="ej. 12 min"
            />
          </div>
          <div className={cn('space-y-1', WORKOUT_LOG_DIVIDER)}>
            <label className={WORKOUT_LOG_FIELD_LABEL}>Ejercicios (manual)</label>
            <ManualExerciseEditor lines={draft.exercises} onLinesChange={(exercises) => onChange({ ...draft, exercises })} />
          </div>
          <div className={WORKOUT_LOG_RESULT_WRAP_CLASSIC}>
            <label className={WORKOUT_LOG_RESULT_LABEL_CLASSIC}>Tiempo real</label>
            <Input
              value={draft.final_real_time}
              onChange={(e) => onChange({ ...draft, final_real_time: e.target.value })}
              className={cn(WORKOUT_LOG_RESULT_INPUT_CLASSIC, 'text-foreground')}
              placeholder="Cuánto tardaste"
            />
          </div>
        </div>
      )}

      <Button
        type="button"
        disabled={saving}
        onClick={onSave}
        className={WORKOUT_LOG_SAVE_BTN}
      >
        {saving ? 'Guardando…' : 'Guardar registro'}
      </Button>
    </div>
  );
}

export function defaultCrossfitDraft() {
  return emptyCrossfitDraft('amrap');
}
