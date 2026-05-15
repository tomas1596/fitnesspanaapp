-- Pulido Modo Gimnasio: notas del coach, vínculo a rutina en logs, días 1–6, leaderboard RPC.

DELETE FROM public.gym_routines WHERE day_number > 6;

ALTER TABLE public.gym_routines DROP CONSTRAINT IF EXISTS gym_routines_day_number_check;
ALTER TABLE public.gym_routines ADD CONSTRAINT gym_routines_day_number_check
  CHECK (day_number >= 1 AND day_number <= 6);

ALTER TABLE public.gym_routines
  ADD COLUMN IF NOT EXISTS coach_notes text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.gym_routines.coach_notes IS 'Instrucciones del coach visibles en la pizarra del alumno (solo lectura).';

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS gym_routine_id uuid REFERENCES public.gym_routines (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workout_logs.gym_routine_id IS 'Registro asociado a una rutina de gimnasio (ranking entre alumnos del coach).';

CREATE INDEX IF NOT EXISTS workout_logs_gym_routine_date_idx
  ON public.workout_logs (gym_routine_id, workout_date)
  WHERE gym_routine_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_gym_routine_leaderboard(
  p_gym_routine_id uuid,
  p_workout_date date
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_time text,
  round_count integer,
  work_rest_note text,
  modality text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach uuid;
BEGIN
  SELECT gr.coach_id INTO v_coach
  FROM public.gym_routines gr
  WHERE gr.id = p_gym_routine_id;

  IF v_coach IS NULL THEN
    RAISE EXCEPTION 'gym routine not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND (pr.coach_id = v_coach OR pr.id = v_coach)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    wl.user_id,
    btrim(
      concat_ws(
        ' ',
        coalesce(pr.first_name, ''),
        coalesce(pr.last_name, '')
      )
    ) AS display_name,
    pr.avatar_url,
    wl.total_time,
    wl.round_count,
    wl.work_rest_note,
    wl.modality
  FROM public.workout_logs wl
  INNER JOIN public.profiles pr ON pr.user_id = wl.user_id
  WHERE wl.gym_routine_id = p_gym_routine_id
    AND wl.workout_date = p_workout_date
    AND wl.modality IN ('crossfit', 'funcional')
    AND (pr.coach_id = v_coach OR pr.id = v_coach);
END;
$$;

REVOKE ALL ON FUNCTION public.get_gym_routine_leaderboard(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gym_routine_leaderboard(uuid, date) TO authenticated;
