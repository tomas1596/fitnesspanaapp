import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Settings, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageScreenHeader } from '@/components/PageScreenHeader';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import {
  hapticsTimerCountdownPulse,
  hapticsTimerPhaseAdvance,
  hapticsTimerTransport,
} from '@/lib/haptics';
import { getBrandThemeEventName } from '@/lib/brandTheme';

// ── Types ────────────────────────────────────────────────────────────────────

type Preset = {
  id: string;
  name: string;
  prep: number;
  work: number;
  rest: number;
  rounds: number;
  /** Series (bloques repetidos tras descanso largo opcional). Mínimo 1. */
  sets: number;
  /** Descanso entre series (segundos). Si es 0, pasa al siguiente set sin fase aparte. */
  setRest: number;
};

type Phase = 'idle' | 'prep' | 'work' | 'rest' | 'setRest' | 'done';

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'pana_arena_presets_v1';

const DEFAULT_PRESET: Preset = {
  id: 'default',
  name: 'Tabata Clásico',
  prep: 10,
  work: 20,
  rest: 10,
  rounds: 8,
  sets: 1,
  setRest: 0,
};

function normalizePreset(p: Partial<Preset>): Preset | null {
  if (!p || typeof p.id !== 'string') return null;
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : DEFAULT_PRESET.name;
  const prep = Math.max(0, Math.round(Number(p.prep ?? 0)));
  const work = Math.max(1, Math.round(Number(p.work ?? 1)));
  const rest = Math.max(0, Math.round(Number(p.rest ?? 0)));
  const rounds = Math.max(1, Math.round(Number(p.rounds ?? 1)));
  const sets = Math.max(1, Math.round(Number(p.sets ?? 1)));
  const setRest = Math.max(0, Math.round(Number(p.setRest ?? 0)));
  return { id: p.id, name, prep, work, rest, rounds, sets, setRest };
}

