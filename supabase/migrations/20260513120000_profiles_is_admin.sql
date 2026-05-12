-- Admin flag: set manually in Supabase; app reads profiles.is_admin only.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
