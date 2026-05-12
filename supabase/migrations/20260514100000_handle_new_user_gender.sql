-- Persistir género en el perfil al registrarse (útil si el signup no devuelve sesión y el upsert desde el cliente no aplica por RLS).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  fn text := NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), '');
  ln text := NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), '');
  dob_raw text := NEW.raw_user_meta_data->>'date_of_birth';
  gender_raw text := NULLIF(trim(NEW.raw_user_meta_data->>'gender'), '');
  full_name text;
BEGIN
  full_name := NULLIF(trim(coalesce(fn, '') || ' ' || coalesce(ln, '')), '');
  INSERT INTO public.profiles (user_id, display_name, first_name, last_name, date_of_birth, gender)
  VALUES (
    NEW.id,
    COALESCE(full_name, NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''), split_part(NEW.email, '@', 1)),
    fn,
    ln,
    CASE
      WHEN dob_raw IS NOT NULL AND dob_raw <> '' THEN dob_raw::date
      ELSE NULL
    END,
    gender_raw
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
