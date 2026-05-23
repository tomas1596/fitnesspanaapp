-- Variantes de rutina por día (ej. Opción A / B) en la misma modalidad.

ALTER TABLE public.gym_routines
  ADD COLUMN IF NOT EXISTS variant_name text;

COMMENT ON COLUMN public.gym_routines.variant_name IS
  'Etiqueta opcional de variante (ej. Opción A). NULL = rutina por defecto del día.';

UPDATE public.gym_routines
SET variant_name = NULL
WHERE variant_name IS NOT NULL AND btrim(variant_name) = '';

DROP INDEX IF EXISTS public.gym_routines_coach_modality_day_unique;

CREATE UNIQUE INDEX gym_routines_coach_modality_day_variant_unique
  ON public.gym_routines (coach_id, modality, day_number, variant_name)
  NULLS NOT DISTINCT;
