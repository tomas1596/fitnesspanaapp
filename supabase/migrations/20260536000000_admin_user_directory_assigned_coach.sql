-- Admin directory: expose assigned coach label for students linked via profiles.coach_id
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
  gym_modalities text[],
  assigned_coach_name text
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
    COALESCE(pr.gym_modalities, '{}'::text[]) AS gym_modalities,
    CASE
      WHEN pr.coach_id IS NULL THEN NULL::text
      ELSE COALESCE(
        NULLIF(TRIM(c.gym_name), ''),
        NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''),
        'Coach'
      )
    END AS assigned_coach_name
  FROM public.profiles pr
  INNER JOIN auth.users au ON au.id = pr.user_id
  LEFT JOIN public.profiles c ON c.id = pr.coach_id
  ORDER BY pr.last_active_at DESC NULLS LAST, au.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
