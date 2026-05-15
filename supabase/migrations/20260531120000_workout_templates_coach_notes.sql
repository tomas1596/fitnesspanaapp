-- Notas del coach en plantillas (gimnasio / biblioteca profe).
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS coach_notes TEXT DEFAULT NULL;
