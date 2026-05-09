import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronRight, ChevronLeft, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface TemplatesSheetProps {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (exercises: TemplateExercise[]) => Promise<void>;
}

const TemplatesSheet = ({ open, onClose, onApplyTemplate }: TemplatesSheetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selected, setSelected] = useState<Template | null>(null);
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);

  // create form (full draft)
  const [newName, setNewName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [exName, setExName] = useState('');
  const [exGroup, setExGroup] = useState('');

  const loadTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_templates')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTemplates(data || []);
  };

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

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
    setDraftExercises(prev => [...prev, { name: exName.trim(), muscle_group: exGroup }]);
    setExName('');
    setExGroup('');
  };

  const removeDraftExercise = (idx: number) => {
    setDraftExercises(prev => prev.filter((_, i) => i !== idx));
  };

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
    if (error || !tpl) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return; }

    const rows = draftExercises.map((ex, i) => ({
      user_id: user.id,
      template_id: tpl.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      position: i,
    }));
    const { error: exErr } = await supabase.from('template_exercises').insert(rows);
    if (exErr) { toast({ title: 'Error', description: exErr.message, variant: 'destructive' }); return; }

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
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setExercises(prev => [...prev, data]);
    setExName('');
    setExGroup('');
  };

  const removeExerciseFromTemplate = async (id: string) => {
    await supabase.from('template_exercises').delete().eq('id', id);
    setExercises(prev => prev.filter(e => e.id !== id));
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

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-none bg-background p-5">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-left text-xl text-foreground">
            {view !== 'list' && (
              <button onClick={() => setView('list')} className="rounded-lg p-1 hover:bg-accent">
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {view === 'list' && 'Mis Rutinas'}
            {view === 'create' && 'Nueva Plantilla'}
            {view === 'detail' && selected?.name}
          </SheetTitle>
        </SheetHeader>

        {view === 'list' && (
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No tienes plantillas todavía.</p>
            )}
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl bg-card p-3">
                <button onClick={() => openTemplate(t)} className="flex flex-1 items-center justify-between text-left">
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
            <Button onClick={() => setView('create')} className="mt-3 h-12 w-full rounded-xl font-semibold">
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
                  {MUSCLE_GROUPS.map(g => (
                    <SelectItem key={g} value={g} className="text-foreground focus:bg-accent focus:text-foreground">{g}</SelectItem>
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
              {exercises.map(ex => (
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
                <p className="py-4 text-center text-xs text-muted-foreground">Sin ejercicios. Agrega abajo.</p>
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
                  {MUSCLE_GROUPS.map(g => (
                    <SelectItem key={g} value={g} className="text-foreground focus:bg-accent focus:text-foreground">{g}</SelectItem>
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

            <Button onClick={applyTemplate} className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/25">
              <Play className="mr-2 h-4 w-4" /> Cargar al día actual
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TemplatesSheet;
