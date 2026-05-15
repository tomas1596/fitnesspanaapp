-- Workout modalities: library tags + per-session exercise type + conditioning metrics on sets

ALTER TABLE public.exercises_library
  ADD COLUMN IF NOT EXISTS modalities text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.exercises_library.modalities IS
  'Tags: musculacion, crossfit, funcional, mixto. Empty {} = universal (visible in all modality filters).';

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'musculacion';

ALTER TABLE public.exercises DROP CONSTRAINT IF EXISTS exercises_modality_check;
ALTER TABLE public.exercises ADD CONSTRAINT exercises_modality_check
  CHECK (modality IN ('musculacion', 'crossfit', 'funcional'));

ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS time_seconds integer;
ALTER TABLE public.exercise_sets
  ADD COLUMN IF NOT EXISTS rounds integer;
