import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SubscriptionState =
  | { status: 'loading' }
  | { status: 'trial'; daysLeft: number }
  | { status: 'premium'; until: Date; lifetime: boolean }
  | { status: 'expired' };

export function useSubscriptionStatus(): SubscriptionState {
  const { user, isAdmin, isAdminLoading } = useAuth();
  const [state, setState] = useState<SubscriptionState>({ status: 'loading' });

  useEffect(() => {
    if (!user || isAdminLoading) {
      setState({ status: 'loading' });
      return;
    }

    // Admins always bypass subscription checks
    if (isAdmin) {
      setState({ status: 'premium', until: new Date('2099-01-01'), lifetime: true });
      return;
    }

    let active = true;
    setState({ status: 'loading' });

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('premium_until')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      const now = new Date();
      const raw = (data as { premium_until?: string | null } | null)?.premium_until ?? null;
      const premiumUntil = raw ? new Date(raw) : null;

      if (premiumUntil && premiumUntil > now) {
        setState({
          status: 'premium',
          until: premiumUntil,
          lifetime: premiumUntil.getFullYear() >= 2049,
        });
        return;
      }

      // Trial window: 7 days from account creation
      const createdAt = new Date(user.created_at);
      const trialEnd = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (now < trialEnd) {
        const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        setState({ status: 'trial', daysLeft });
        return;
      }

      setState({ status: 'expired' });
    })();

    return () => {
      active = false;
    };
  }, [user, isAdmin, isAdminLoading]);

  return state;
}
