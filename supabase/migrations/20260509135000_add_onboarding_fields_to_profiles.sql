ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS activity_level text,
ADD COLUMN IF NOT EXISTS fitness_goal text;
