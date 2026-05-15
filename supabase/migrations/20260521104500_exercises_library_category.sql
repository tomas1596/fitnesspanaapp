-- Categoría de biblioteca por tipo de entreno (filtros globales UI)
ALTER TABLE public.exercises_library
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.exercises_library SET category =
  CASE
    WHEN modalities @> ARRAY['crossfit'] THEN 'CrossFit'
    WHEN modalities @> ARRAY['funcional'] THEN 'Funcional'
    ELSE 'Musculación'
  END
WHERE category IS NULL OR trim(category) = '';

ALTER TABLE public.exercises_library
  ALTER COLUMN category SET DEFAULT 'Musculación';

UPDATE public.exercises_library SET category = 'Musculación' WHERE category IS NULL;

ALTER TABLE public.exercises_library
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE public.exercises_library DROP CONSTRAINT IF EXISTS exercises_library_category_check;

ALTER TABLE public.exercises_library ADD CONSTRAINT exercises_library_category_check
  CHECK (category IN ('Musculación', 'CrossFit', 'Funcional'));

COMMENT ON COLUMN public.exercises_library.category IS
  'Musculación | CrossFit | Funcional — alineado con pestañas de entreno. modalities[] puede seguir usando tags compat.';
