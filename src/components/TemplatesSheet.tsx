import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronRight, ChevronLeft, Play, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import SwipeToDelete from '@/components/SwipeToDelete';

const MUSCLE_GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Brazos', 'Hombros', 'Core'];

interface Template {
  id: string;
  name: string;
}
interface TemplateExercise {
  id: string;
  name: string;
  muscle_group: string;
}
interface DraftExercise {
  name: string;
  muscle_group: string;
}
interface LibraryExercise {
  id: string;
  name: string;
  muscle_group: string;
}

interface TemplatesSheetProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (exercises: TemplateExercise[]) => Promise<void>;
  onAddExercise: (name: string, muscleGroup: string) => void;
}

const TemplatesSheet = ({ open, onClose, onApplyTemplate, onAddExercise }: TemplatesSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Top-level tab ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'routines' | 'library'>('routines');

  // ── Routines tab state ──────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Template[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selected, setSelected] = useState<Template | null>(null);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [newName, setNewName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [exName, setExName] = useState('');
  const [exGroup, setExGroup] = useState('');

  // ── Library tab state ──────────────────────────────────────────────────────
  const [libraryExercises, setLibraryExercises] = useState<LibraryExercise[]>([]);
  const [libraryHistory, setLibraryHistory] = useState<Record<string, { weight: number; reps: number }>>({});
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Load routines ──────────────────────────────────────────────────────────
  const loadTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  };

  // ── Load library ──────────────────────────────────────────────────────────
  const loadLibrary = async () => {
    if (!user) return;
    setLibraryLoading(true);
    const { data } = await supabase
      .from('exercises_library')
      .select('id, name, muscle_group')
      .eq('user_id', user.id)
      .order('name');
    const items = data || [];
    setLibraryExercises(items);

    if (items.length > 0) {
      const history = await fetchLibraryHistory(items.map((e) => e.name));
      setLibraryHistory(history);
    }
    setLibraryLoading(false);
  };

  const fetchLibraryHistory = async (
    names: string[],
  ): Promise<Record<string, { weight: number; reps: number }>> => {
    if (!user || names.length === 0) return {};
    const { data: exData } = await supabase
      .from('exercises')
      .select('id, name, workout_date')
      .eq('user_id', user.id)
      .in('name', names)
      .order('workout_date', { ascending: false });

    if (!exData?.length) return {};

    const latestIdByName = new Map<string, string>();
    for (const ex of exData) {
      if (!latestIdByName.has(ex.name)) latestIdByName.set(ex.name, ex.id);
    }

    const ids = [...latestIdByName.values()];
    const { data: setsData } = await supabase
      .from('exercise_sets')
      .select('exercise_id, weight, reps')
      .in('exercise_id', ids)
      .order('set_number', { ascending: false });

    const result: Record<string, { weight: number; reps: number }> = {};
    for (const [name, exId] of latestIdByName.entries()) {
      const lastSet = setsData?.find((s) => s.exercise_id === exId);
      if (lastSet && (lastSet.weight > 0 || lastSet.reps > 0)) {
        result[name] = { weight: Number(lastSet.weight), reps: lastSet.reps };
      }
    }
    return result;
  };

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      loadTemplates();
      setView('list');
      setSelected(null);
      setExercises([]);
      setNewName('');
      setDraftExercises([]);
      setExName('');
      setExGroup('');
      setSearchQuery('');
      setActiveFilter('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  useEffect(() => {
    if (open && activeTab === 'library') {
      loadLibrary();
      setTimeout(() => searchRef.current?.focus(), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // ── Routines helpers ──────────────────────────────────────────────────────
  const openTemplate = async (t: Template) => {
    setSelected(t);
    const { data } = await supabase
      .from('template_exercises')
      .select('id, name, muscle_group')
      .eq('template_id', t.id)
      .order('position');
    setExercises(data || []);
    setView('detail');
  };

  const addDraftExercise = () => {
    if (!exName.trim() || !exGroup) return;
    setDraftExercises((prev) => [...prev, { name: exName.trim(), muscle_group: exGroup }]);
    setExName('');
    setExGroup('');
  };

  const removeDraftExercise = (idx: number) =>
    setDraftExercises((prev) => prev.filter((_, i) => i !== idx));

  const saveTemplate = async () => {
    if (!user || !newName.trim()) return;
    if (draftExercises.length === 0) {
      toast({ title: 'Plantilla vacía', description: 'Agrega al menos un ejercicio.' });
      return;
    }
    const { data: tpl, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: user.id, name: newName.trim() })
      .select()
      .single();
    if (error || !tpl) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      return;
    }
    const rows = draftExercises.map((ex, i) => ({
      user_id: user.id,
      template_id: tpl.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      position: i,
    }));
    const { error: exErr } = await supabase.from('template_exercises').insert(rows);
    if (exErr) {
      toast({ title: 'Error', description: exErr.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Plantilla creada', description: `${rows.length} ejercicios guardados.` });
    setNewName('');
    setDraftExercises([]);
    setView('list');
    loadTemplates();
  };

  const addExerciseToTemplate = async () => {
    if (!user || !selected || !exName.trim() || !exGroup) return;
    const { data, error } = await supabase
      .from('template_exercises')
      .insert({
        user_id: user.id,
        template_id: selected.id,
        name: exName.trim(),
        muscle_group: exGroup,
        position: exercises.length,
      })
      .select()
      .single();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setExercises((prev) => [...prev, data]);
    setExName('');
    setExGroup('');
  };

  const removeExerciseFromTemplate = async (id: string) => {
    await supabase.from('template_exercises').delete().eq('id', id);
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('workout_templates').delete().eq('id', id);
    loadTemplates();
  };

  const applyTemplate = async () => {
    if (exercises.length === 0) {
      toast({ title: 'Plantilla vacía', description: 'Agrega ejercicios primero.' });
      return;
    }
    await onApplyTemplate(exercises);
    onClose();
  };

  // ── Library helpers ────────────────────────────────────────────────────────
  const filteredLibrary = libraryExercises.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = activeFilter === '' || ex.muscle_group === activeFilter;
    return matchSearch && matchFilter;
  });

  const handleAddFromLibrary = (ex: LibraryExercise) => {
    onAddExercise(ex.name, ex.muscle_group);
    toast({ title: ex.name, description: 'Agregado a tu sesión' });
    onClose();
  };

  const deleteFromLibrary = async (id: string) => {
    if (!user) return;
    // user_id guard in the WHERE clause matches the RLS policy
    await supabase
      .from('exercises_library')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    setLibraryExercises((prev) => prev.filter((e) => e.id !== id));
    setLibraryHistory((prev) => {
      const next = { ...prev };
      const name = libraryExercises.find((e) => e.id === id)?.name;
      if (name) delete next[name];
      return next;
    });
  };

  // ── Shared tab pill style ──────────────────────────────────────────────────
  const tabCls = (tab: 'routines' | 'library') =>
    cn(
      'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors',
      activeTab === tab
        ? 'text-black'
        : 'bg-transparent text-muted-foreground',
    );

  const routinesTitle =
    view === 'list' ? 'Mis Rutinas' : view === 'create' ? 'Nueva Plantilla' : selected?.name ?? '';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-none bg-background p-5"
      >
        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div
          className="mb-4 flex gap-1 rounded-2xl bg-card p-1"
          style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <button
            className={tabCls('routines')}
            style={activeTab === 'routines' ? { backgroundColor: 'var(--brand-color)' } : {}}
            onClick={() => setActiveTab('routines')}
          >
            Mis Rutinas
          </button>
          <button
            className={tabCls('library')}
            style={activeTab === 'library' ? { backgroundColor: 'var(--brand-color)' } : {}}
            onClick={() => setActiveTab('library')}
          >
            Mis Ejercicios
          </button>
        </div>

        {/* ══════════════ ROUTINES TAB ══════════════════════════════════════ */}
        {activeTab === 'routines' && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-left text-xl text-foreground">
                {view !== 'list' && (
                  <button onClick={() => setView('list')} className="rounded-lg p-1 hover:bg-accent">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {routinesTitle}
              </SheetTitle>
            </SheetHeader>

            {view === 'list' && (
              <div className="space-y-2">
                {templates.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No tienes plantillas todavía.
                  </p>
                )}
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl bg-card p-3">
                    <button
                      onClick={() => openTemplate(t)}
                      className="flex flex-1 items-center justify-between text-left"
                    >
                      <span className="font-medium text-foreground">{t.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button
                  onClick={() => setView('create')}
                  className="mt-3 h-12 w-full rounded-xl font-semibold"
                >
                  <Plus className="mr-1 h-4 w-4" /> Nueva Plantilla
                </Button>
              </div>
            )}

            {view === 'create' && (
              <div className="space-y-3">
                <Input
                  placeholder="Nombre (ej: Día de Pecho)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-14 rounded-xl border-none bg-accent text-foreground"
                  autoFocus
                />
                <div className="space-y-2">
                  {draftExercises.map((ex, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl bg-card p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{ex.name}</p>
                        <p className="text-xs text-muted-foreground">{ex.muscle_group}</p>
                      </div>
                      <button
                        onClick={() => removeDraftExercise(idx)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {draftExercises.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      Agrega los ejercicios que tendrá esta rutina.
                    </p>
                  )}
                </div>
                <div className="space-y-2 rounded-2xl bg-card p-3">
                  <Input
                    placeholder="Nombre del ejercicio"
                    value={exName}
                    onChange={(e) => setExName(e.target.value)}
                    className="h-12 rounded-xl border-none bg-accent text-foreground"
                  />
                  <Select value={exGroup} onValueChange={setExGroup}>
                    <SelectTrigger className="h-12 rounded-xl border-none bg-accent text-foreground">
                      <SelectValue placeholder="Grupo muscular" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      {MUSCLE_GROUPS.map((g) => (
                        <SelectItem
                          key={g}
                          value={g}
                          className="text-foreground focus:bg-accent focus:text-foreground"
                        >
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={addDraftExercise}
                    disabled={!exName.trim() || !exGroup}
                    variant="ghost"
                    className="h-10 w-full rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Agregar a la lista
                  </Button>
                </div>
                <Button
                  onClick={saveTemplate}
                  disabled={!newName.trim() || draftExercises.length === 0}
                  className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                >
                  Guardar plantilla
                </Button>
              </div>
            )}

            {view === 'detail' && selected && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {exercises.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between rounded-xl bg-card p-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{ex.name}</p>
                        <p className="text-xs text-muted-foreground">{ex.muscle_group}</p>
                      </div>
                      <button
                        onClick={() => removeExerciseFromTemplate(ex.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {exercises.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Sin ejercicios. Agrega abajo.
                    </p>
                  )}
                </div>
                <div className="space-y-2 rounded-2xl bg-card p-3">
                  <Input
                    placeholder="Nombre del ejercicio"
                    value={exName}
                    onChange={(e) => setExName(e.target.value)}
                    className="h-12 rounded-xl border-none bg-accent text-foreground"
                  />
                  <Select value={exGroup} onValueChange={setExGroup}>
                    <SelectTrigger className="h-12 rounded-xl border-none bg-accent text-foreground">
                      <SelectValue placeholder="Grupo muscular" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card text-foreground">
                      {MUSCLE_GROUPS.map((g) => (
                        <SelectItem
                          key={g}
                          value={g}
                          className="text-foreground focus:bg-accent focus:text-foreground"
                        >
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={addExerciseToTemplate}
                    disabled={!exName.trim() || !exGroup}
                    variant="ghost"
                    className="h-10 w-full rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Agregar a la plantilla
                  </Button>
                </div>
                <Button
                  onClick={applyTemplate}
                  className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25"
                >
                  <Play className="mr-2 h-4 w-4" /> Cargar al día actual
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ LIBRARY TAB ═══════════════════════════════════════ */}
        {activeTab === 'library' && (
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="Buscar ejercicio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-xl border-none bg-card pl-9 text-foreground"
              />
            </div>

            {/* Muscle group filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {['', ...MUSCLE_GROUPS].map((group) => {
                const isActive = activeFilter === group;
                return (
                  <button
                    key={group || 'all'}
                    onClick={() => setActiveFilter(group)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                      isActive ? 'text-black' : 'bg-card text-muted-foreground',
                    )}
                    style={isActive ? { backgroundColor: 'var(--brand-color)' } : {}}
                  >
                    {group || 'Todos'}
                  </button>
                );
              })}
            </div>

            {/* Exercise list */}
            {libraryLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : filteredLibrary.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {libraryExercises.length === 0
                    ? 'Tu biblioteca está vacía.\nAgrega ejercicios marcando "Guardar en mi biblioteca" al crear uno.'
                    : 'Sin resultados para tu búsqueda.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLibrary.map((ex) => {
                  const hist = libraryHistory[ex.name];
                  return (
                    <SwipeToDelete key={ex.id} onDelete={() => deleteFromLibrary(ex.id)}>
                      <button
                        onClick={() => handleAddFromLibrary(ex)}
                        className="flex w-full items-center justify-between rounded-xl bg-card p-3 text-left transition-colors active:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{ex.name}</p>
                          <p className="text-xs text-muted-foreground">{ex.muscle_group}</p>
                          {hist && (
                            <p
                              className="mt-0.5 text-xs font-medium"
                              style={{ color: 'var(--brand-color)' }}
                            >
                              Último: {hist.weight}kg × {hist.reps}
                            </p>
                          )}
                        </div>
                        <div
                          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: 'var(--brand-color-dim)' }}
                        >
                          <Plus className="h-4 w-4" style={{ color: 'var(--brand-color)' }} />
                        </div>
                      </button>
                    </SwipeToDelete>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TemplatesSheet;
