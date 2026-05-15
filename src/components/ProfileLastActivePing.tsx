import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Con el componente montado, ping liviano solo de `last_active_at` cada ~2 min (+ uno al abrir). */
const PING_INTERVAL_MS = 2 * 60 * 1000;

/** Marca last_active_at en profiles (no bloquea la UI); errores en consola. */
export function ProfileLastActivePing({ userId }: { userId: string | undefined }) {
  useEffect(() => {
    if (!userId) return;

    const sendPing = () => {
      const iso = new Date().toISOString();
      void (async () => {
        const { data, error } = await supabase
          .from('profiles')
          .update({ last_active_at: iso })
          .eq('user_id', userId)
          .select('user_id');

        if (error) {
          console.error('Error actualizando last_active:', error);
          return;
        }
        if ((data ?? []).length === 0) {
          console.warn(
            'Ping last_active_at: ninguna fila actualizada (revisa user_id vs sesión y RLS en profiles).',
          );
        }
      })();
    };

    sendPing();
    const id = window.setInterval(sendPing, PING_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [userId]);

  return null;
}
