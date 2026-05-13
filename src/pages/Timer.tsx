import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings, Plus, Trash2, X, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────────────────────

type Preset = {
  id: string;
  name: string;
  prep: number;
  work: number;
  rest: number;
  rounds: number;
};

type Phase = 'idle' | 'prep' | 'work' | 'rest' | 'done';

export type SoundOption = 'bip' | 'boxing-bell' | 'whistle';

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'pana_arena_presets_v1';
const SOUND_KEY   = 'pana_timer_sound_v1';

const DEFAULT_PRESET: Preset = {
  id: 'default',
  name: 'Tabata Clásico',
  prep: 10,
  work: 20,
  rest: 10,
  rounds: 8,
};

const loadPresets = (): Preset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_PRESET];
    const parsed = JSON.parse(raw) as Preset[];
    return parsed.length ? parsed : [DEFAULT_PRESET];
  } catch {
    return [DEFAULT_PRESET];
  }
};

const savePresets = (p: Preset[]) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

const loadSound = (): SoundOption => {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (raw === 'boxing-bell' || raw === 'whistle') return raw;
  } catch { /* ignore */ }
  return 'bip';
};

const saveSound = (s: SoundOption) => {
  try { localStorage.setItem(SOUND_KEY, s); } catch { /* ignore */ }
};

// ── Audio engine (shared AudioContext to avoid browser instance limits) ──────
//
// Using a module-level AudioContext prevents the "too many AudioContexts" bug
// that caused countdown beeps to silently disappear after a few timer resets.

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!_audioCtx || _audioCtx.state === 'closed') _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') void _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
}

function playBip(ctx: AudioContext, freq: number, duration: number) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playBoxingBell(ctx: AudioContext) {
  // Multiple sine partials with rapid decay → metallic bell timbre
  const partials: [number, number, number][] = [
    [880,  0.3, 0.9],
    [1320, 0.15, 0.6],
    [1760, 0.08, 0.4],
    [2350, 0.04, 0.25],
  ];
  for (const [freq, vol, decay] of partials) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + decay);
    osc.start();
    osc.stop(ctx.currentTime + decay);
  }
}

function playWhistle(ctx: AudioContext) {
  const osc    = ctx.createOscillator();
  const gain   = ctx.createGain();
  const lfo    = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.frequency.value  = 2500;
  osc.type             = 'triangle';
  lfo.frequency.value  = 7;   // 7 Hz vibrato
  lfoGain.gain.value   = 35;  // ±35 Hz pitch wobble
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
  lfo.start();
  osc.start();
  osc.stop(ctx.currentTime + 0.45);
  lfo.stop(ctx.currentTime + 0.45);
}

/** Short "tick" beep for the last 3 seconds of a phase. */
function playCountdownBeep(sound: SoundOption) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (sound === 'bip')          playBip(ctx, 880, 0.12);
  else if (sound === 'boxing-bell') playBoxingBell(ctx);
  else if (sound === 'whistle') playWhistle(ctx);
}

/** Longer "phase-transition" sound. */
function playTransitionSound(sound: SoundOption) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (sound === 'bip')          playBip(ctx, 660, 0.6);
  else if (sound === 'boxing-bell') playBoxingBell(ctx);
  else if (sound === 'whistle') playWhistle(ctx);
}

// ── Text-to-Speech helper ────────────────────────────────────────────────────

/**
 * Speaks a Spanish phrase using the Web Speech API.
 * Cancels any pending utterance first so messages never overlap.
 * Silent no-op when speechSynthesis is unavailable (e.g. some Android WebViews).
 */
function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang   = 'es-ES';
  u.rate   = 0.95;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

// ── Sound option metadata ────────────────────────────────────────────────────

const SOUND_OPTIONS: { id: SoundOption; label: string; emoji: string }[] = [
  { id: 'bip',          label: 'Bip Clásico',      emoji: '🔔' },
  { id: 'boxing-bell',  label: 'Campana de Boxeo',  emoji: '🥊' },
  { id: 'whistle',      label: 'Silbato',           emoji: '📯' },
];

// ── Component ────────────────────────────────────────────────────────────────

