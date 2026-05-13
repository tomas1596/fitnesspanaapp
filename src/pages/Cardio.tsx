import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { CircleMarker, MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bluetooth, History as HistoryIcon, Pause, Play, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/useTheme';
import {
  computeKmSplits,
  computePositiveElevationGainM,
  distM,
  smoothRouteForDisplay,
  type LatLng,
} from '@/lib/runAnalysis';
import { estimateRunCalories, estimateRunSteps } from '@/lib/calories';
import { fmtPace, fmtTime, NRC_GREEN } from '@/lib/runFormat';
import { KmMilestoneMarkers } from '@/components/KmMilestoneMarkers';
import { PaceHeatPolylines } from '@/components/PaceHeatPolylines';
// Sticky-notification imports disabled (re-enable before App Store launch):
// import { postRunStopToSw, postRunTickToSw } from '@/lib/runTrackingSw';
import { connectHeartRateSensor, tryReconnectStoredHeartRate, type HrConnection } from '@/lib/hrBluetooth';

type RunRow = {
  id: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number;
  avg_pace_seconds_per_km: number;
  route_data: LatLng[];
  title?: string | null;
  calories?: number | null;
  elevation_gain_m?: number | null;
  avg_heart_rate?: number | null;
};

/** Web Bluetooth sólo existe en Chrome/Edge (no en Safari/iOS). Evaluado una vez. */
const BT_SUPPORTED = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

const Recenter = ({ center }: { center: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 15 ? 16 : map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

// Color fijo para el marcador de posición en el mapa.
// Deliberadamente NO usa var(--brand-color) para que el tema VIP rosa
// no afecte la legibilidad técnica del mapa de Leaflet.
const MAP_POSITION_GREEN = '#39FF14';
const dotIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:9999px;background:${MAP_POSITION_GREEN};border:3px solid #0b0f14;box-shadow:0 0 12px ${MAP_POSITION_GREEN};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

/** Ritmo medio en texto para TTS (minutos y segundos por km). */
const paceForSpeech = (secPerKm: number) => {
  if (!isFinite(secPerKm) || secPerKm <= 0) return 'sin datos';
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  if (m === 0) return `${s} segundos`;
  if (s === 0) return `${m} minuto${m !== 1 ? 's' : ''}`;
  return `${m} minuto${m !== 1 ? 's' : ''} y ${s} segundo${s !== 1 ? 's' : ''}`;
};

const speakKmMilestones = (fromKm: number, toKm: number, distanceM: number, elapsedSec: number) => {
  if (!('speechSynthesis' in window) || fromKm >= toKm) return;
  window.speechSynthesis.cancel();
  const texts: string[] = [];
  for (let k = fromKm + 1; k <= toKm; k++) {
    const avgSecPerKm = distanceM > 0 ? elapsedSec / (distanceM / 1000) : 0;
    texts.push(
      `Distancia: ${k} kilómetros. Ritmo medio: ${paceForSpeech(avgSecPerKm)} por kilómetro.`
    );
  }
  let i = 0;
  const next = () => {
    if (i >= texts.length) return;
    const u = new SpeechSynthesisUtterance(texts[i]);
    u.lang = 'es-ES';
    u.rate = 1;
    u.onend = () => {
      i += 1;
      next();
    };
    window.speechSynthesis.speak(u);
  };
  next();
};

const MIN_RUN_METERS = 50;

/** Mensaje legible según GeolocationPositionError.code (1 / 2 / 3). */
function geoUserMessageFromError(err: GeolocationPositionError): string {
  switch (err.code) {
    case 1:
      return 'Activá la ubicación para este sitio y del dispositivo (GPS) para ver el mapa y registrar tu ruta.';
    case 2:
      return 'No pudimos obtener tu posición. Comprobá que el GPS esté activo y salí al exterior si hace falta.';
    case 3:
      return 'El GPS tardó demasiado. Intentá de nuevo con mejor señal o al aire libre.';
    default:
      return 'No pudimos usar el GPS. Revisá permisos y que la ubicación esté activada.';
  }
}

const playTone = (frequency: number, duration = 0.12, volume = 0.2) => {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start();
  osc.stop(ctx.currentTime + duration);
};

const beepTick = () => playTone(900, 0.1, 0.18);
const successChime = () => {
  playTone(880, 0.12, 0.2);
  window.setTimeout(() => playTone(1175, 0.15, 0.2), 120);
  window.setTimeout(() => playTone(1568, 0.18, 0.2), 260);
};

const Cardio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { resolved } = useTheme();
  const tileUrl = resolved === 'dark' ? DARK_TILES : LIGHT_TILES;
  const mapBg = resolved === 'dark' ? '#0b0f14' : '#e9ecef';
  const mapHeatTheme = resolved === 'dark' ? 'dark' : 'light';

  const [tab, setTab] = useState<'run' | 'history'>('run');

  const [position, setPosition] = useState<[number, number] | null>(null);
  /** Mensaje cuando falla la ubicación inicial (sin coordenadas falsas). */
  const [geoError, setGeoError] = useState<string | null>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [phase, setPhase] = useState<'idle' | 'active' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0); // meters
  const [holdProgress, setHoldProgress] = useState(0); // 0..1 for finish hold
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const startedAtRef = useRef<Date | null>(null);
  const lastAnnouncedKmRef = useRef(0);

  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const phaseRef = useRef<'idle' | 'active' | 'paused'>('idle');
  const lastWatchErrToastAtRef = useRef(0);

  // History
  const [runs, setRuns] = useState<RunRow[]>([]);

  /** PPM desde pulsómetro BLE (Web Bluetooth). */
  const [liveHeartRate, setLiveHeartRate] = useState<number | null>(null);
  const [hrBtConnected, setHrBtConnected] = useState(false);
  const [hrBtBusy, setHrBtBusy] = useState(false);
  const hrConnRef = useRef<HrConnection | null>(null);
  const runSwPayloadRef = useRef({ seconds: 0, distance: 0 });

  const fetchRuns = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });
    setRuns(((data || []) as unknown) as RunRow[]);
  }, [user]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // Reconexión automática al pulsómetro guardado (sin selector).
  useEffect(() => {
    if (!BT_SUPPORTED) return;
    let cancelled = false;
    (async () => {
      try {
        const conn = await tryReconnectStoredHeartRate(
          (bpm) => {
            if (!cancelled) setLiveHeartRate(bpm);
          },
          () => {
            if (!cancelled) {
              setHrBtConnected(false);
              hrConnRef.current = null;
              setLiveHeartRate(null);
            }
          },
        );
        if (!cancelled && conn) {
          hrConnRef.current = conn;
          setHrBtConnected(true);
        }
      } catch {
        /* sin diálogo en segundo plano */
      }
    })();
    return () => {
      cancelled = true;
      hrConnRef.current?.disconnect();
      hrConnRef.current = null;
    };
  }, []);

  // Sticky-notification effects disabled (re-enable before App Store launch):
  // useEffect(() => {
  //   if (phase === 'active' || phase === 'paused') return;
  //   postRunStopToSw();
  // }, [phase]);
  //
  // useEffect(() => {
  //   if (phase !== 'active' && phase !== 'paused') return;
  //   const tick = () => { ... postRunTickToSw(...) };
  //   const id = window.setInterval(tick, 1000);
  //   return () => window.clearInterval(id);
  // }, [phase]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const requestInitialPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no permite geolocalización. Usá Chrome o Edge actualizado.');
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition([p.coords.latitude, p.coords.longitude]);
        setGeoError(null);
      },
      (err) => {
        setGeoError(geoUserMessageFromError(err as GeolocationPositionError));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    requestInitialPosition();
  }, [requestInitialPosition]);

  // Start GPS watch
  const startWatch = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'GPS no disponible',
        description: 'Tu navegador no expone geolocalización.',
        variant: 'destructive',
      });
      return false;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setGeoError(null);
        const alt =
          p.coords.altitude != null && Number.isFinite(p.coords.altitude) ? p.coords.altitude : null;
        const point: LatLng = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          t: Date.now(),
          alt,
        };
        setPosition([point.lat, point.lng]);
        setRoute((prev) => {
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          const d = distM(last, point);
          if (d < 3) return prev; // ignore noise
          if (p.coords.accuracy && p.coords.accuracy > 30) return prev;
          setDistance((x) => x + d);
          return [...prev, point];
        });
      },
      (err) => {
        const e = err as GeolocationPositionError;
        console.warn('[cardio] geolocation', e.code, e.message);
        const msg = geoUserMessageFromError(e);
        const running = phaseRef.current === 'active' || phaseRef.current === 'paused';
        if (running) {
          const now = Date.now();
          if (now - lastWatchErrToastAtRef.current > 25000) {
            lastWatchErrToastAtRef.current = now;
            toast({ title: 'Problema con el GPS', description: msg, variant: 'destructive' });
          }
        } else {
          setGeoError(msg);
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    return true;
  };

  const stopWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Tick
  useEffect(() => {
    if (phase !== 'active') {
      if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [phase]);

  // Aviso de voz al completar cada kilómetro entero (carrera en curso: activa o en pausa).
  useEffect(() => {
    if (phase !== 'active' && phase !== 'paused') return;
    const completedKm = Math.floor(distance / 1000);
    if (completedKm <= lastAnnouncedKmRef.current) return;
    const from = lastAnnouncedKmRef.current;
    lastAnnouncedKmRef.current = completedKm;
    speakKmMilestones(from, completedKm, distance, seconds);
  }, [distance, seconds, phase]);

  const handleStart = async () => {
    if (phase === 'paused') { setPhase('active'); return; }
    speak('preparate');
    for (const n of [3, 2, 1]) {
      setCountdown(n);
      beepTick();
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    setCountdown(null);
    if (!startWatch()) return;
    startedAtRef.current = new Date();
    lastAnnouncedKmRef.current = 0;
    setRoute([]); setDistance(0); setSeconds(0);
    setLiveHeartRate(null);
    setPhase('active');
  };

  const handlePause = () => {
    setPhase(p => (p === 'active' ? 'paused' : 'active'));
  };

  const finishRun = async () => {
    if (isSaving) return; // prevent double-fire from long-press
    stopWatch();
    const dur = seconds;
    const dist = distance;
    const km = dist / 1000;
    const pace = km > 0 ? Math.round(dur / km) : 0;
    setPhase('idle');

    if (dist < MIN_RUN_METERS) {
      speak('Carrera demasiado corta para guardar');
      toast({ title: 'Carrera demasiado corta', description: 'Menos de 50 metros. No se guardó.' });
      setRoute([]); setDistance(0); setSeconds(0);
      lastAnnouncedKmRef.current = 0;
      setLiveHeartRate(null);
      return;
    }

    successChime();
    speak('carrera finalizada');

    if (user) {
      setIsSaving(true);
      try {
        const kmSaved = dist / 1000;
        const calories = estimateRunCalories(kmSaved);
        const steps = estimateRunSteps(kmSaved);
        const splitsPayload = computeKmSplits(route);
        const elevationGain = computePositiveElevationGainM(route);
        const hasAltSamples = route.some((p) => p.alt != null && Number.isFinite(p.alt));
        const { error } = await supabase.from('activities').insert({
          user_id: user.id,
          started_at: (startedAtRef.current || new Date()).toISOString(),
          duration_seconds: dur,
          distance_meters: dist,
          avg_pace_seconds_per_km: pace,
          route_data: route as never,
          splits: splitsPayload as never,
          calories,
          steps,
          elevation_gain_m: hasAltSamples ? elevationGain : null,
          avg_heart_rate: liveHeartRate,
        });
        if (error) {
          toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: '¡Carrera guardada!', description: `${km.toFixed(2)} km · ${fmtTime(dur)}` });
          fetchRuns();
        }
      } finally {
        setIsSaving(false);
      }
    }

    setRoute([]); setDistance(0); setSeconds(0);
    lastAnnouncedKmRef.current = 0;
    setLiveHeartRate(null);
  };

  // Long-press finish
  const beginHold = () => {
    const start = Date.now();
    const dur = 1500;
    holdRef.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setHoldProgress(p);
      if (p >= 1) { endHold(true); }
    }, 30);
  };
  const endHold = (trigger = false) => {
    if (holdRef.current) { window.clearInterval(holdRef.current); holdRef.current = null; }
    setHoldProgress(0);
    if (trigger) finishRun();
  };

  useEffect(() => () => {
    stopWatch();
    if (tickRef.current) window.clearInterval(tickRef.current);
    if (holdRef.current) window.clearInterval(holdRef.current);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const km = distance / 1000;
  const pace = km > 0 ? seconds / km : 0;

  runSwPayloadRef.current = { seconds, distance };

  const displayRoute = useMemo(() => smoothRouteForDisplay(route), [route]);
  const routeHasAlt = useMemo(
    () => route.some((p) => p.alt != null && Number.isFinite(p.alt)),
    [route],
  );
  const livePositiveElevM = useMemo(() => computePositiveElevationGainM(route), [route]);

  const handleHrFab = async () => {
    if (hrBtBusy) return;
    if (hrBtConnected && hrConnRef.current) return;
    const bt = (navigator as { bluetooth?: unknown }).bluetooth;
    if (!bt) {
      toast({
        title: 'Bluetooth no disponible',
        description: 'Usa Chrome o Edge (HTTPS o localhost) con un pulsómetro BLE compatible.',
        variant: 'destructive',
      });
      return;
    }
    setHrBtBusy(true);
    try {
      const conn = await connectHeartRateSensor(
        (bpm) => setLiveHeartRate(bpm),
        () => {
          setHrBtConnected(false);
          hrConnRef.current = null;
          setLiveHeartRate(null);
        },
      );
      hrConnRef.current = conn;
      setHrBtConnected(true);
      toast({ title: 'Sensor vinculado', description: 'Ritmo cardíaco por Bluetooth.' });
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'NotFoundError') return;
      toast({
        title: 'No se pudo conectar',
        description: err.message || 'Enciende el pulsómetro y acércalo.',
        variant: 'destructive',
      });
    } finally {
      setHrBtBusy(false);
    }
  };

  // Monthly stats
  const monthStats = useMemo(() => {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const inMonth = runs.filter(r => {
      const d = new Date(r.started_at);
      return d.getMonth() === m && d.getFullYear() === y;
    });
    const totalDist = inMonth.reduce((a, r) => a + Number(r.distance_meters), 0);
    const totalTime = inMonth.reduce((a, r) => a + r.duration_seconds, 0);
    const totalKm = totalDist / 1000;
    const avgPace = totalKm > 0 ? totalTime / totalKm : 0;
    return { km: totalKm, count: inMonth.length, time: totalTime, pace: avgPace };
  }, [runs]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* ── Saving overlay ── */}
      {isSaving && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background/95 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <p className="text-base font-semibold text-foreground">Guardando tu actividad…</p>
          <p className="text-xs text-muted-foreground">No cierres la app</p>
        </div>
      )}

      {/* Header tabs */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-2xl font-bold">Modo Ruta</h1>
        <div className="flex items-center gap-1 rounded-full bg-card p-1">
          <button
            type="button"
            onClick={() => setTab('run')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'run' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Correr
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            <HistoryIcon className="h-3.5 w-3.5" /> Actividad
          </button>
        </div>
      </div>

      {tab === 'run' ? (
        <div className="relative mt-3 h-[calc(100vh-180px)] overflow-hidden">
          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
              <div
                key={countdown}
                className="font-extrabold tabular-nums text-primary animate-in zoom-in-50 duration-300"
                style={{ fontSize: 'clamp(10rem, 50vw, 18rem)', lineHeight: 1 }}
              >
                {countdown}
              </div>
            </div>
          )}

          {/* Active run focus screen */}
          {phase === 'active' && countdown === null && (
            <div className="absolute inset-0 z-40 flex flex-col bg-background">
              {/* Top: Pace, BPM, Time */}
              <div className="grid grid-cols-3 gap-2 px-4 pt-6 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Ritmo</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmtPace(pace)}</div>
                </div>
                <div className="min-h-[4.5rem]">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">PPM</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                    {liveHeartRate != null ? liveHeartRate : '—'}
                  </div>
                  {liveHeartRate == null && (
                    <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">Sensor no vinculado</p>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tiempo</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmtTime(seconds)}</div>
                </div>
              </div>

              {/* Center: distance + unit (single line, running-app style) */}
              <div className="flex min-h-0 flex-1 flex-col justify-center px-2 py-4">
                <div className="flex w-full items-baseline justify-center gap-1.5 sm:gap-2">
                  <span
                    className="font-extrabold tabular-nums"
                    style={{ color: NRC_GREEN, fontSize: 'clamp(5rem, 28vw, 10rem)', lineHeight: 0.9 }}
                  >
                    {km.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-lg font-light tracking-wide text-muted-foreground/85 sm:text-2xl">
                    km
                  </span>
                </div>
              </div>

              {/* Bottom: pause + long-press finish */}
              <div className="flex items-center justify-center gap-6 pb-8">
                <button
                  onClick={handlePause}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl active:scale-95"
                >
                  {phase === 'active' ? <Pause className="h-9 w-9" fill="currentColor" /> : <Play className="h-9 w-9" fill="currentColor" />}
                </button>
                <button
                  onPointerDown={beginHold}
                  onPointerUp={() => endHold(false)}
                  onPointerLeave={() => endHold(false)}
                  className="relative h-20 w-20 overflow-hidden rounded-full text-[10px] font-extrabold text-black shadow-xl active:scale-95"
                  style={{ background: '#FF6B35' }}
                >
                  <div
                    className="absolute inset-0 bg-black/40"
                    style={{ clipPath: `inset(0 0 ${(1 - holdProgress) * 100}% 0)` }}
                  />
                  <span className="relative">MANTÉN<br/>FINALIZAR</span>
                </button>
              </div>
            </div>
          )}

          {/* Paused split-screen (NRC style) */}
          {phase === 'paused' && countdown === null && (
            <div className="absolute inset-0 z-40 flex flex-col bg-background">
              {/* Top half: live map */}
              <div className="relative h-1/2 w-full overflow-hidden">
                {position ? (
                  <MapContainer
                    center={position}
                    zoom={16}
                    zoomControl={false}
                    attributionControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                    boxZoom={false}
                    keyboard={false}
                    style={{ width: '100%', height: '100%', background: mapBg }}
                  >
                    <TileLayer url={tileUrl} attribution={TILE_ATTR} />
                    <PaceHeatPolylines points={displayRoute} avgPaceSecPerKm={pace} mapTheme={mapHeatTheme} />
                    <KmMilestoneMarkers points={displayRoute} mapTheme={mapHeatTheme} />
                    <Marker position={position} icon={dotIcon} />
                    <Recenter center={position} />
                  </MapContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                    <p>{geoError ?? 'Obteniendo ubicación…'}</p>
                    {geoError && (
                      <button
                        type="button"
                        onClick={() => requestInitialPosition()}
                        className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"
                      >
                        Reintentar
                      </button>
                    )}
                  </div>
                )}
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground backdrop-blur">
                  En pausa
                </div>
              </div>

              {/* Bottom half: metrics card */}
              <div className="flex h-1/2 flex-col justify-between rounded-t-3xl bg-card px-5 pb-6 pt-5 shadow-2xl">
                <div className="grid grid-cols-3 gap-y-4 text-center">
                  {/* Row 1 */}
                  <Metric label="Km" value={km.toFixed(2).replace('.', ',')} big primary />
                  <Metric label="Ritmo prom." value={fmtPace(pace)} big />
                  <Metric label="Tiempo" value={fmtTime(seconds)} big />
                  {/* Row 2 */}
                  <Metric label="Calorías" value="0" />
                  <Metric
                    label="Desnivel +"
                    value={routeHasAlt ? `${livePositiveElevM} m` : '—'}
                  />
                  <Metric label="PPM" value={liveHeartRate != null ? String(liveHeartRate) : '—'} />
                </div>

                <div className="flex items-center justify-center gap-10">
                  <button
                    onPointerDown={beginHold}
                    onPointerUp={() => endHold(false)}
                    onPointerLeave={() => endHold(false)}
                    className="relative h-20 w-20 overflow-hidden rounded-full bg-foreground/90 shadow-xl active:scale-95"
                    aria-label="Mantén para finalizar"
                  >
                    <div
                      className="absolute inset-0 bg-primary/70"
                      style={{ clipPath: `inset(0 0 ${(1 - holdProgress) * 100}% 0)` }}
                    />
                    <Square className="relative mx-auto h-7 w-7 text-background" fill="currentColor" />
                  </button>
                  <button
                    onClick={handlePause}
                    className="flex h-20 w-20 items-center justify-center rounded-full text-black shadow-2xl active:scale-95"
                    style={{ background: '#FF6B35' }}
                    aria-label="Reanudar"
                  >
                    <Play className="h-9 w-9" fill="currentColor" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Map (background, locked) */}
          <div className="absolute inset-0 z-0">
            {position ? (
              <MapContainer
                center={position}
                zoom={16}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                boxZoom={false}
                keyboard={false}
                style={{ width: '100%', height: '100%', background: mapBg }}
              >
                <TileLayer url={tileUrl} attribution={TILE_ATTR} />
                <PaceHeatPolylines points={displayRoute} avgPaceSecPerKm={pace} mapTheme={mapHeatTheme} />
                <KmMilestoneMarkers points={displayRoute} mapTheme={mapHeatTheme} />
                {position && <Marker position={position} icon={dotIcon} />}
                <Recenter center={position} />
              </MapContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                <p>{geoError ?? 'Obteniendo ubicación…'}</p>
                {geoError && (
                  <button
                    type="button"
                    onClick={() => requestInitialPosition()}
                    className="rounded-full border border-border bg-background/90 px-4 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* FAB Bluetooth (mapa): solo visible si el navegador soporta Web Bluetooth */}
          {BT_SUPPORTED && countdown === null && (
            <button
              type="button"
              onClick={handleHrFab}
              disabled={hrBtBusy || (hrBtConnected && !!hrConnRef.current)}
              title={hrBtConnected ? 'Pulsómetro vinculado' : 'Vincular pulsómetro BLE'}
              className={`pointer-events-auto absolute right-3 top-3 z-[45] flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition active:scale-95 disabled:opacity-60 ${
                hrBtConnected
                  ? 'border-transparent text-black'
                  : 'border-border/70 bg-background/75 text-muted-foreground'
              }`}
              style={
                hrBtConnected
                  ? {
                      background: 'var(--brand-color)',
                      boxShadow: '0 0 22px var(--brand-glow-lg), 0 4px 14px rgba(0,0,0,0.35)',
                    }
                  : undefined
              }
            >
              <Bluetooth className="h-5 w-5" strokeWidth={2.25} />
            </button>
          )}

          {/* Idle controls floating over map */}
          <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-30 flex flex-col items-center gap-3">
            {phase === 'idle' && (
              <div className="pointer-events-auto flex flex-col items-center gap-3">
                <button
                  onClick={handleStart}
                  className="flex h-32 w-32 items-center justify-center rounded-full text-xl font-extrabold tracking-wider text-black shadow-2xl transition active:scale-95"
                  style={{ background: 'var(--brand-color)', boxShadow: '0 10px 40px var(--brand-glow)' }}
                >
                  COMENZAR
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-card p-5 text-center">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Km del mes</div>
            <div className="text-6xl font-extrabold tabular-nums text-primary">{monthStats.km.toFixed(2)}</div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <StatCard label="Carreras" value={String(monthStats.count)} />
            <StatCard label="Ritmo" value={fmtPace(monthStats.pace)} />
            <StatCard label="Tiempo" value={fmtTime(monthStats.time)} />
          </div>

          <h2 className="mt-5 text-sm font-semibold text-muted-foreground">Actividad reciente</h2>
          <div className="mt-2 space-y-2">
            {runs.length === 0 && (
              <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
                Aún no hay carreras registradas.
              </p>
            )}
            {runs.map(r => (
              <RunCard key={r.id} run={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-card p-3 text-center">
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="mt-1 text-base font-bold tabular-nums">{value}</div>
  </div>
);

const Metric = ({ label, value, big, primary }: { label: string; value: string; big?: boolean; primary?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className={`mt-1 font-extrabold tabular-nums ${big ? 'text-3xl' : 'text-xl'} ${primary ? 'text-primary' : 'text-foreground'}`}>{value}</div>
  </div>
);

const RunCard = ({ run }: { run: RunRow }) => {
  const { resolved } = useTheme();
  const tileUrl = resolved === 'dark' ? DARK_TILES : LIGHT_TILES;
  const mapBg = resolved === 'dark' ? '#0b0f14' : '#e9ecef';
  const mapHeatTheme = resolved === 'dark' ? 'dark' : 'light';
  const km = Number(run.distance_meters) / 1000;
  const date = new Date(run.started_at);
  const route = (run.route_data || []) as LatLng[];
  const displayRoute = useMemo(() => smoothRouteForDisplay(route), [route]);
  const poly = useMemo(() => displayRoute.map((p) => [p.lat, p.lng] as [number, number]), [displayRoute]);
  const center: [number, number] | null = route.length > 0 ? [route[0].lat, route[0].lng] : null;

  return (
    <Link
      to={`/actividad/${run.id}`}
      className="block overflow-hidden rounded-2xl bg-card ring-offset-background transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="h-32 w-full bg-secondary">
        {center ? (
          <MapContainer
            center={center}
            zoom={14}
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            style={{ width: '100%', height: '100%', background: mapBg }}
          >
            <TileLayer url={tileUrl} attribution={TILE_ATTR} />
            <PaceHeatPolylines points={displayRoute} avgPaceSecPerKm={run.avg_pace_seconds_per_km} mapTheme={mapHeatTheme} />
            {/* Start dot */}
            {poly.length > 0 && (
              <CircleMarker
                center={poly[0]}
                radius={5}
                pathOptions={{ fillColor: '#16a34a', color: '#ffffff', weight: 2, fillOpacity: 1 }}
              />
            )}
            {/* End dot */}
            {poly.length > 1 && (
              <CircleMarker
                center={poly[poly.length - 1]}
                radius={5}
                pathOptions={{ fillColor: '#ef4444', color: '#ffffff', weight: 2, fillOpacity: 1 }}
              />
            )}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin ruta</div>
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-2xl font-extrabold tabular-nums text-primary">{km.toFixed(2)} km</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{fmtTime(run.duration_seconds)}</div>
          <div className="text-xs text-muted-foreground">{fmtPace(run.avg_pace_seconds_per_km)} /km</div>
        </div>
      </div>
    </Link>
  );
};

export default Cardio;
