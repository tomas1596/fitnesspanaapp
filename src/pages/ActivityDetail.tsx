import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  ChevronRight,
  Heart,
  ListTree,
  MapPinned,
  Mountain,
  Timer,
  Trash2,
} from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useTheme } from '@/hooks/useTheme';
import {
  buildPerformanceSeries,
  computeKmSplits,
  fastestSplitPace,
  parseStoredSplits,
  smoothRouteForDisplay,
  type LatLng,
} from '@/lib/runAnalysis';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KmMilestoneMarkers } from '@/components/KmMilestoneMarkers';
import { PaceHeatPolylines } from '@/components/PaceHeatPolylines';
import { estimateRunCalories, estimateRunSteps } from '@/lib/calories';
import { paceToHexForChart } from '@/lib/paceHeatmap';
import { fmtPace, fmtTime } from '@/lib/runFormat';
import { cn } from '@/lib/utils';

type ActivityRow = Tables<'activities'>;

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

function FitRouteBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [56, 56], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

function defaultTitleForDate(d: Date) {
  const h = d.getHours();
  let label = 'Carrera';
  if (h >= 5 && h < 12) label = 'Carrera matutina';
  else if (h >= 12 && h < 19) label = 'Carrera vespertina';
  else label = 'Carrera nocturna';
  return label;
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
  </div>
);

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolved } = useTheme();
  const tileUrl = resolved === 'dark' ? DARK_TILES : LIGHT_TILES;
  const mapBg = resolved === 'dark' ? '#0b0f14' : '#e9ecef';

  const [row, setRow] = useState<ActivityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleDraft, setTitleDraft] = useState('');
  const [panel, setPanel] = useState<null | 'route' | 'more'>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    const { data, error } = await supabase.from('activities').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      setRow(null);
      setLoading(false);
      return;
    }
    const r = data as ActivityRow;
    if (r.user_id !== user.id) {
      setRow(null);
      setLoading(false);
      return;
    }
    setRow(r);
    setTitleDraft(r.title || defaultTitleForDate(new Date(r.started_at)));
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const routePts = useMemo(() => {
    const r = row as (ActivityRow & { route?: unknown }) | null;
    const raw = r?.route_data ?? r?.route;
    return (Array.isArray(raw) ? raw : []) as LatLng[];
  }, [row]);
  const mapHeatTheme = resolved === 'dark' ? 'dark' : 'light';
  const displayRoutePts = useMemo(() => smoothRouteForDisplay(routePts), [routePts]);
  const poly = useMemo(
    () => displayRoutePts.map((p) => [p.lat, p.lng] as [number, number]),
    [displayRoutePts],
  );
  const center: [number, number] | null = poly.length > 0 ? poly[0] : null;

  const km = row ? Number(row.distance_meters) / 1000 : 0;
  const durationSec = row?.duration_seconds ?? 0;
  const avgPace = row?.avg_pace_seconds_per_km ?? 0;

  const estCalories = useMemo(() => {
    if (!row) return 0;
    if (row.calories != null) return row.calories;
    return estimateRunCalories(km);
  }, [row, km]);

  const displaySteps = useMemo(() => {
    if (!row) return 0;
    if (row.steps != null) return row.steps;
    return estimateRunSteps(km);
  }, [row, km]);

  const elevGain = row?.elevation_gain_m != null ? Number(row.elevation_gain_m) : null;
  const elevLoss = row?.elevation_loss_m != null ? Number(row.elevation_loss_m) : null;
  const elevLabel =
    elevGain != null || elevLoss != null
      ? `${elevGain != null ? `${Math.round(elevGain)} m` : '—'} / ${elevLoss != null ? `${Math.round(elevLoss)} m` : '—'}`
      : '—';

  const elevShort =
    elevGain != null ? `${Math.round(elevGain)} m` : routePts.length > 1 ? '0 m' : '—';

  const hrLabel = row?.avg_heart_rate != null ? String(row.avg_heart_rate) : '--';
  const cadenceLabel = row?.cadence != null ? String(row.cadence) : '--';

  const splits = useMemo(() => {
    const stored = row ? parseStoredSplits(row.splits) : null;
    if (stored && stored.length > 0) return stored;
    return computeKmSplits(routePts);
  }, [row, routePts]);
  const fastest = fastestSplitPace(splits);
  const perfSeries = useMemo(
    () => buildPerformanceSeries(routePts, elevGain),
    [routePts, elevGain],
  );

  const paceChartRange = useMemo(() => {
    const vals = perfSeries.map((p) => p.paceSecPerKm).filter((v) => v > 0);
    if (vals.length === 0) return { min: avgPace * 0.97, max: avgPace * 1.03 };
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = Math.max(1, (mx - mn) * 0.12);
    return { min: mn - pad, max: mx + pad };
  }, [perfSeries, avgPace]);

  const started = row ? new Date(row.started_at) : null;
  const ended =
    row && started ? new Date(started.getTime() + durationSec * 1000) : null;

  const saveTitle = async () => {
    if (!row || !id) return;
    const t = titleDraft.trim() || defaultTitleForDate(new Date(row.started_at));
    setTitleDraft(t);
    await supabase.from('activities').update({ title: t }).eq('id', id);
    setRow((prev) => (prev ? { ...prev, title: t } : null));
  };

  const handleDeleteActivity = async () => {
    if (!id) return;
    await supabase.from('activities').delete().eq('id', id);
    setDeleteOpen(false);
    navigate('/cardio');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!row || !started || !ended) {
    return (
      <div className="min-h-screen bg-background px-4 pt-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <p className="mt-8 text-center text-muted-foreground">Actividad no encontrada.</p>
      </div>
    );
  }

  const dateLine = `${started.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })} · ${started.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-secondary"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">Detalle de actividad</span>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          aria-label="Eliminar actividad"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </header>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta actividad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará de forma permanente esta carrera y sus datos asociados. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteActivity()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="px-4 pt-5">
        <p className="text-xs font-medium capitalize text-muted-foreground">{dateLine}</p>

        <input
          className="mt-2 w-full border-0 bg-transparent text-xl font-bold tracking-tight text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:ring-0"
          value={titleDraft}
          placeholder={defaultTitleForDate(started)}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => saveTitle()}
        />

        <div className="mt-6">
          <div className="flex items-baseline gap-2">
            <span
              className="font-extrabold tabular-nums tracking-tight text-foreground"
              style={{ fontSize: 'clamp(3rem, 14vw, 4.5rem)', lineHeight: 0.95 }}
            >
              {km.toFixed(2).replace('.', ',')}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">kilómetros</p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-x-2 gap-y-5">
          <MetricCell label="Ritmo prom." value={fmtPace(avgPace)} />
          <MetricCell label="Tiempo" value={fmtTime(durationSec)} />
          <MetricCell label="Calorías" value={String(estCalories)} />
          <MetricCell label="Desnivel positivo" value={elevShort} />
          <MetricCell label="FC prom" value={hrLabel} />
          <MetricCell label="Cadencia" value={cadenceLabel} />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setPanel('route')}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <MapPinned className="h-5 w-5 text-primary" />
              </span>
              <span className="font-semibold">Detalles de la ruta</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setPanel('more')}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                <ListTree className="h-5 w-5 text-primary" />
              </span>
              <span className="font-semibold">Más detalles</span>
            </span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Route panel */}
      {panel === 'route' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="relative z-20 flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-2 py-2 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
              aria-label="Cerrar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">Detalles de la ruta</span>
          </div>

          <div className="relative min-h-0 flex-1">
            {center ? (
              <MapContainer
                center={center}
                zoom={14}
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full"
                style={{ background: mapBg }}
              >
                <TileLayer url={tileUrl} attribution={TILE_ATTR} />
                <PaceHeatPolylines points={displayRoutePts} avgPaceSecPerKm={avgPace} mapTheme={mapHeatTheme} />
                <KmMilestoneMarkers points={displayRoutePts} mapTheme={mapHeatTheme} />
                <FitRouteBounds positions={poly} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Sin datos de ruta</div>
            )}

            <div className="pointer-events-none absolute left-3 right-3 top-3 z-[500] flex flex-wrap gap-2">
              <FloatStat label="Ritmo prom." value={fmtPace(avgPace)} icon={<Timer className="h-3.5 w-3.5 text-primary" />} />
              <FloatStat label="Desnivel +" value={elevShort} icon={<Mountain className="h-3.5 w-3.5 text-primary" />} />
              <FloatStat label="PPM" value={hrLabel} icon={<Heart className="h-3.5 w-3.5 text-primary" />} />
            </div>
          </div>

          <div
            className="shrink-0 border-t border-border bg-card/95 px-2 pt-2 backdrop-blur-lg"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Rendimiento
            </p>
            <div className="h-36 w-full">
              {perfSeries.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={perfSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="distKm"
                      domain={['dataMin', 'dataMax']}
                      scale="linear"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                      label={{ value: 'km', position: 'insideBottomRight', offset: -4, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      yAxisId="pace"
                      width={36}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v) => `${Math.floor(Number(v) / 60)}`}
                    />
                    <YAxis yAxisId="elev" orientation="right" width={32} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelFormatter={(l) => `${Number(l).toFixed(2)} km`}
                      formatter={(value: number | string, name: string) => {
                        const n = typeof value === 'number' ? value : Number(value);
                        if (name === 'paceSecPerKm') return [fmtPace(n), 'Ritmo'];
                        if (name === 'elevM') return [`${Math.round(n)} m`, 'Elev.'];
                        return [value, name];
                      }}
                    />
                    {perfSeries.length > 1 &&
                      perfSeries.slice(0, -1).map((_, i) => {
                        const slice = [perfSeries[i], perfSeries[i + 1]];
                        const pm = (slice[0].paceSecPerKm + slice[1].paceSecPerKm) / 2;
                        const stroke = paceToHexForChart(pm, paceChartRange.min, paceChartRange.max, mapHeatTheme);
                        return (
                          <Line
                            key={`pace-seg-${i}`}
                            data={slice}
                            yAxisId="pace"
                            type="linear"
                            dataKey="paceSecPerKm"
                            stroke={stroke}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                            connectNulls
                          />
                        );
                      })}
                    <Area
                      yAxisId="elev"
                      type="monotone"
                      dataKey="elevM"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      fill="url(#elevFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sin suficientes puntos para el gráfico
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* More details panel */}
      {panel === 'more' && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-2 py-2 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
              aria-label="Cerrar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold">Más detalles</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
            <div className="rounded-2xl border border-border bg-card px-4">
              <DetailRow label="Ritmo más rápido (por km)" value={fastest != null ? fmtPace(fastest) : '—'} />
              <DetailRow label="Duración" value={fmtTime(durationSec)} />
              <DetailRow
                label="Tiempo transcurrido"
                value={`${started.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${ended.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
              />
              <DetailRow label="Elevación (ganancia / pérdida)" value={elevLabel} />
              <DetailRow label="Pasos (estimados)" value={String(displaySteps)} />
            </div>

            <h3 className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Parciales por kilómetro
            </h3>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Km</th>
                    <th className="px-3 py-2">Ritmo</th>
                    <th className="px-3 py-2">Tiempo</th>
                    <th className="px-3 py-2 text-right">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        No hay kilómetros completos registrados.
                      </td>
                    </tr>
                  ) : (
                    splits.map((s, idx) => {
                      const prev = idx > 0 ? splits[idx - 1] : null;
                      const delta = prev ? s.timeSec - prev.timeSec : null;
                      const faster = delta != null && delta < 0;
                      const slower = delta != null && delta > 0;
                      const deltaText =
                        delta == null ? '—' : `${delta > 0 ? '+' : '-'}${Math.abs(Math.round(delta))}s`;
                      return (
                        <tr key={s.km} className="border-b border-border/80 last:border-0">
                          <td className="px-3 py-2.5 font-semibold tabular-nums">{s.km}</td>
                          <td className="px-3 py-2.5 tabular-nums">{fmtPace(s.paceSecPerKm)}</td>
                          <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                            {fmtTime(Math.round(s.timeSec))}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2.5 text-right text-xs font-bold tabular-nums',
                              faster && 'text-[#22FF55]',
                              slower && 'text-red-500',
                              delta === 0 && 'text-muted-foreground',
                            )}
                          >
                            {deltaText}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function FloatStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="pointer-events-auto rounded-2xl bg-white/95 px-3 py-2 shadow-lg ring-1 ring-black/5 dark:bg-zinc-900/95 dark:ring-white/10">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-extrabold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
