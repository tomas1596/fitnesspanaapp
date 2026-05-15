-- Lista de alumnos para coaches (SECURITY DEFINER; bypass RLS).

CREATE OR REPLACE FUNCTION public.get_coach_students()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  last_active_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND COALESCE(p.is_coach, false) = true
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    st.id,
    NULLIF(
      trim(both ' ' FROM concat_ws(' ',
        NULLIF(trim(COALESCE(st.first_name::text, '')), ''),
        NULLIF(trim(COALESCE(st.last_name::text, '')), '')
      )),
      ''
    )::text AS full_name,
    COALESCE(au.email::text, '') AS email,
    st.avatar_url::text,
    st.last_active_at
  FROM public.profiles coach
  INNER JOIN public.profiles st ON st.coach_id = coach.id
  INNER JOIN auth.users au ON au.id = st.user_id
  WHERE coach.user_id = auth.uid()
  ORDER BY st.last_active_at DESC NULLS LAST, au.created_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_coach_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coach_students() TO authenticated;
