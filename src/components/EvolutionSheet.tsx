import { useEffect, useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Camera, Calendar as CalIcon, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Pose = 'front' | 'side' | 'back';
const POSES: { id: Pose; label: string }[] = [
  { id: 'front', label: 'Frente' },
  { id: 'side', label: 'Perfil' },
  { id: 'back', label: 'Espalda' },
];

interface Measurement {
  id: string;
  measurement_date: string;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
}
interface PhotoRow { id: string; pose: string; url: string; created_at: string; }

interface Props { open: boolean; onClose: () => void; }

const EvolutionSheet = ({ open, onClose }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [dialog, setDialog] = useState(false);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [chest, setChest] = useState('');
  const [arms, setArms] = useState('');
  const [draftPhotos, setDraftPhotos] = useState<Record<Pose, File | null>>({ front: null, side: null, back: null });
  const photoRefs = useRef<Record<Pose, HTMLInputElement | null>>({ front: null, side: null, back: null });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: ms } = await supabase.from('body_measurements').select('*').eq('user_id', user.id).order('measurement_date', { ascending: false });
    setMeasurements((ms || []) as Measurement[]);
    const { data: ps } = await supabase.from('progress_photos').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setPhotos((ps || []) as PhotoRow[]);
  };

  useEffect(() => { if (open) load(); }, [open, user]);

  const reset = () => {
    setWeight(''); setWaist(''); setChest(''); setArms('');
    setDraftPhotos({ front: null, side: null, back: null });
  };

  const saveEntry = async () => {
    if (!user) return;
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const hasMetric = weight || waist || chest || arms;
    if (hasMetric) {
      await supabase.from('body_measurements').insert({
        user_id: user.id,
        measurement_date: today,
        weight: weight ? parseFloat(weight) : null,
        waist: waist ? parseFloat(waist) : null,
        chest: chest ? parseFloat(chest) : null,
        arms: arms ? parseFloat(arms) : null,
      });
    }
    for (const pose of POSES) {
      const file = draftPhotos[pose.id];
      if (!file) continue;
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${pose.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('progress-photos').upload(path, file);
      if (error) continue;
      const { data } = await supabase.storage.from('progress-photos').createSignedUrl(path, 60 * 60 * 24 * 365);
      await supabase.from('progress_photos').insert({ user_id: user.id, pose: pose.id, url: data?.signedUrl || '' });
    }
    setSaving(false);
    reset();
    setDialog(false);
    toast({ title: 'Registro guardado' });
    load();
  };

  const deleteMeasurement = async (id: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
    await supabase.from('body_measurements').delete().eq('id', id);
  };

  // Group photos by date
  const photosByDate = new Map<string, PhotoRow[]>();
  for (const p of photos) {
    const d = p.created_at.split('T')[0];
    if (!photosByDate.has(d)) photosByDate.set(d, []);
    photosByDate.get(d)!.push(p);
  }

  // Merge timeline
  const allDates = new Set<string>([...measurements.map(m => m.measurement_date), ...photosByDate.keys()]);
  const timeline = [...allDates].sort((a, b) => b.localeCompare(a));

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl border-none bg-background p-5">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left text-xl text-foreground">Evolución Física</SheetTitle>
          </SheetHeader>

          <Button onClick={() => setDialog(true)} className="mb-4 h-11 w-full rounded-xl text-sm font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Registro
          </Button>

          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aún no hay registros. Crea tu primer hito.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map(date => {
                const m = measurements.find(x => x.measurement_date === date);
                const ps = photosByDate.get(date) || [];
                return (
                  <div key={date} className="rounded-2xl bg-card p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalIcon className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-medium capitalize text-foreground">{fmt(date)}</span>
                      </div>
                      {m && (
                        <button onClick={() => deleteMeasurement(m.id)} className="text-muted-foreground/50 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {m && (
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { l: 'Peso', v: m.weight, u: 'kg' },
                          { l: 'Cintura', v: m.waist, u: 'cm' },
                          { l: 'Pecho', v: m.chest, u: 'cm' },
                          { l: 'Brazo', v: m.arms, u: 'cm' },
                        ].map(x => (
                          <div key={x.l} className="rounded-lg bg-accent p-2">
                            <p className="text-sm font-bold text-foreground">{x.v ?? '—'}{x.v ? <span className="text-[10px] text-muted-foreground">{x.u}</span> : null}</p>
                            <p className="text-[10px] text-muted-foreground">{x.l}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {ps.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {POSES.map(p => {
                          const photo = ps.find(x => x.pose === p.id);
                          if (!photo) return <div key={p.id} />;
                          return (
                            <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
                              <img src={photo.url} alt={p.label} className="h-full w-full object-cover" />
                              <span className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 text-center text-[9px] font-medium text-white">{p.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-0 bg-card">
          <DialogHeader><DialogTitle className="text-foreground">Nuevo Registro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <LabeledNum label="Peso (kg)" value={weight} onChange={setWeight} />
              <LabeledNum label="Cintura (cm)" value={waist} onChange={setWaist} />
              <LabeledNum label="Pecho (cm)" value={chest} onChange={setChest} />
              <LabeledNum label="Brazo (cm)" value={arms} onChange={setArms} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {POSES.map(p => (
                <div key={p.id}>
                  <input
                    ref={el => (photoRefs.current[p.id] = el)}
                    type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setDraftPhotos(prev => ({ ...prev, [p.id]: f })); }}
                  />
                  <button
                    onClick={() => photoRefs.current[p.id]?.click()}
                    className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl bg-secondary"
                  >
                    {draftPhotos[p.id] ? (
                      <img src={URL.createObjectURL(draftPhotos[p.id]!)} alt={p.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px]">{p.label}</span>
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <Button onClick={saveEntry} disabled={saving} className="h-11 w-full rounded-xl font-semibold">
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const LabeledNum = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
    <Input type="number" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
      className="h-10 rounded-xl border-0 bg-secondary text-sm" />
  </div>
);

export default EvolutionSheet;
