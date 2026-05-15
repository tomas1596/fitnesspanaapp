-- Biblioteca de rutinas del gimnasio (plantillas por coach, visibles a usuarios autenticados).

CREATE TABLE public.gym_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  modality text NOT NULL CHECK (modality IN ('musculacion', 'crossfit', 'funcional')),
  day_number integer NOT NULL CHECK (day_number >= 1 AND day_number <= 7),
  title text NOT NULL DEFAULT '',
  workout_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX gym_routines_coach_modality_day_unique
  ON public.gym_routines (coach_id, modality, day_number);

CREATE INDEX gym_routines_coach_modality_idx ON public.gym_routines (coach_id, modality);

COMMENT ON TABLE public.gym_routines IS 'Rutinas plantilla del coach (profiles.id); lectura para cualquier usuario autenticado.';
COMMENT ON COLUMN public.gym_routines.coach_id IS 'profiles.id del coach (no auth.users).';

ALTER TABLE public.gym_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_routines_select_authenticated
  ON public.gym_routines FOR SELECT TO authenticated USING (true);

CREATE POLICY gym_routines_insert_own_coach
  ON public.gym_routines FOR INSERT TO authenticated WITH CHECK (
    coach_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY gym_routines_update_own_coach
  ON public.gym_routines FOR UPDATE TO authenticated USING (
    coach_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  ) WITH CHECK (
    coach_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY gym_routines_delete_own_coach
  ON public.gym_routines FOR DELETE TO authenticated USING (
    coach_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Registrar resultado de rutina de musculación también en workout_logs (antes solo CF / Funcional).
ALTER TABLE public.workout_logs DROP CONSTRAINT IF EXISTS workout_logs_modality_check;
ALTER TABLE public.workout_logs ADD CONSTRAINT workout_logs_modality_check
  CHECK (modality IN ('musculacion', 'crossfit', 'funcional'));
