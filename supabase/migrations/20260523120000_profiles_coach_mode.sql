-- Modo Coach (fase 1): flags de perfil, código de invitación, vínculo alumno→profe (profiles.id), nombre de gimnasio.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_coach boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_code text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_name text;

COMMENT ON COLUMN public.profiles.is_coach IS 'Usuario con rol Coach (gestión de alumnos vía código).';
COMMENT ON COLUMN public.profiles.coach_code IS 'Código de invitación único del coach (mayúsculas).';
COMMENT ON COLUMN public.profiles.coach_id IS 'FK al perfil del coach (profiles.id), no auth.users.';
COMMENT ON COLUMN public.profiles.gym_name IS 'Nombre del gimnasio / box del coach (UI).';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_coach_code_unique
  ON public.profiles (coach_code)
  WHERE coach_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_coach_id_idx
  ON public.profiles (coach_id);

-- ─── Generador de código tipo PANA-X7B9 (único en tabla) ────────────────────

CREATE OR REPLACE FUNCTION public._generate_unique_coach_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempt int := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 80 THEN
      RAISE EXCEPTION 'could not allocate unique coach_code';
    END IF;

    v_code := 'PANA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.coach_code = v_code) THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._generate_unique_coach_code() FROM PUBLIC;

-- ─── Admin: actualizar rol coach / gimnasio (SECURITY DEFINER) ───────────────

CREATE OR REPLACE FUNCTION public.admin_set_coach_profile(
  p_target_user_id uuid,
  p_is_coach boolean,
  p_gym_name text DEFAULT NULL
)
RETURNS TABLE (
  coach_code text,
  gym_name text,
  is_coach boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_admin boolean;
  v_profile_id uuid;
  v_was_coach boolean;
  v_new_code text;
  v_gym text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO v_actor_admin
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF NOT v_actor_admin THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT pr.id, COALESCE(pr.is_coach, false)
  INTO v_profile_id, v_was_coach
  FROM public.profiles pr
  WHERE pr.user_id = p_target_user_id
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  v_gym := NULLIF(trim(COALESCE(p_gym_name, '')), '');

  IF p_is_coach THEN
    IF v_was_coach THEN
      UPDATE public.profiles pr
      SET
        gym_name = v_gym,
        updated_at = now()
      WHERE pr.user_id = p_target_user_id;

      RETURN QUERY
      SELECT pr.coach_code::text, pr.gym_name::text, pr.is_coach
      FROM public.profiles pr
      WHERE pr.user_id = p_target_user_id;
      RETURN;
    END IF;

    v_new_code := public._generate_unique_coach_code();

    UPDATE public.profiles pr
    SET
      is_coach = true,
      coach_code = v_new_code,
      gym_name = v_gym,
      updated_at = now()
    WHERE pr.user_id = p_target_user_id;

    RETURN QUERY
    SELECT pr.coach_code::text, pr.gym_name::text, pr.is_coach
    FROM public.profiles pr
    WHERE pr.user_id = p_target_user_id;
    RETURN;
  END IF;

  -- Revocar coach
  UPDATE public.profiles al
  SET coach_id = NULL, updated_at = now()
  WHERE al.coach_id = v_profile_id;

  UPDATE public.profiles pr
  SET
    is_coach = false,
    coach_code = NULL,
    gym_name = NULL,
    updated_at = now()
  WHERE pr.user_id = p_target_user_id;

  RETURN QUERY
  SELECT NULL::text AS coach_code, NULL::text AS gym_name, false AS is_coach;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_coach_profile(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_coach_profile(uuid, boolean, text) TO authenticated;

-- ─── Directorio admin: exponer campos coach ──────────────────────────────────

DROP FUNCTION IF EXISTS public.admin_user_directory();

CREATE FUNCTION public.admin_user_directory()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  registered_at timestamptz,
  subscription_role text,
  subscription_expires_at timestamptz,
  premium_until timestamptz,
  is_admin boolean,
  notified_tester boolean,
  notified_premium boolean,
  theme text,
  last_active_at timestamptz,
  is_coach boolean,
  coach_code text,
  gym_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pr.user_id,
    COALESCE(au.email::text, '') AS email,
    pr.first_name::text,
    pr.last_name::text,
    pr.avatar_url::text,
    au.created_at AS registered_at,
    pr.subscription_role::text,
    pr.subscription_expires_at,
    pr.premium_until,
    COALESCE(pr.is_admin, false) AS is_admin,
    COALESCE(pr.notified_tester, false) AS notified_tester,
    COALESCE(pr.notified_premium, false) AS notified_premium,
    COALESCE(pr.theme::text, 'default') AS theme,
    pr.last_active_at,
    COALESCE(pr.is_coach, false) AS is_coach,
    pr.coach_code::text,
    pr.gym_name::text
  FROM public.profiles pr
  INNER JOIN auth.users au ON au.id = pr.user_id
  ORDER BY pr.last_active_at DESC NULLS LAST, au.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