const Timer = () => {
  const [presets, setPresets]             = useState<Preset[]>(loadPresets);
  const [activePresetId, setActivePresetId] = useState<string>(presets[0]?.id ?? 'default');
  const active = useMemo(
    () => presets.find(p => p.id === activePresetId) ?? presets[0],
    [presets, activePresetId],
  );

  const [phase,    setPhase]    = useState<Phase>('idle');
  const [paused,   setPaused]   = useState(false);
  const [remaining, setRemaining] = useState(active?.prep ?? 10);
  const [round,    setRound]    = useState(1);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing,      setEditing]      = useState<Preset | null>(null);

  // Sound preference
  const [selectedSound, setSelectedSound] = useState<SoundOption>(loadSound);
  // Ref so interval closures always read the latest sound without being re-created
  const soundRef = useRef<SoundOption>(selectedSound);
  useEffect(() => { soundRef.current = selectedSound; }, [selectedSound]);

  const intervalRef = useRef<number | null>(null);

  // Warm up AudioContext on mount (avoids silent-first-play on some browsers)
  useEffect(() => { getAudioCtx(); }, []);

  // Reset displayed time when preset changes while idle
  useEffect(() => {
    if (phase === 'idle' && active) {
      setRemaining(active.prep);
      setRound(1);
    }
  }, [active, phase]);

  const advancePhase = () => {
    if (!active) return;
    playTransitionSound(soundRef.current);
    if (navigator.vibrate) navigator.vibrate(400);

    setPhase(prev => {
      if (prev === 'prep') {
        // First work round begins — announce start
        speak('Comienza');
        setRemaining(active.work);
        return 'work';
      }
      if (prev === 'work') {
        if (round >= active.rounds) {
          // Last round just finished — announce completion
          speak('Ejercicio finalizado');
          setRemaining(0);
          return 'done';
        }
        // Mid-circuit rest — no voice announcement
        setRemaining(active.rest);
        return 'rest';
      }
      if (prev === 'rest') {
        setRound(r => r + 1);
        setRemaining(active.work);
        return 'work';
      }
      return prev;
    });
  };

  useEffect(() => {
    if (phase === 'idle' || phase === 'done' || paused) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1;
        if (next <= 3 && next > 0) {
          playCountdownBeep(soundRef.current);
          if (navigator.vibrate) navigator.vibrate(80);
        }
        if (next <= 0) {
          setTimeout(advancePhase, 0);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, active, round]);

  const start = () => {
    if (!active) return;
    if (phase === 'idle' || phase === 'done') {
      setRound(1);
      setRemaining(active.prep);
      setPhase('prep');
      setPaused(false);
    } else {
      setPaused(false);
    }
  };

  const pause = () => setPaused(true);

  const reset = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setPhase('idle');
    setPaused(false);
    setRound(1);
    setRemaining(active?.prep ?? 0);
  };

  // ── Colors ──────────────────────────────────────────────────────────────────

  const bg = (() => {
    if (paused)             return '#DC2626';
    if (phase === 'prep')   return '#FACC15';
    if (phase === 'work')   return 'var(--brand-color)';
    if (phase === 'rest')   return '#38BDF8';
    return 'hsl(var(--background))';
  })();

  const fgDark = phase === 'prep' || phase === 'work' || phase === 'rest' || paused;

  const mins    = Math.floor(remaining / 60);
  const secs    = remaining % 60;
  const isRunning = (phase === 'prep' || phase === 'work' || phase === 'rest') && !paused;

  // ── Settings helpers ─────────────────────────────────────────────────────────

  const openNewPreset = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      prep: 10,
      work: 30,
      rest: 15,
      rounds: 8,
    });
  };

  const savePreset = () => {
    if (!editing || !editing.name.trim()) return;
    setPresets(prev => {
      const exists = prev.some(p => p.id === editing.id);
      const next = exists
        ? prev.map(p => p.id === editing.id ? editing : p)
        : [...prev, editing];
      savePresets(next);
      return next;
    });
    setActivePresetId(editing.id);
    setEditing(null);
  };

  const deletePreset = (id: string) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      const safe = next.length ? next : [DEFAULT_PRESET];
      savePresets(safe);
      if (activePresetId === id) setActivePresetId(safe[0].id);
      return safe;
    });
  };

  const handleSoundChange = (s: SoundOption) => {
    setSelectedSound(s);
    saveSound(s);
    // Play a preview of the selected sound immediately
    playCountdownBeep(s);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-28 pt-6">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <h1 className={`text-xl font-bold ${fgDark ? 'text-black' : 'text-foreground'}`}>
            Timer
          </h1>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              fgDark ? 'bg-black/10 text-black' : 'bg-card text-foreground'
            }`}
            aria-label="Configurar"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Active preset chip */}
        <div className="mt-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            fgDark ? 'bg-black/15 text-black' : 'bg-card text-muted-foreground'
          }`}>
            {active?.name ?? '—'}
          </span>
        </div>

        {/* Giant clock */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className={`text-center font-bold tabular-nums leading-none tracking-tight ${
              fgDark ? 'text-black' : 'text-foreground'
            }`}
            style={{ fontSize: 'clamp(7rem, 36vw, 12rem)' }}
          >
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>

          {/* Round counter */}
          <div className={`mt-6 text-sm font-medium ${fgDark ? 'text-black/70' : 'text-muted-foreground'}`}>
            {phase === 'done'
              ? '✓'
              : `${Math.max(0, (active?.rounds ?? 0) - round + (phase === 'work' || phase === 'rest' ? 0 : 0))} / ${active?.rounds ?? 0}`}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={reset}
            className={`h-14 w-14 rounded-2xl ${
              fgDark ? 'bg-black/10 text-black hover:bg-black/20' : 'bg-card text-foreground hover:bg-accent'
            }`}
          >
            <RotateCcw className="h-6 w-6" />
          </Button>

          <button
            onClick={isRunning ? pause : start}
            className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
              fgDark ? 'bg-black text-white' : 'bg-primary text-primary-foreground'
            }`}
            aria-label={isRunning ? 'Pausar' : 'Iniciar'}
          >
            {isRunning ? <Pause className="h-9 w-9" /> : <Play className="ml-1 h-9 w-9" />}
          </button>

          <div className="h-14 w-14" />
        </div>
      </div>

      {/* ── Settings Dialog (timer list + sound picker) ───────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Temporizadores</DialogTitle>
          </DialogHeader>

          {/* Sound selector */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Sonido de alerta</p>
            </div>
            <div className="flex gap-2">
              {SOUND_OPTIONS.map(({ id, label, emoji }) => (
                <button
                  key={id}
                  onClick={() => handleSoundChange(id)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    selectedSound === id
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  <span className="text-lg leading-none">{emoji}</span>
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Timer list */}
          <div className="space-y-2">
            {presets.map(p => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-xl border p-3 ${
                  p.id === activePresetId ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <button
                  onClick={() => { setActivePresetId(p.id); setSettingsOpen(false); reset(); }}
                  className="flex-1 text-left"
                >
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Prep {p.prep}s · Trabajo {p.work}s · Descanso {p.rest}s · {p.rounds} rondas
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...p })}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  {presets.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deletePreset(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button onClick={openNewPreset} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Añadir nuevo temporizador
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Preset Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar temporizador</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ej: Soga HIIT"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Preparación (s)</Label>
                  <Input type="number" min={0} value={editing.prep}
                    onChange={e => setEditing({ ...editing, prep: Math.max(0, +e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Trabajo (s)</Label>
                  <Input type="number" min={1} value={editing.work}
                    onChange={e => setEditing({ ...editing, work: Math.max(1, +e.target.value || 1) })} />
                </div>
                <div>
                  <Label>Descanso (s)</Label>
                  <Input type="number" min={0} value={editing.rest}
                    onChange={e => setEditing({ ...editing, rest: Math.max(0, +e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Rondas</Label>
                  <Input type="number" min={1} value={editing.rounds}
                    onChange={e => setEditing({ ...editing, rounds: Math.max(1, +e.target.value || 1) })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditing(null)} className="flex-1">
                  <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={savePreset} className="flex-1">Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Timer;
