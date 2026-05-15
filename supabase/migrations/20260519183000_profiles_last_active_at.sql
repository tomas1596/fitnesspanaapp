-- Última actividad en app (heartbeat del cliente → profiles.last_active_at)
-- Lista expuesta solo a admins vía admin_user_directory (SECURITY DEFINER).

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

COMMENT ON COLUMN public.profiles.last_active_at IS 'Última vez que la app marcó sesión abierta del usuario (actualización cliente).';

-- PG no permite CREATE OR REPLACE si cambia el RETURNS TABLE → DROP antes.
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
  last_active_at timestamptz
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
    pr.last_active_at
  FROM public.profiles pr
  INNER JOIN auth.users au ON au.id = pr.user_id
  ORDER BY pr.last_active_at DESC NULLS LAST, au.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
