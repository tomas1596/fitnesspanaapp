-- Permite varios workout_logs por día y modalidad cuando pertenecen a rutinas de gimnasio distintas
-- (y sigue permitiendo como máximo un log «personal» por día/modalidad con gym_routine_id NULL).

ALTER TABLE public.workout_logs
  DROP CONSTRAINT IF EXISTS workout_logs_user_id_workout_date_modality_key;

ALTER TABLE public.workout_logs
  ADD CONSTRAINT workout_logs_user_day_modality_gym_unique
  UNIQUE NULLS NOT DISTINCT (user_id, workout_date, modality, gym_routine_id);
