-- Personal exercise catalog: users save exercises here for quick reuse
CREATE TABLE IF NOT EXISTS exercises_library (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  muscle_group text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE exercises_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_select" ON exercises_library
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "library_insert" ON exercises_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_update" ON exercises_library
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "library_delete" ON exercises_library
  FOR DELETE USING (auth.uid() = user_id);
