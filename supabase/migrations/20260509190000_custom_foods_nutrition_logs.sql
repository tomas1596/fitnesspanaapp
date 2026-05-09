-- Manual nutrition library (per-user custom foods)
CREATE TABLE public.custom_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  base_calories NUMERIC NOT NULL DEFAULT 0,
  base_protein NUMERIC NOT NULL DEFAULT 0,
  base_carbs NUMERIC NOT NULL DEFAULT 0,
  base_fat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom_foods"
  ON public.custom_foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom_foods"
  ON public.custom_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom_foods"
  ON public.custom_foods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom_foods"
  ON public.custom_foods FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX custom_foods_user_id_created_at_idx
  ON public.custom_foods (user_id, created_at DESC);

-- Daily consumption log (values stored already scaled by quantity_multiplier)
CREATE TABLE public.nutrition_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  food_name TEXT NOT NULL,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('desayuno', 'almuerzo', 'cena', 'snack')),
  quantity_multiplier NUMERIC NOT NULL DEFAULT 1,
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nutrition_logs"
  ON public.nutrition_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nutrition_logs"
  ON public.nutrition_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own nutrition_logs"
  ON public.nutrition_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX nutrition_logs_user_id_consumed_at_idx
  ON public.nutrition_logs (user_id, consumed_at DESC);
