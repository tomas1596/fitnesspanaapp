-- Personal records (PRs): user-logged best lifts per exercise
CREATE TABLE IF NOT EXISTS personal_records (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name  text        NOT NULL,
  weight         numeric     NOT NULL CHECK (weight > 0),
  date           date        NOT NULL DEFAULT (CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS personal_records_user_id_idx ON personal_records (user_id);
CREATE INDEX IF NOT EXISTS personal_records_user_exercise_idx ON personal_records (user_id, exercise_name);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_records_select" ON personal_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "personal_records_insert" ON personal_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "personal_records_update" ON personal_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "personal_records_delete" ON personal_records
  FOR DELETE USING (auth.uid() = user_id);
