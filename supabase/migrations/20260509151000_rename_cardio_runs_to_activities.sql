-- Align storage with product model: activities (cardio runs)
ALTER TABLE public.cardio_runs RENAME TO activities;

ALTER INDEX public.idx_cardio_runs_user_started RENAME TO idx_activities_user_started;

ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS avg_heart_rate integer,
  ADD COLUMN IF NOT EXISTS cadence integer,
  ADD COLUMN IF NOT EXISTS elevation_gain_m numeric,
  ADD COLUMN IF NOT EXISTS elevation_loss_m numeric;
