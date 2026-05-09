ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS steps integer;
