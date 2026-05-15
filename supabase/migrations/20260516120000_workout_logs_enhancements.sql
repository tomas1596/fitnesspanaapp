-- Enriquecimiento workout_logs: WOD (objetivo vs real), título y snapshot de movimientos
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS target_time text;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS wod_title text;
ALTER TABLE public.workout_logs ADD COLUMN IF NOT EXISTS movements jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workout_logs.target_time IS 'CrossFit: tiempo cap/objetivo del box (texto libre, ej. 15:00)';
COMMENT ON COLUMN public.workout_logs.total_time IS 'Tiempo real completado (CF) o tiempo total del bloque (funcional)';
COMMENT ON COLUMN public.workout_logs.wod_title IS 'Nombre corto del WOD (CrossFit)';
COMMENT ON COLUMN public.workout_logs.movements IS 'Snapshot ordenado: [{ "id": uuid, "name": text, "muscle_group": text }, ...]';
