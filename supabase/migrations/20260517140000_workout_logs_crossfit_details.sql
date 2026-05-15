-- Detalle estructurado CrossFit (sub-tipos AMRAP, EMOM, For Time, clásico/Tabata)
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS crossfit_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workout_logs.crossfit_details IS 'JSON: subtype, bloques, ejercicios manuales, tiempos y resultados (versionado en app)';
