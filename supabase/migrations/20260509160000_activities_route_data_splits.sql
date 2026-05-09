ALTER TABLE public.activities RENAME COLUMN route TO route_data;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS splits jsonb NOT NULL DEFAULT '[]'::jsonb;
