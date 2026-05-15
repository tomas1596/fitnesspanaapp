-- Permite UPDATE de la propia fila en profiles para sesiones JWT (heartbeat last_active_at).
-- USING + WITH CHECK y (SELECT auth.uid()) siguen las recomendaciones de Supabase.
-- Compatible con coexistir junto a otras políticas UPDATE permisivas en la tabla.

DROP POLICY IF EXISTS "profiles_authenticated_update_own_row" ON public.profiles;

CREATE POLICY "profiles_authenticated_update_own_row"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
