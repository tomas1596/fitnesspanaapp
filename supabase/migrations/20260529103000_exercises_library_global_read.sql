-- Lectura global de la biblioteca de ejercicios para usuarios autenticados (autocompletado).
-- Las políticas SELECT son permisivas y se combinan con OR: ya existe library_select por user_id.

CREATE POLICY "library_select_global_authenticated"
  ON public.exercises_library
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "library_select_global_authenticated" ON public.exercises_library IS
  'Permite sugerencias globales en vivo buscando nombres guardados por cualquier usuario (solo lectura).';
