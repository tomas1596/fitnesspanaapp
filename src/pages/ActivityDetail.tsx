import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleMarker, MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  Footprints,
  Gauge,
  Heart,
  ListTree,
  MapPinned,
  Mountain,
  Share2,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import ShareSticker from '@/components/ShareSticker';
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
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useBrandColorHex } from '@/hooks/useBrandColorHex';
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
import { ReadableBasemapLayers, readableMapFallbackBg } from '@/components/ReadableBasemapLayers';
import { KmMilestoneMarkers } from '@/components/KmMilestoneMarkers';
import { PaceHeatPolylines } from '@/components/PaceHeatPolylines';
import { estimateRunCalories, estimateRunSteps } from '@/lib/calories';
import { paceToHexForChart } from '@/lib/paceHeatmap';
import { fmtPace, fmtTime } from '@/lib/runFormat';
import { cn } from '@/lib/utils';

type ActivityRow = Tables<'activities'>;

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

const NEON_ICON =
  'text-primary [&>svg]:drop-shadow-[0_0_10px_var(--brand-glow-sm)] dark:text-primary dark:[&>svg]:drop-shadow-[0_0_12px_var(--brand-glow)]';

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between border-b border-zinc-200/80 py-3 last:border-0 dark:border-white/10">
    <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
    <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">{value}</span>
  </div>
);

