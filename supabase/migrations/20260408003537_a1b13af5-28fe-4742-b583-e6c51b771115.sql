
-- Add target_weight to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_weight numeric;

-- Add RIR and to_failure to exercise_sets
ALTER TABLE public.exercise_sets ADD COLUMN IF NOT EXISTS rir integer DEFAULT 0;
ALTER TABLE public.exercise_sets ADD COLUMN IF NOT EXISTS to_failure boolean DEFAULT false;

-- Create avatar storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
