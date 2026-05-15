import { supabase } from '@/integrations/supabase/client';

/**
 * Alinea `profiles.weight` con el pesaje más reciente en `weight_logs`
 * (por `log_date` desc, luego `created_at` desc).
 * Si no hay registros, deja `weight` en null.
 */
export async function syncProfileWeightFromLogs(userId: string): Promise<{ error: Error | null }> {
  const { data, error: qErr } = await supabase
    .from('weight_logs')
    .select('weight')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (qErr) return { error: qErr };

  const w = data?.weight != null ? Number(data.weight) : null;
  const { error: uErr } = await supabase.from('profiles').update({ weight: w }).eq('user_id', userId);
  return { error: uErr ?? null };
}
