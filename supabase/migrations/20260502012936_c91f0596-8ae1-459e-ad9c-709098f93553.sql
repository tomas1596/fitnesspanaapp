
-- Body measurements (current snapshot per user)
CREATE TABLE public.body_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  weight NUMERIC,
  waist NUMERIC,
  chest NUMERIC,
  arms NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own measurements" ON public.body_measurements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own measurements" ON public.body_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own measurements" ON public.body_measurements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own measurements" ON public.body_measurements FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER body_measurements_updated_at BEFORE UPDATE ON public.body_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Progress photos (front/side/back per month)
CREATE TABLE public.progress_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pose TEXT NOT NULL CHECK (pose IN ('front','side','back')),
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own photos" ON public.progress_photos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own photos" ON public.progress_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own photos" ON public.progress_photos FOR DELETE USING (auth.uid() = user_id);

-- Step logs (NEAT)
CREATE TABLE public.step_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.step_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own steps" ON public.step_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own steps" ON public.step_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own steps" ON public.step_logs FOR UPDATE USING (auth.uid() = user_id);

-- Allow half-stars on recovery (was 1-5 ints, now 0-5 with .5 increments; store as numeric)
ALTER TABLE public.recovery_logs ALTER COLUMN sleep_quality TYPE NUMERIC USING sleep_quality::numeric;
ALTER TABLE public.recovery_logs ALTER COLUMN energy_level TYPE NUMERIC USING energy_level::numeric;

-- Storage bucket for progress photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view own progress photos" ON storage.objects FOR SELECT
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own progress photos" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own progress photos" ON storage.objects FOR UPDATE
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own progress photos" ON storage.objects FOR DELETE
USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