const loadPresets = (): Preset[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [DEFAULT_PRESET];
    const parsed = JSON.parse(raw) as Partial<Preset>[];
    const next = parsed
      .map((row) => normalizePreset(row))
      .filter((x): x is Preset => x != null);
    return next.length ? next : [DEFAULT_PRESET];
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
  const [pinkBrand, setPinkBrand] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.brand === 'pink',
  );
  useEffect(() => {
    const syncPink = () => setPinkBrand(document.documentElement.dataset.brand === 'pink');
    syncPink();
    const ev = getBrandThemeEventName();
    window.addEventListener(ev, syncPink);
    return () => window.removeEventListener(ev, syncPink);
  }, []);

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
  const [currentSet, setCurrentSet] = useState(1);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing,      setEditing]      = useState<Preset | null>(null);

  const intervalRef = useRef<number | null>(null);
  const roundRef = useRef(1);
  const currentSetRef = useRef(1);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    currentSetRef.current = currentSet;
  }, [currentSet]);

  // Reset displayed time when preset changes while idle
  useEffect(() => {
    if (phase === 'idle' && active) {
      setRemaining(active.prep);
      setRound(1);
      setCurrentSet(1);
      roundRef.current = 1;
      currentSetRef.current = 1;
    }
  }, [active, phase]);

  const advancePhase = () => {
    if (!active) return;
    playTransitionSound();
    hapticsTimerPhaseAdvance();

    setPhase(prev => {
      if (prev === 'prep') {
        // First work round begins — announce start
        speak('Comienza');
        setRemaining(active.work);
        return 'work';
      }
      if (prev === 'work') {
        const rNow = roundRef.current;
        const sNow = currentSetRef.current;
        if (rNow < active.rounds) {
          setRemaining(active.rest);
          return 'rest';
        }
        if (sNow >= active.sets) {
          speak('Ejercicio finalizado');
          setRemaining(0);
          return 'done';
        }

        const nextSet = sNow + 1;
        roundRef.current = 1;
        currentSetRef.current = nextSet;
        setRound(1);
        setCurrentSet(nextSet);

        if (active.setRest > 0) {
          setRemaining(active.setRest);
          return 'setRest';
        }
        setRemaining(active.work);
        return 'work';
      }
      if (prev === 'rest') {
        setRound(r => r + 1);
        setRemaining(active.work);
        return 'work';
      }
      if (prev === 'setRest') {
        speak('Comienza');
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
          hapticsTimerCountdownPulse();
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
  }, [phase, paused, active, round, currentSet]);

  const start = () => {
    if (!active) return;
    primeTimerAudio();
    if (phase === 'idle' || phase === 'done') {
      setRound(1);
      roundRef.current = 1;
      setCurrentSet(1);
      currentSetRef.current = 1;
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
    setCurrentSet(1);
    roundRef.current = 1;
    currentSetRef.current = 1;
    setRemaining(active?.prep ?? 0);
  };

  // ── Colors ──────────────────────────────────────────────────────────────────

  const bg = (() => {
    if (paused)             return '#DC2626';
    if (phase === 'prep')   return '#FACC15';
    if (phase === 'work')   return 'var(--brand-color)';
    if (phase === 'rest')   return '#38BDF8';
    if (phase === 'setRest') return '#DC2626';
    return 'hsl(var(--background))';
  })();

  const fgDark = phase === 'prep' || phase === 'work' || phase === 'rest' || phase === 'setRest' || paused;

  /** Sincroniza el canvas del navegador (overscroll iOS) con el fondo activo del timer. */
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;

    html.style.backgroundColor = bg;
    body.style.backgroundColor = bg;

    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, [bg]);

  const mins    = Math.floor(remaining / 60);
  const secs    = remaining % 60;
  const isRunning = (phase === 'prep' || phase === 'work' || phase === 'rest' || phase === 'setRest') && !paused;

  const phaseHeadline =
    paused && (phase === 'prep' || phase === 'work' || phase === 'rest' || phase === 'setRest')
      ? { text: 'EN PAUSA', className: 'text-white' }
      : phase === 'prep'
        ? { text: 'PREPARATE', className: 'text-zinc-950' }
        : phase === 'work'
          ? { text: '¡A ENTRENAR!', className: 'text-white' }
          : phase === 'rest'
            ? { text: 'DESCANSÁ', className: 'text-white' }
            : phase === 'setRest'
              ? { text: 'DESCANSO LARGO', className: 'text-white' }
              : null;

  const totalRounds = active?.rounds ?? 0;
  const totalSets = Math.max(1, active?.sets ?? 1);

  const timeToneClass =
    phase === 'idle' || phase === 'done'
      ? 'text-foreground'
      : paused
        ? 'text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]'
        : 'text-zinc-950 drop-shadow-none';

  const glassRoundBadgeTone =
    paused
      ? 'bg-black/25 text-white ring-1 ring-white/25'
      : phase === 'prep'
        ? 'bg-black/15 text-zinc-950 ring-1 ring-black/15'
        : 'bg-black/25 text-white ring-1 ring-white/25';

  /** Play/Pause circular: tonos por fase + estado pausa y override Modo Rosa (VIP). */
  const playTransportUi = useMemo(() => {
    if (pinkBrand) {
      return {
        button: cn(
          'flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-zinc-950',
          'shadow-lg shadow-black/45 ring-1 ring-[#ff007f]',
          'transition-all duration-300 ease-in-out hover:brightness-110 active:scale-[0.96]',
        ),
        icon: 'text-[#ff007f]',
      };
    }

    const inActiveCircuit =
      phase === 'prep' || phase === 'work' || phase === 'rest' || phase === 'setRest';
    if (paused && inActiveCircuit) {
      return {
        button: cn(
          'flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white',
          'shadow-lg shadow-black/40 ring-1 ring-white/15',
          'transition-all duration-300 ease-in-out hover:brightness-110 active:scale-[0.96]',
        ),
        icon: 'text-white',
      };
    }

    const icon =
      phase === 'prep'
        ? 'text-zinc-950'
        : phase === 'rest' || phase === 'setRest'
          ? 'text-red-600'
          : 'text-[color:var(--brand-color)]';

    return {
      button: cn(
        'flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center rounded-full bg-white',
        'shadow-lg shadow-white/20 ring-1 ring-black/10',
        'transition-all duration-300 ease-in-out hover:brightness-[1.04] active:scale-[0.96]',
      ),
      icon,
    };
  }, [pinkBrand, paused, phase]);


  /** Superficie de botón secundario según modo claro/oscur (pantalla en reposo sin fase activa). */
  const mutedControlSurface =
    resolved === 'dark'
      ? 'border-white/15 bg-white/10 text-white hover:bg-white/15'
      : 'border-zinc-200/80 bg-zinc-100/95 text-zinc-800 hover:bg-zinc-200/90 dark:border-white/15 dark:bg-white/10 dark:text-white';

  /** Superficie de botón sobre fondos de fase (amarillo / verde marca / celeste pausa-roja): neutro translúcido. */
  const phaseSecondaryControlSurface = paused
    ? 'border-white/30 bg-black/25 text-white hover:bg-black/35'
    : phase === 'prep'
      ? 'border-zinc-900/25 bg-black/15 text-zinc-950 hover:bg-black/25'
      : 'border-white/35 bg-black/20 text-white hover:bg-black/30';

  // ── Settings helpers ─────────────────────────────────────────────────────────

  const openNewPreset = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: '',
      prep: 10,
      work: 30,
      rest: 15,
      rounds: 8,
      sets: 1,
      setRest: 0,
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
      className="flex h-full min-h-full flex-1 flex-col transition-colors duration-300"
      style={{ backgroundColor: bg }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col px-4 pb-28">

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

        {/* Centro: etiqueta de fase · tiempo · badge de ronda */}
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-1">
          {phaseHeadline && (
            <p
              className={cn(
                'pointer-events-none text-center font-black uppercase tracking-[0.12em]',
                'text-4xl sm:text-5xl',
                'leading-[1.05] drop-shadow-sm',
                phaseHeadline.className,
              )}
              aria-live="polite"
            >
              {phaseHeadline.text}
            </p>
          )}

          {!phaseHeadline && (phase === 'idle' || phase === 'done') && (
            <span className="sr-only">{phase === 'done' ? 'Ejercicio finalizado' : 'Listo para iniciar'}</span>
          )}

          <div
            className={cn(
              'text-center tabular-nums font-black tracking-tighter sm:tracking-tight',
              phase === 'idle' || phase === 'done'
                ? 'drop-shadow-[0_2px_24px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_2px_28px_rgba(0,0,0,0.22)]'
                : '',
              timeToneClass,
            )}
            style={{ fontSize: 'clamp(4.75rem, 26vw, 11rem)', lineHeight: 0.9 }}
          >
            <span>{String(mins).padStart(2, '0')}</span>
            <span>:</span>
            <span>{String(secs).padStart(2, '0')}</span>
          </div>

          {/* Ronda · Set · badges */}
          <div className="mt-2 flex min-h-[2rem] flex-wrap items-center justify-center gap-2">
            {phase === 'done' ? (
              <span
                className={cn(
                  'rounded-full px-4 py-1 text-sm font-bold tracking-wide backdrop-blur-sm',
                  fgDark
                    ? 'bg-black/25 text-white ring-1 ring-white/25'
                    : resolved === 'dark'
                      ? 'bg-white/15 text-white ring-1 ring-white/20'
                      : 'bg-black/10 text-zinc-900 ring-1 ring-black/10',
                )}
              >
                COMPLETADO
              </span>
            ) : phase !== 'idle' && totalRounds > 0 ? (
              <>
                {totalSets > 1 ? (
                  <span
                    className={cn(
                      'rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm',
                      fgDark ? 'bg-black/40 text-white ring-1 ring-white/35' : null,
                      !fgDark &&
                        (resolved === 'dark'
                          ? 'bg-zinc-900/85 text-white ring-1 ring-white/25 tracking-[0.18em]'
                          : 'bg-zinc-950/85 text-white ring-1 ring-white/20 tracking-[0.18em]'),
                    )}
                  >
                    Set&nbsp;{currentSet}&nbsp;/&nbsp;{totalSets}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded-full px-4 py-1 text-xs font-bold uppercase backdrop-blur-sm',
                    fgDark ? cn(glassRoundBadgeTone, 'tracking-[0.2em]') : null,
                    !fgDark &&
                      (resolved === 'dark'
                        ? 'bg-white/15 text-white ring-1 ring-white/20 tracking-[0.2em]'
                        : 'bg-black/10 text-zinc-900 ring-1 ring-black/10 tracking-[0.2em]'),
                  )}
                >
                  Ronda&nbsp;{round}&nbsp;/&nbsp;{totalRounds}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-col items-center gap-6 pb-2">
          <button
            type="button"
            onClick={() => {
              hapticsTimerTransport();
              if (isRunning) pause();
              else start();
            }}
            className={playTransportUi.button}
            aria-label={isRunning ? 'Pausar' : 'Iniciar'}
          >
            {isRunning ? (
              <Pause
                className={cn('h-10 w-10', playTransportUi.icon)}
                strokeWidth={2.5}
              />
            ) : (
              <Play
                className={cn('ml-1 h-10 w-10', playTransportUi.icon)}
                strokeWidth={2.5}
              />
            )}
          </button>

          <button
            type="button"
            onClick={reset}
            className={cn(
              'flex h-12 items-center gap-2 rounded-full border px-6 text-sm font-semibold backdrop-blur-sm transition-all duration-300 active:scale-[0.97]',
              fgDark ? phaseSecondaryControlSurface : cn('shadow-sm', mutedControlSurface),
            )}
            aria-label="Reiniciar"
          >
            <RotateCcw className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            Reiniciar
          </button>
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
                    {p.sets > 1 ? ` · ${p.sets} sets` : ''}
                    {p.setRest > 0 ? ` · Entre sets ${p.setRest}s` : ''}
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
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Sets</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={1}
                    value={editing.sets}
                    onChange={e => setEditing({ ...editing, sets: Math.max(1, +e.target.value || 1) })}
                  />
                </div>
                <div>
                  <Label className="text-zinc-600 dark:text-zinc-400">Descanso entre sets (s)</Label>
                  <Input
                    className={cn('mt-1.5', timerInputClass)}
                    type="number"
                    min={0}
                    value={editing.setRest}
                    onChange={e => setEditing({ ...editing, setRest: Math.max(0, +e.target.value || 0) })}
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
