-- Estructura de fases / circuitos funcional (sin mezclar con CrossFit).
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS functional_details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workout_logs.functional_details IS 'Sesión funcional: fases, método de ejecución y ejercicios manuales (JSONB versionado).';
