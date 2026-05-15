-- Bloques dentro de WOD / circuito funcional: metadatos en workout_logs + enlace por ejercicio
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS conditioning_block_id text;

COMMENT ON COLUMN public.exercises.conditioning_block_id IS 'ID lógico del bloque (coincide con workout_logs.block_sections[].id); CrossFit / Funcional';

CREATE INDEX IF NOT EXISTS exercises_conditioning_block_id_idx ON public.exercises (conditioning_block_id);

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS block_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.workout_logs.block_sections IS 'Bloques: [{ "id": text, "sort_order": int, "target_time": text }]';
