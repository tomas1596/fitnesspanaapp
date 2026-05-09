import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { History as HistoryIcon, Pause, Play, Square } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/useTheme';

type LatLng = { lat: number; lng: number; t: number };
type RunRow = {
  id: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number;
  avg_pace_seconds_per_km: number;
  route: LatLng[];
};

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// Haversine
const distM = (a: LatLng, b: LatLng) => {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const fmtPace = (sPerKm: number) => {
  if (!isFinite(sPerKm) || sPerKm <= 0) return "--'--\"";
  const m = Math.floor(sPerKm / 60);
  const s = Math.floor(sPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
};

const Recenter = ({ center }: { center: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom() < 15 ? 16 : map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

const dotIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:#22FF55;border:3px solid #0b0f14;box-shadow:0 0 12px #22FF55;"></div>',
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

  const [tab, setTab] = useState<'run' | 'history'>('run');

  const [position, setPosition] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [phase, setPhase] = useState<'idle' | 'active' | 'paused'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0); // meters
  const [holdProgress, setHoldProgress] = useState(0); // 0..1 for finish hold
  const [countdown, setCountdown] = useState<number | null>(null);
  const startedAtRef = useRef<Date | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);

  // History
  const [runs, setRuns] = useState<RunRow[]>([]);

  const fetchRuns = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cardio_runs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });
    setRuns(((data || []) as unknown) as RunRow[]);
  }, [user]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // Initial geolocation lock
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPosition([p.coords.latitude, p.coords.longitude]),
      () => setPosition([19.4326, -99.1332]),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Start GPS watch
  const startWatch = () => {
    if (!navigator.geolocation) {
      toast({ title: 'GPS no disponible', variant: 'destructive' });
      return false;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const point: LatLng = { lat: p.coords.latitude, lng: p.coords.longitude, t: Date.now() };
        setPosition([point.lat, point.lng]);
        setRoute(prev => {
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          const d = distM(last, point);
          if (d < 3) return prev; // ignore noise
          if (p.coords.accuracy && p.coords.accuracy > 30) return prev;
          setDistance(x => x + d);
          return [...prev, point];
        });
      },
      (err) => console.warn('geo err', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
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
    setRoute([]); setDistance(0); setSeconds(0);
    setPhase('active');
  };

  const handlePause = () => {
    setPhase(p => (p === 'active' ? 'paused' : 'active'));
  };

  const finishRun = async () => {
    stopWatch();
    const dur = seconds;
    const dist = distance;
    const km = dist / 1000;
    const pace = km > 0 ? Math.round(dur / km) : 0;
    successChime();
    speak('carrera finalizada');
    setPhase('idle');
    if (dist < 10 || dur < 5) {
      toast({ title: 'Carrera muy corta', description: 'No se guardó.' });
      setRoute([]); setDistance(0); setSeconds(0);
      return;
    }
    if (user) {
      const { error } = await supabase.from('cardio_runs').insert({
        user_id: user.id,
        started_at: (startedAtRef.current || new Date()).toISOString(),
        duration_seconds: dur,
        distance_meters: dist,
        avg_pace_seconds_per_km: pace,
        route: route as never,
      });
      if (!error) {
        toast({ title: '¡Carrera guardada!', description: `${km.toFixed(2)} km · ${fmtTime(dur)}` });
        fetchRuns();
      }
    }
    setRoute([]); setDistance(0); setSeconds(0);
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

  const polyline = useMemo(
    () => route.map(p => [p.lat, p.lng] as [number, number]),
    [route]
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header tabs */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-2xl font-bold">Modo Ruta</h1>
        <div className="flex items-center gap-1 rounded-full bg-card p-1">
          <button
            onClick={() => setTab('run')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'run' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >Correr</button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === 'history' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          ><HistoryIcon className="h-3.5 w-3.5" /> Actividad</button>
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
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">PPM</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">--</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Tiempo</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmtTime(seconds)}</div>
                </div>
              </div>

              {/* Center: massive distance */}
              <div className="flex flex-1 flex-col items-center justify-center">
                <div
                  className="font-extrabold tabular-nums text-primary"
                  style={{ fontSize: 'clamp(5rem, 28vw, 10rem)', lineHeight: 1 }}
                >
                  {km.toFixed(2).replace('.', ',')}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Kilómetros</div>
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
                    {polyline.length > 1 && (
                      <Polyline positions={polyline} pathOptions={{ color: '#22FF55', weight: 5, opacity: 0.9 }} />
                    )}
                    <Marker position={position} icon={dotIcon} />
                    <Recenter center={position} />
                  </MapContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Mapa no disponible</div>
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
                  <Metric label="Elevación" value="0 m" />
                  <Metric label="PPM" value="--" />
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
                {polyline.length > 1 && (
                  <Polyline positions={polyline} pathOptions={{ color: '#22FF55', weight: 5, opacity: 0.9 }} />
                )}
                {position && <Marker position={position} icon={dotIcon} />}
                <Recenter center={position} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Obteniendo ubicación…
              </div>
            )}
          </div>

          {/* Idle controls floating over map */}
          <div className="pointer-events-none absolute bottom-4 left-0 right-0 z-30 flex flex-col items-center gap-3">
            {phase === 'idle' && (
              <div className="pointer-events-auto flex flex-col items-center gap-3">
                <button
                  onClick={handleStart}
                  className="flex h-32 w-32 items-center justify-center rounded-full text-xl font-extrabold tracking-wider text-black shadow-2xl transition active:scale-95"
                  style={{ background: '#22FF55', boxShadow: '0 10px 40px rgba(34,255,85,0.45)' }}
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
  const km = Number(run.distance_meters) / 1000;
  const date = new Date(run.started_at);
  const route = (run.route || []) as LatLng[];
  const center: [number, number] | null = route.length > 0 ? [route[0].lat, route[0].lng] : null;
  const poly = route.map(p => [p.lat, p.lng] as [number, number]);

  return (
    <div className="overflow-hidden rounded-2xl bg-card">
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
            {poly.length > 1 && (
              <Polyline positions={poly} pathOptions={{ color: '#22FF55', weight: 4 }} />
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
    </div>
  );
};

export default Cardio;
