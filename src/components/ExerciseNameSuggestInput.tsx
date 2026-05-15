import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  modalityToLibraryCategory,
  type ExerciseLibraryCategory,
} from '@/lib/exerciseLibraryNaming';
import { WORKOUT_LOG_INPUT } from '@/lib/workoutPanelSemantics';
import type { WorkoutModalityId } from '@/lib/workoutModality';

type Row = { name: string; muscle_group: string; category: ExerciseLibraryCategory };

type Props = {
  value: string;
  onChange: (v: string) => void;
  modality: WorkoutModalityId;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const DEBOUNCE_MS = 180;
const MAX_SUGGESTIONS = 12;
const FETCH_LIMIT = 48;

function normNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function dedupeGlobalRows(
  rows: { name: string; muscle_group: string; category: string | null }[],
): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const r of rows) {
    const kn = normNameKey(r.name);
    if (!kn || seen.has(kn)) continue;
    seen.add(kn);
    out.push({
      name: r.name.trim(),
      muscle_group: r.muscle_group?.trim() || '—',
      category: (r.category as ExerciseLibraryCategory) || 'Musculación',
    });
  }
  return out;
}

/** Prioriza categoría acorde a la pestaña activa; orden alfabético dentro de cada grupo. */
function prioritizeCategory(rows: Row[], preferred: ExerciseLibraryCategory): Row[] {
  const pref = rows.filter((r) => r.category === preferred).sort((a, b) => a.name.localeCompare(b.name));
  const rest = rows.filter((r) => r.category !== preferred).sort((a, b) => a.name.localeCompare(b.name));
  return [...pref, ...rest];
}

export function ExerciseNameSuggestInput({
  value,
  onChange,
  modality,
  placeholder,
  className,
  disabled,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeCategory = modalityToLibraryCategory(modality);

  const debouncedProbe = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (!user || debouncedProbe.length < 1) {
      setHits([]);
      setLoading(false);
      return;
    }
    const q = debouncedProbe;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      void (async () => {
        setLoading(true);
        const safe = q.replace(/%/g, '').replace(/_/g, '');
        const pattern = `%${safe}%`;
        const { data, error } = await supabase
          .from('exercises_library')
          .select('name, muscle_group, category')
          .ilike('name', pattern)
          .order('name')
          .limit(FETCH_LIMIT);
        if (error) {
          setHits([]);
          setOpen(false);
        } else {
          const deduped = dedupeGlobalRows(data ?? []);
          const ranked = prioritizeCategory(deduped, activeCategory).slice(0, MAX_SUGGESTIONS);
          setHits(ranked);
          setOpen(ranked.length > 0);
        }
        setLoading(false);
      })();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user, debouncedProbe, activeCategory]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <input
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && hits.length > 0}
        onFocus={() => {
          if (hits.length > 0) setOpen(true);
        }}
        className={cn(
          WORKOUT_LOG_INPUT,
          'flex h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none ring-offset-background',
          'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      />
      {loading && debouncedProbe.length >= 1 ? (
        <p className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          …
        </p>
      ) : null}
      {open && hits.length > 0 ? (
        <ul
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-border/80 bg-popover shadow-lg',
          )}
        >
          {hits.map((h) => (
            <li key={`${h.name}-${h.muscle_group}-${h.category}`} role="option">
              <button
                type="button"
                className={cn(
                  'flex w-full flex-col px-3 py-2 text-left text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(h.name);
                  setOpen(false);
                }}
              >
                <span className="truncate font-medium text-foreground">{h.name}</span>
                <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {h.muscle_group} · {h.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
