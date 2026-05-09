
-- Add biometric fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;

-- Food entries table
CREATE TABLE public.food_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own food" ON public.food_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own food" ON public.food_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own food" ON public.food_entries FOR DELETE USING (auth.uid() = user_id);

-- Hydration logs table
CREATE TABLE public.hydration_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  glasses integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.hydration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own hydration" ON public.hydration_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own hydration" ON public.hydration_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own hydration" ON public.hydration_logs FOR UPDATE USING (auth.uid() = user_id);

-- Recovery logs table
CREATE TABLE public.recovery_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality integer NOT NULL DEFAULT 0,
  energy_level integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);
ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recovery" ON public.recovery_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recovery" ON public.recovery_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recovery" ON public.recovery_logs FOR UPDATE USING (auth.uid() = user_id);