export default function ActivityDetail() {
  const brandHex = useBrandColorHex();
  const { id: legacyParamId, activityId } = useParams<{ id?: string; activityId?: string }>();
  const id = activityId ?? legacyParamId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resolved } = useTheme();
  const basemapTheme = resolved === 'dark' ? 'dark' : 'light';
  const mapBg = readableMapFallbackBg(basemapTheme);

  const [row, setRow] = useState<ActivityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [panel, setPanel] = useState<null | 'route' | 'more' | 'share'>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setRow(null);
      setFetchError(null);
      setLoading(false);
      return;
    }
    if (!user) return;
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase.from('activities').select('*').eq('id', id).maybeSingle();
    if (error) {
      setFetchError(error.message);
      setRow(null);
      setLoading(false);
      return;
    }
    if (!data) {
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
        <p className="text-sm font-medium text-muted-foreground">Cargando actividad…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-background px-4 pt-8 pb-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <div className="mx-auto mt-10 max-w-sm text-center">
          <p className="text-base font-semibold text-foreground">No se pudo cargar la actividad</p>
          <p className="mt-2 text-sm text-muted-foreground">{fetchError}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => navigate('/cardio')}
              className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground"
            >
              Ir a Cardio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!row || !started || !ended) {
    return (
      <div className="min-h-screen bg-background px-4 pt-8 pb-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <div className="mx-auto mt-10 max-w-sm text-center">
          <p className="text-base font-semibold text-foreground">Actividad no encontrada</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No existe esta actividad o no tenés permiso para verla.
          </p>
          <button
            type="button"
            onClick={() => navigate('/cardio')}
            className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            Volver a Cardio
          </button>
        </div>
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-600 transition hover:bg-destructive/10 hover:text-destructive dark:text-muted-foreground"
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

        <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="grid grid-cols-3 gap-px bg-zinc-200/55 dark:bg-white/10">
            <MetricCell
              label="Ritmo prom."
              value={fmtPace(avgPace)}
              icon={<Gauge className="h-4 w-4" aria-hidden />}
            />
            <MetricCell label="Tiempo" value={fmtTime(durationSec)} icon={<Timer className="h-4 w-4" aria-hidden />} />
            <MetricCell label="Calorías" value={String(estCalories)} icon={<Flame className="h-4 w-4" aria-hidden />} />
            <MetricCell label="Desnivel +" value={elevShort} icon={<Mountain className="h-4 w-4" aria-hidden />} />
            <MetricCell label="FC prom" value={hrLabel} icon={<Heart className="h-4 w-4" aria-hidden />} />
            <MetricCell label="Cadencia" value={cadenceLabel} icon={<Footprints className="h-4 w-4" aria-hidden />} />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setPanel('share')}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/95 px-4 py-3.5 text-left transition hover:bg-zinc-100/90 active:scale-[0.99] dark:border-white/10 dark:bg-zinc-900/85 dark:hover:bg-zinc-800/90"
          >
            <span className="flex items-center gap-3">
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-800/90', NEON_ICON)}>
                <Share2 className="h-5 w-5" />
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Compartir actividad</span>
            </span>
            <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
          </button>
          <button
            type="button"
            onClick={() => setPanel('route')}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/95 px-4 py-3.5 text-left transition hover:bg-zinc-100/90 active:scale-[0.99] dark:border-white/10 dark:bg-zinc-900/85 dark:hover:bg-zinc-800/90"
          >
            <span className="flex items-center gap-3">
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-800/90', NEON_ICON)}>
                <MapPinned className="h-5 w-5" />
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Detalles de la ruta</span>
            </span>
            <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
          </button>
          <button
            type="button"
            onClick={() => setPanel('more')}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/70 bg-zinc-50/95 px-4 py-3.5 text-left transition hover:bg-zinc-100/90 active:scale-[0.99] dark:border-white/10 dark:bg-zinc-900/85 dark:hover:bg-zinc-800/90"
          >
            <span className="flex items-center gap-3">
              <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-zinc-800/90', NEON_ICON)}>
                <ListTree className="h-5 w-5" />
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Más detalles</span>
            </span>
            <ChevronRight className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Share panel */}
      {panel === 'share' && (
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
            <span className="text-sm font-semibold">Compartir actividad</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-8">
            <p className="text-center text-xs text-muted-foreground">
              Elige el tema y presiona <strong>Compartir</strong> para exportar tu sticker.
            </p>
            <div style={{ maxWidth: '100%', overflowX: 'auto', paddingBottom: 8 }}>
              <ShareSticker
                distanceKm={km}
                durationSec={durationSec}
                avgPaceSecPerKm={avgPace}
                routePoints={routePts}
              />
            </div>
          </div>
        </div>
      )}

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
                <ReadableBasemapLayers theme={basemapTheme} />
                <PaceHeatPolylines points={displayRoutePts} avgPaceSecPerKm={avgPace} mapTheme={mapHeatTheme} />
                <KmMilestoneMarkers points={displayRoutePts} mapTheme={mapHeatTheme} />
                {/* Start dot — acento rosa */}
                {poly.length > 0 && (
                  <CircleMarker
                    center={poly[0]}
                    radius={8}
                    pathOptions={{ fillColor: brandHex, color: '#ffffff', weight: 2.5, fillOpacity: 1 }}
                  />
                )}
                {/* End dot — red */}
                {poly.length > 1 && (
                  <CircleMarker
                    center={poly[poly.length - 1]}
                    radius={8}
                    pathOptions={{ fillColor: '#ef4444', color: '#ffffff', weight: 2.5, fillOpacity: 1 }}
                  />
                )}
                <FitRouteBounds positions={poly} />
              </MapContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Sin datos de ruta</div>
            )}
          </div>

          <div
            className="shrink-0 border-t border-zinc-200/80 bg-white/95 px-3 pt-3 backdrop-blur-lg dark:border-white/10 dark:bg-zinc-950/95"
            style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
          >
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Rendimiento</p>
            <div className="h-40 w-full">
              {perfSeries.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={perfSeries} margin={{ top: 6, right: 10, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="paceNeonFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand-color)" stopOpacity={0.35} />
                        <stop offset="55%" stopColor="var(--brand-chart-mid)" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="var(--brand-chart-mid)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="elevFillSubtle" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#71717a" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#71717a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.25)" vertical={false} />
                    <XAxis
                      type="number"
                      dataKey="distKm"
                      domain={['dataMin', 'dataMax']}
                      scale="linear"
                      tick={{ fontSize: 10, fill: '#a1a1aa' }}
                      tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                      axisLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                      tickLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                    />
                    <YAxis
                      yAxisId="pace"
                      width={40}
                      domain={[paceChartRange.min, paceChartRange.max]}
                      tick={{ fontSize: 10, fill: '#a1a1aa' }}
                      tickFormatter={(v) => `${Math.floor(Number(v) / 60)}`}
                      axisLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                      tickLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                    />
                    <YAxis
                      yAxisId="elev"
                      orientation="right"
                      width={36}
                      tick={{ fontSize: 10, fill: '#a1a1aa' }}
                      axisLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                      tickLine={{ stroke: 'rgba(161,161,170,0.35)' }}
                    />
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
                    <Area
                      yAxisId="pace"
                      type="monotone"
                      dataKey="paceSecPerKm"
                      stroke="transparent"
                      strokeWidth={0}
                      fill="url(#paceNeonFill)"
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
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
                      stroke="#a1a1aa"
                      strokeWidth={1}
                      fill="url(#elevFillSubtle)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-400">
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
            <div className="rounded-2xl border border-zinc-200/80 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <DetailRow label="Ritmo más rápido (por km)" value={fastest != null ? fmtPace(fastest) : '—'} />
              <DetailRow label="Duración" value={fmtTime(durationSec)} />
              <DetailRow
                label="Tiempo transcurrido"
                value={`${started.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – ${ended.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
              />
              <DetailRow label="Elevación (ganancia / pérdida)" value={elevLabel} />
              <DetailRow label="Pasos (estimados)" value={String(displaySteps)} />
            </div>

            <h3 className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Parciales por kilómetro
            </h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <div className="flex border-b border-zinc-200/70 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:border-white/10">
                <span className="w-14 tabular-nums">Km</span>
                <span className="min-w-0 flex-1 text-center tabular-nums">Ritmo</span>
                <span className="min-w-0 flex-1 text-center tabular-nums">Tiempo</span>
                <span className="w-16 text-right tabular-nums">+/-</span>
              </div>
              {splits.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No hay kilómetros completos registrados.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200/70 dark:divide-white/10">
                  {splits.map((s, idx) => {
                    const prev = idx > 0 ? splits[idx - 1] : null;
                    const delta = prev ? s.timeSec - prev.timeSec : null;
                    const faster = delta != null && delta < 0;
                    const slower = delta != null && delta > 0;
                    const deltaText =
                      delta == null ? '—' : `${delta > 0 ? '+' : '-'}${Math.abs(Math.round(delta))}s`;
                    const isPb =
                      fastest != null && s.paceSecPerKm > 0 && Math.abs(s.paceSecPerKm - fastest) < 1e-3;
                    return (
                      <li
                        key={s.km}
                        className={cn(
                          'flex items-center gap-2 px-4 py-3 tabular-nums',
                          isPb &&
                            'bg-primary/[0.09] dark:bg-primary/[0.12]',
                        )}
                      >
                        <span className="flex w-14 shrink-0 items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-50">
                          {isPb && (
                            <Zap
                              className="h-3.5 w-3.5 shrink-0 text-primary"
                              aria-label="Parcial más rápido"
                            />
                          )}
                          {s.km}
                        </span>
                        <span className="min-w-0 flex-1 text-center text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {fmtPace(s.paceSecPerKm)}
                        </span>
                        <span className="min-w-0 flex-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          {fmtTime(Math.round(s.timeSec))}
                        </span>
                        <span
                          className={cn(
                            'w-16 shrink-0 text-right text-xs font-bold tabular-nums',
                            faster && 'text-primary',
                            slower && 'text-red-500 dark:text-red-400',
                            delta === 0 && 'text-zinc-400',
                          )}
                        >
                          {deltaText}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white px-2 py-3.5 text-center dark:bg-zinc-900 sm:px-3">
      <span className={cn('inline-flex rounded-xl bg-zinc-100/95 p-2 dark:bg-zinc-800/80', NEON_ICON)}>{icon}</span>
      <div className="text-[9px] font-semibold uppercase leading-snug tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="w-full truncate text-sm font-bold tabular-nums leading-tight text-zinc-950 dark:text-zinc-50 sm:text-[15px]">
        {value}
      </div>
    </div>
  );
}
