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
const PER_QUERY = 8;

function mergePriorityRows(primary: Row[], secondary: Row[]): Row[] {
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const r of [...primary, ...secondary]) {
    const k = r.name.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
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
        const [{ data: sameCat, error: e1 }, { data: otherCat, error: e2 }] = await Promise.all([
          supabase
            .from('exercises_library')
            .select('name, muscle_group, category')
            .eq('user_id', user.id)
            .eq('category', activeCategory)
            .ilike('name', pattern)
            .order('name')
            .limit(PER_QUERY),
          supabase
            .from('exercises_library')
            .select('name, muscle_group, category')
            .eq('user_id', user.id)
            .neq('category', activeCategory)
            .ilike('name', pattern)
            .order('name')
            .limit(PER_QUERY),
        ]);
        if (e1 || e2) {
          setHits([]);
          setOpen(false);
        } else {
          const mapRow = (r: {
            name: string;
            muscle_group: string;
            category: string | null;
          }): Row => ({
            name: r.name,
            muscle_group: r.muscle_group,
            category: (r.category as ExerciseLibraryCategory) || 'Musculación',
          });
          const prim = (sameCat ?? []).map(mapRow);
          const sec = (otherCat ?? []).map(mapRow);
          const rows = mergePriorityRows(prim, sec);
          setHits(rows);
          setOpen(rows.length > 0);
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
                <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{h.muscle_group}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
