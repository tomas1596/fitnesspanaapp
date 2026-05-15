-- Categorías para Mis Rutinas (musculación vs conditioning estructurado) + snapshot JSON CF/Func.

ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS routine_category TEXT NOT NULL DEFAULT 'musculacion';

ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS structured_payload JSONB DEFAULT NULL;

ALTER TABLE public.workout_templates
  ADD CONSTRAINT workout_templates_routine_category_check
  CHECK (routine_category IN ('musculacion', 'crossfit', 'funcional'));
