/**
 * Subscription state as a React context (singleton).
 *
 * WHY CONTEXT:
 * Multiple components (SubscriptionGuard, Profile, AdminPanel…) all need
 * subscription state. A single provider opens ONE Supabase realtime channel
 * and shares state via context — no duplicate channels or grey-screen crashes.
 *
 * EXPORTS:
 *   SubscriptionProvider   — mount once in App.tsx, inside <AuthProvider>
 *   useSubscriptionStatus  — backward-compat: returns SubscriptionState only
 *   useSubscriptionContext  — full context: state + notification flags + setters
 */
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionRole = 'free' | 'premium' | 'tester';

/**
 * Kept backward-compatible so existing consumers (Paywall, SubscriptionGuard)
 * don't need changes:
 *   – status:'premium' with role:'tester' = Tester (lifetime)
 *   – status:'premium' with role:'premium' = paid Premium
 *   – status:'trial' = free 7-day window
 *   – status:'expired' = trial over / premium expired
 */
export type SubscriptionState =
  | { status: 'loading' }
  | { status: 'trial';   daysLeft: number;              role: 'free' }
  | { status: 'premium'; until: Date; lifetime: boolean; role: 'premium' | 'tester' }
  | { status: 'expired';                                 role: 'free' | 'premium' };

export interface SubscriptionContextValue {
  state: SubscriptionState;
  /** True once the one-time tester welcome modal has been acknowledged. */
  notifiedTester: boolean;
  /** True once the premium-activation modal has been acknowledged. */
  notifiedPremium: boolean;
  /** Persists notified_tester=true in Supabase and updates local state. */
  markTesterNotified: () => Promise<void>;
  /** Persists notified_premium=true in Supabase and updates local state. */
  markPremiumNotified: () => Promise<void>;
}

interface ProfileSubRow {
  subscription_role?: string | null;
  subscription_expires_at?: string | null;
  premium_until?: string | null;
  notified_tester?: boolean | null;
  notified_premium?: boolean | null;
}

// ─── Pure state resolver (no side effects) ───────────────────────────────────

function resolveState(
  user: { created_at: string },
  row: ProfileSubRow | null,
): Exclude<SubscriptionState, { status: 'loading' }> {
  try {
    const now = new Date();
    const role = ((row?.subscription_role ?? 'free') || 'free') as SubscriptionRole;

    if (role === 'tester') {
      return { status: 'premium', until: new Date('2099-01-01'), lifetime: true, role: 'tester' };
    }

    if (role === 'premium') {
      const raw = row?.subscription_expires_at ?? row?.premium_until ?? null;
      if (raw) {
        const expiresAt = new Date(raw);
        if (!isNaN(expiresAt.getTime()) && expiresAt > now) {
          return { status: 'premium', until: expiresAt, lifetime: false, role: 'premium' };
        }
      }
      // premium role but no valid expiry → fall through to free/trial logic
    }

    // legacy premium_until backward compat (role=free but old date set)
    if (row?.premium_until) {
      const pu = new Date(row.premium_until);
      if (!isNaN(pu.getTime()) && pu > now) {
        return {
          status: 'premium',
          until: pu,
          lifetime: pu.getFullYear() >= 2049,
          role: 'premium',
        };
      }
    }

    // 7-day trial from account creation
    const trialEnd = new Date(new Date(user.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (now < trialEnd) {
      const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return { status: 'trial', daysLeft, role: 'free' };
    }

    return { status: 'expired', role: role === 'premium' ? 'premium' : 'free' };
  } catch {
    const now = new Date();
    const trialEnd = new Date(new Date(user.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (now < trialEnd) {
      const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      return { status: 'trial', daysLeft, role: 'free' };
    }
    return { status: 'expired', role: 'free' };
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const defaultCtx: SubscriptionContextValue = {
  state: { status: 'loading' },
  notifiedTester: false,
  notifiedPremium: false,
  markTesterNotified: async () => {},
  markPremiumNotified: async () => {},
};

const SubscriptionContext = createContext<SubscriptionContextValue>(defaultCtx);

// ─── Provider (mount ONCE in App.tsx, inside <AuthProvider>) ─────────────────

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, isAdminLoading } = useAuth();
  const [state, setState] = useState<SubscriptionState>({ status: 'loading' });
  const [notifiedTester, setNotifiedTester] = useState(false);
  const [notifiedPremium, setNotifiedPremium] = useState(false);
  // Unique suffix prevents channel name collisions on re-mount
  const channelSuffix = useRef(`${Date.now()}_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!user || isAdminLoading) {
      setState({ status: 'loading' });
      return;
    }

    // Admins get unrestricted access; no subscription constraints apply
    if (isAdmin) {
      setState({ status: 'premium', until: new Date('2099-01-01'), lifetime: true, role: 'tester' });
      return;
    }

    let active = true;
    setState({ status: 'loading' });

    // ── Initial fetch ──────────────────────────────────────────────────────
    const doFetch = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'subscription_role, subscription_expires_at, premium_until, notified_tester, notified_premium',
          )
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.warn('[subscription] initial fetch error, using trial fallback:', error.message);
          setState(resolveState(user, null));
          return;
        }

        const row = data as ProfileSubRow | null;
        setState(resolveState(user, row));
        setNotifiedTester(row?.notified_tester === true);
        setNotifiedPremium(row?.notified_premium === true);
      } catch (err) {
        if (active) {
          console.warn('[subscription] unexpected fetch error:', err);
          setState(resolveState(user, null));
        }
      }
    };

    doFetch();

    // ── Real-time: react immediately when admin updates subscription fields ─
    const channel = supabase
      .channel(`sub_${user.id}_${channelSuffix.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!active) return;
          try {
            const row = payload.new as ProfileSubRow;
            setState(resolveState(user, row));
            setNotifiedTester(row?.notified_tester === true);
            setNotifiedPremium(row?.notified_premium === true);
          } catch {
            // ignore malformed realtime payload
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.info('[subscription] realtime unavailable; using poll-only mode');
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [user, isAdmin, isAdminLoading]);

  const markTesterNotified = useCallback(async () => {
    if (!user) return;
    setNotifiedTester(true);
    await supabase
      .from('profiles')
      .update({ notified_tester: true })
      .eq('user_id', user.id);
  }, [user]);

  const markPremiumNotified = useCallback(async () => {
    if (!user) return;
    setNotifiedPremium(true);
    await supabase
      .from('profiles')
      .update({ notified_premium: true })
      .eq('user_id', user.id);
  }, [user]);

  return (
    <SubscriptionContext.Provider
      value={{ state, notifiedTester, notifiedPremium, markTesterNotified, markPremiumNotified }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─── Consumer hooks ───────────────────────────────────────────────────────────

/**
 * Backward-compatible hook — returns SubscriptionState directly.
 * Existing consumers (Paywall.tsx, SubscriptionGuard in App.tsx) use this.
 */
export function useSubscriptionStatus(): SubscriptionState {
  return useContext(SubscriptionContext).state;
}

/**
 * Full context hook — state + notification flags + persisted setters.
 * Used by Profile.tsx for badges, modals and banners.
 */
export function useSubscriptionContext(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
