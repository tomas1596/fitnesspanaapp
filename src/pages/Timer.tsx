import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

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

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'pana_arena_presets_v1';

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

/** Campana entre fases (`public/sounds/Boxeo.mp3`). Precargada en memoria. */
const mp3Bell = new Audio('/sounds/Boxeo.mp3');
mp3Bell.preload = 'auto';

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

/** Últimos 3 · 2 · 1 s: siempre bip sintético corto. */
function playCountdownBeep() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  playBip(ctx, 880, 0.12);
}

/** Cambio de fase al llegar a 0: campana MP3. */
function playTransitionSound() {
  mp3Bell.currentTime = 0;
  void mp3Bell.play().catch(() => {});
}

/**
 * Primer gesto del usuario (Play / Iniciar): desbloquea AudioContext y el elemento
 * audio para iOS/Safari (reproduce en silencio y corta de inmediato).
 */
function primeTimerAudio() {
  const ctx = getAudioCtx();
  void ctx?.resume();

  const prevVol = mp3Bell.volume;
  mp3Bell.volume = 0;
  mp3Bell.currentTime = 0;
  void mp3Bell
    .play()
    .then(() => {
      mp3Bell.pause();
      mp3Bell.currentTime = 0;
      mp3Bell.volume = prevVol;
    })
    .catch(() => {
      mp3Bell.volume = prevVol;
    });
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

// ── Component ────────────────────────────────────────────────────────────────

const timerInputClass =
  'rounded-xl border-zinc-200 bg-zinc-100 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-primary/40 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500';

const Timer = () => {
  const { resolved } = useTheme();
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

  const intervalRef = useRef<number | null>(null);

  // Reset displayed time when preset changes while idle
  useEffect(() => {
    if (phase === 'idle' && active) {
      setRemaining(active.prep);
      setRound(1);
    }
  }, [active, phase]);

  const advancePhase = () => {
    if (!active) return;
    playTransitionSound();
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
          playCountdownBeep();
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
    primeTimerAudio();
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-28">

        <PageScreenHeader
          title="Timer"
          titleClassName={fgDark ? 'text-black' : undefined}
          right={
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 active:scale-90 ${
                fgDark ? 'bg-black/10 text-black' : 'border border-border/40 bg-card/80 text-foreground backdrop-blur-sm'
              }`}
              aria-label="Configurar"
            >
              <Settings className="h-5 w-5" />
            </button>
          }
        />

        {/* Active preset chip */}
        <div className="mt-3">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
            fgDark ? 'bg-black/15 text-black' : 'border border-border/40 bg-card/70 text-muted-foreground backdrop-blur-sm'
          }`}>
            {active?.name ?? '—'}
          </span>
        </div>

        {/* Giant clock */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div
            className={`text-center font-bold leading-none tracking-tight ${
              fgDark ? 'text-black' : 'text-foreground'
            }`}
            style={{ fontSize: 'clamp(7rem, 36vw, 12rem)' }}
          >
            <span className="tabular-nums">{String(mins).padStart(2, '0')}</span>
            <span className="tabular-nums">:</span>
            <span className="tabular-nums">{String(secs).padStart(2, '0')}</span>
          </div>

          {/* Round counter */}
          <div className={`mt-6 text-sm font-medium ${fgDark ? 'text-black/70' : 'text-muted-foreground'}`}>
            {phase === 'done'
              ? '✓'
              : `${Math.max(0, (active?.rounds ?? 0) - round + (phase === 'work' || phase === 'rest' ? 0 : 0))} / ${active?.rounds ?? 0}`}
          </div>
        </div>

        {/* Controls — circular, espaciado tipo Modo Ruta */}
        <div className="flex items-center justify-center gap-6 pb-2">
          <button
            type="button"
            onClick={reset}
            className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 active:scale-95',
              fgDark
                ? 'border-black/25 bg-black/15 text-black shadow-lg shadow-black/10 hover:bg-black/25'
                : 'border-border/50 bg-white/90 text-zinc-900 shadow-md shadow-black/8 backdrop-blur-sm hover:bg-white dark:bg-zinc-800/90 dark:text-zinc-50',
            )}
            aria-label="Reiniciar"
          >
            <RotateCcw className="h-7 w-7" strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={isRunning ? pause : start}
            className={cn(
              'flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full transition-all duration-300 active:scale-[0.96]',
              fgDark
                ? 'bg-zinc-950 text-white shadow-[0_10px_32px_rgba(0,0,0,0.45)] ring-2 ring-black/20'
                : resolved === 'dark'
                  ? 'bg-primary text-primary-foreground shadow-[0_0_36px_var(--brand-glow-lg),0_10px_28px_rgba(0,0,0,0.5)] ring-2 ring-primary/45 hover:bg-[color:var(--brand-hover)] dark:text-black'
                  : 'bg-primary text-primary-foreground shadow-sm ring-0 hover:bg-[color:var(--brand-hover)] dark:text-black',
            )}
            aria-label={isRunning ? 'Pausar' : 'Iniciar'}
          >
            {isRunning ? <Pause className="h-10 w-10" strokeWidth={2.5} /> : <Play className="ml-1 h-10 w-10" strokeWidth={2.5} />}
          </button>

          <div className="h-16 w-16 shrink-0" aria-hidden />
        </div>
      </div>

      {/* ── Settings Dialog (timer list + sound picker) ───────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          className={cn(
            'max-h-[85vh] overflow-y-auto border-zinc-200/80 bg-white text-zinc-900 shadow-xl',
            'dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100',
            'sm:rounded-2xl',
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Temporizadores
            </DialogTitle>
          </DialogHeader>

          {/* Timer list */}
          <div className="space-y-2">
            {presets.map(p => (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between rounded-xl border border-zinc-200/80 px-3 py-2.5 transition-all duration-200',
                  'dark:border-white/10',
                  p.id === activePresetId
                    ? 'bg-primary/10 dark:bg-primary/15'
                    : 'bg-zinc-50/95 dark:bg-zinc-800/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActivePresetId(p.id);
                    setSettingsOpen(false);
                    reset();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{p.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Prep {p.prep}s · Trabajo {p.work}s · Descanso {p.rest}s · {p.rounds} rondas
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    onClick={() => setEditing({ ...p })}
                    aria-label="Editar temporizador"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {presets.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                      onClick={() => deletePreset(p.id)}
                      aria-label="Eliminar temporizador"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="button"
              onClick={openNewPreset}
              className="mt-1 h-12 w-full rounded-xl border-0 bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-md shadow-[0_8px_20px_var(--brand-glow-sm)] transition hover:bg-[color:var(--brand-hover)] hover:shadow-[0_10px_28px_var(--brand-glow)] active:scale-[0.98] dark:text-black"
            >
              <Plus className="mr-2 h-4 w-4" /> Añadir nuevo temporizador
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Preset Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent
          className={cn(
            'border-zinc-200/80 bg-white text-zinc-900 shadow-xl dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100',
            'sm:rounded-2xl',
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Configurar temporizador</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-600 dark:text-zinc-400">Nombre</Label>
                <Input
                  className={cn('mt-1.5', timerInputClass)}
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ej: Soga HIIT"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Preparación (s)</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={0}
                    value={editing.prep}
                    onChange={e => setEditing({ ...editing, prep: Math.max(0, +e.target.value || 0) })}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Trabajo (s)</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={1}
                    value={editing.work}
                    onChange={e => setEditing({ ...editing, work: Math.max(1, +e.target.value || 1) })}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Descanso (s)</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={0}
                    value={editing.rest}
                    onChange={e => setEditing({ ...editing, rest: Math.max(0, +e.target.value || 0) })}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Rondas</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={1}
                    value={editing.rounds}
                    onChange={e => setEditing({ ...editing, rounds: Math.max(1, +e.target.value || 1) })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-xl text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
                <Button
                  onClick={savePreset}
                  className="flex-1 rounded-xl border-0 bg-primary font-bold text-primary-foreground shadow-md shadow-[0_6px_18px_var(--brand-glow-sm)] hover:bg-[color:var(--brand-hover)] dark:text-black"
                >
                  Guardar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Timer;
