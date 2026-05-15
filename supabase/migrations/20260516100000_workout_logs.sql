-- Sesiones WOD / Circuito: métricas agregadas por día y modalidad (opcional por ejercicio)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  modality text NOT NULL CHECK (modality IN ('crossfit', 'funcional')),
  total_time text,
  split_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  round_count integer,
  circuit_name text,
  work_rest_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workout_date, modality)
);

COMMENT ON COLUMN public.workout_logs.total_time IS 'Tiempo total libre (ej. mm:ss)';
COMMENT ON COLUMN public.workout_logs.split_times IS 'Tiempos parciales: [{ "label": "...", "time": "02:30" }, ...]';
COMMENT ON COLUMN public.workout_logs.round_count IS 'Rondas / tandas completadas';
COMMENT ON COLUMN public.workout_logs.circuit_name IS 'Nombre del circuito (funcional)';
COMMENT ON COLUMN public.workout_logs.work_rest_note IS 'Trabajo/descanso general (texto libre)';

CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx ON public.workout_logs (user_id, workout_date);

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS workout_log_id uuid REFERENCES public.workout_logs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS exercises_workout_log_id_idx ON public.exercises (workout_log_id);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_logs_select" ON public.workout_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "workout_logs_insert" ON public.workout_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs_update" ON public.workout_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "workout_logs_delete" ON public.workout_logs
  FOR DELETE USING (auth.uid() = user_id);
