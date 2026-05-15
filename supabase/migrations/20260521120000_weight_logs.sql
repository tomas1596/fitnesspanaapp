-- Historial de peso: una fila por pesaje (la tabla body_measurements es snapshot 1:1 por user_id UNIQUE).
CREATE TABLE public.weight_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  weight NUMERIC NOT NULL CHECK (weight > 0 AND weight < 700),
  log_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX weight_logs_user_log_date_desc
  ON public.weight_logs (user_id, log_date DESC, created_at DESC);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight_logs"
  ON public.weight_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight_logs"
  ON public.weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight_logs"
  ON public.weight_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight_logs"
  ON public.weight_logs FOR DELETE USING (auth.uid() = user_id);

-- Importar medición única legada (body_measurements) al historial
INSERT INTO public.weight_logs (user_id, weight, log_date, created_at)
SELECT
  bm.user_id,
  bm.weight,
  COALESCE(bm.measurement_date, (bm.created_at AT TIME ZONE 'UTC')::date),
  bm.created_at
FROM public.body_measurements bm
WHERE bm.weight IS NOT NULL;
