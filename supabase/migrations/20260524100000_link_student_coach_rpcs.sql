-- Fase 3: vínculo alumno ↔ coach con validación solo por RPC + trigger anti‑UPDATE directo de coach_id.

-- ─── Trigger: coach_id solo vía RPC marcados ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.profiles_guard_coach_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.coach_id IS NOT DISTINCT FROM OLD.coach_id THEN
    RETURN NEW;
  END IF;
  IF COALESCE(current_setting('app.profiles_coach_id_rpc', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'coach_id must be updated via link_student_to_coach or unlink_student_from_coach'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_coach_id_change ON public.profiles;

CREATE TRIGGER profiles_guard_coach_id_change
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_guard_coach_id_change();

-- ─── Admin: permitir limpieza masiva de coach_id al revocar coach ─────────────

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
    updated_at = now()
  WHERE pr.user_id = p_target_user_id;

  RETURN QUERY
  SELECT NULL::text AS coach_code, NULL::text AS gym_name, false AS is_coach;
END;
$$;

-- ─── Alumno: vincular por código ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.link_student_to_coach(p_code text)
RETURNS TABLE (gym_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_student_profile_id uuid;
  v_student_is_coach boolean;
  v_coach_profile_id uuid;
  v_gym text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT pr.id, COALESCE(pr.is_coach, false)
  INTO v_student_profile_id, v_student_is_coach
  FROM public.profiles pr
  WHERE pr.user_id = auth.uid()
  FOR UPDATE;

  IF v_student_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF v_student_is_coach THEN
    RAISE EXCEPTION 'COACH_CANNOT_LINK' USING ERRCODE = 'P0001';
  END IF;

  v_norm := upper(trim(COALESCE(p_code, '')));
  IF v_norm = '' THEN
    RAISE EXCEPTION 'INVALID_COACH_CODE' USING ERRCODE = 'P0001';
  END IF;

  SELECT pr.id,
    COALESCE(NULLIF(trim(pr.gym_name::text), ''), 'Coach')::text
  INTO v_coach_profile_id, v_gym
  FROM public.profiles pr
  WHERE pr.coach_code = v_norm
    AND COALESCE(pr.is_coach, false) = true;

  IF v_coach_profile_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_COACH_CODE' USING ERRCODE = 'P0001';
  END IF;

  IF v_coach_profile_id = v_student_profile_id THEN
    RAISE EXCEPTION 'SELF_LINK' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.profiles_coach_id_rpc', '1', true);

  UPDATE public.profiles pr
  SET
    coach_id = v_coach_profile_id,
    updated_at = now()
  WHERE pr.user_id = auth.uid();

  PERFORM set_config('app.profiles_coach_id_rpc', '', true);

  RETURN QUERY SELECT v_gym;
END;
$$;

REVOKE ALL ON FUNCTION public.link_student_to_coach(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_student_to_coach(text) TO authenticated;

-- ─── Alumno: desvincular ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unlink_student_from_coach()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.profiles_coach_id_rpc', '1', true);

  UPDATE public.profiles pr
  SET coach_id = NULL, updated_at = now()
  WHERE pr.user_id = auth.uid();

  PERFORM set_config('app.profiles_coach_id_rpc', '', true);
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_student_from_coach() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_student_from_coach() TO authenticated;

-- ─── Lectura segura del nombre del gimnasio del coach vinculado ────────────────

CREATE OR REPLACE FUNCTION public.get_linked_coach_gym()
RETURNS TABLE (gym_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN me.coach_id IS NULL THEN NULL::text
      ELSE COALESCE(NULLIF(trim(c.gym_name::text), ''), 'Coach')::text
    END AS gym_name
  FROM public.profiles me
  LEFT JOIN public.profiles c ON c.id = me.coach_id
  WHERE me.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_linked_coach_gym() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_linked_coach_gym() TO authenticated;
