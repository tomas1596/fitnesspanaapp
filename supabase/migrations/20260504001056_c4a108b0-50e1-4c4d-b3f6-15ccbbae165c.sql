CREATE TABLE public.cardio_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  distance_meters NUMERIC NOT NULL DEFAULT 0,
  avg_pace_seconds_per_km INTEGER NOT NULL DEFAULT 0,
  route JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cardio_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own runs" ON public.cardio_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON public.cardio_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.cardio_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own runs" ON public.cardio_runs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_cardio_runs_user_started ON public.cardio_runs(user_id, started_at DESC);