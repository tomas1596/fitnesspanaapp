import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AccountStatus = 'active' | 'suspended' | 'banned';

export type AccountStatusState =
  | { status: 'loading' }
  | { status: AccountStatus };

function normalizeAccountStatus(raw: unknown): AccountStatus {
  if (raw === 'suspended' || raw === 'banned') return raw;
  return 'active';
}

interface AccountStatusContextValue {
  state: AccountStatusState;
  refreshAccountStatus: () => Promise<void>;
}

const AccountStatusContext = createContext<AccountStatusContextValue>({
  state: { status: 'loading' },
  refreshAccountStatus: async () => {},
});

export const AccountStatusProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, isAdminLoading } = useAuth();
  const [state, setState] = useState<AccountStatusState>({ status: 'loading' });

  const fetchStatus = useCallback(async () => {
    if (!user) {
      setState({ status: 'active' });
      return;
    }
    if (isAdmin) {
      setState({ status: 'active' });
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('account_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[account-status] fetch failed', error.message);
      setState({ status: 'active' });
      return;
    }

    setState({ status: normalizeAccountStatus(data?.account_status) });
  }, [user, isAdmin]);

  useEffect(() => {
    if (isAdminLoading) {
      setState({ status: 'loading' });
      return;
    }
    void fetchStatus();
  }, [fetchStatus, isAdminLoading]);

  useEffect(() => {
    if (!user || isAdmin) return;

    const channel = supabase
      .channel(`profile-account-status-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = normalizeAccountStatus(
            (payload.new as { account_status?: unknown } | null)?.account_status,
          );
          setState({ status: next });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  const value = useMemo(
    () => ({
      state,
      refreshAccountStatus: fetchStatus,
    }),
    [state, fetchStatus],
  );

  return (
    <AccountStatusContext.Provider value={value}>{children}</AccountStatusContext.Provider>
  );
};

export function useAccountStatus(): AccountStatusState {
  return useContext(AccountStatusContext).state;
}

export function useAccountStatusActions() {
  return useContext(AccountStatusContext);
}
