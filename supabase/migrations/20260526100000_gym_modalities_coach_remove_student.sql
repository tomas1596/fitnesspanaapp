-- Modalidades del gimnasio (coach), RPC desvincular alumno, extender admin + lectura alumno.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_modalities text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.gym_modalities IS 'Modalidades que ofrece el gimnasio del coach (ej. Musculación, CrossFit, Funcional).';

-- Reemplazar firma admin (3 args) por versión con modalidades opcional (4º param con default).
DROP FUNCTION IF EXISTS public.admin_set_coach_profile(uuid, boolean, text);

CREATE OR REPLACE FUNCTION public.admin_set_coach_profile(
  p_target_user_id uuid,
  p_is_coach boolean,
  p_gym_name text DEFAULT NULL,
  p_gym_modalities text[] DEFAULT NULL
)
RETURNS TABLE (
  coach_code text,
  gym_name text,
  is_coach boolean,
  gym_modalities text[]
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
      IF p_gym_modalities IS NULL THEN
        UPDATE public.profiles pr
        SET
          gym_name = v_gym,
          updated_at = now()
        WHERE pr.user_id = p_target_user_id;
      ELSE
        UPDATE public.profiles pr
        SET
          gym_name = v_gym,
          gym_modalities = COALESCE(p_gym_modalities, '{}'::text[]),
          updated_at = now()
        WHERE pr.user_id = p_target_user_id;
      END IF;

      RETURN QUERY
      SELECT pr.coach_code::text, pr.gym_name::text, pr.is_coach, pr.gym_modalities
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
      gym_modalities = COALESCE(p_gym_modalities, '{}'::text[]),
      updated_at = now()
    WHERE pr.user_id = p_target_user_id;

    RETURN QUERY
    SELECT pr.coach_code::text, pr.gym_name::text, pr.is_coach, pr.gym_modalities
    FROM public.profiles pr
    WHERE pr.user_id = p_target_user_id;
    RETURN;
  END IF;

  PERFORM set_config('app.profiles_coach_id_rpc', '1', true);

  UPDATE public.profiles al
  SET coach_id = NULL, updated_at = now()
  WHERE al.coach_id = v_profile_id;

  PERFORM set_config('app.profiles_coach_id_rpc', '', true);

  UPDATE public.profiles pr
  SET
    is_coach = false,
    coach_code = NULL,
    gym_name = NULL,
    gym_modalities = '{}'::text[],
    updated_at = now()
  WHERE pr.user_id = p_target_user_id;

  RETURN QUERY
  SELECT NULL::text, NULL::text, false, '{}'::text[];
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_coach_profile(uuid, boolean, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_coach_profile(uuid, boolean, text, text[]) TO authenticated;

-- Directorio admin: exponer gym_modalities
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
  gym_name text,
  gym_modalities text[]
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
    pr.gym_name::text,
    COALESCE(pr.gym_modalities, '{}'::text[]) AS gym_modalities
  FROM public.profiles pr
  INNER JOIN auth.users au ON au.id = pr.user_id
  ORDER BY pr.last_active_at DESC NULLS LAST, au.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;

-- Alumno: nombre del box + modalidades del coach vinculado
DROP FUNCTION IF EXISTS public.get_linked_coach_gym();

CREATE OR REPLACE FUNCTION public.get_linked_coach_gym()
RETURNS TABLE (
  gym_name text,
  gym_modalities text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN me.coach_id IS NULL THEN NULL::text
      ELSE COALESCE(NULLIF(trim(c.gym_name::text), ''), 'Coach')::text
    END AS gym_name,
    CASE
      WHEN me.coach_id IS NULL THEN NULL::text[]
      ELSE COALESCE(c.gym_modalities, '{}'::text[])
    END AS gym_modalities
  FROM public.profiles me
  LEFT JOIN public.profiles c ON c.id = me.coach_id
  WHERE me.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_linked_coach_gym() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_linked_coach_gym() TO authenticated;

-- Coach: quitar alumno (solo si coach_id apunta al perfil del caller)
CREATE OR REPLACE FUNCTION public.coach_remove_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_profile_id uuid;
  v_updated int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT pr.id
  INTO v_coach_profile_id
  FROM public.profiles pr
  WHERE pr.user_id = auth.uid()
    AND COALESCE(pr.is_coach, false) = true;

  IF v_coach_profile_id IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.profiles_coach_id_rpc', '1', true);

  UPDATE public.profiles st
  SET coach_id = NULL, updated_at = now()
  WHERE st.id = p_student_id
    AND st.coach_id = v_coach_profile_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  PERFORM set_config('app.profiles_coach_id_rpc', '', true);

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'student_not_found_or_not_yours' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.coach_remove_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_remove_student(uuid) TO authenticated;
