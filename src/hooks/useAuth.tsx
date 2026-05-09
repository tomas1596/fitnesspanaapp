import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type ProfileRow = {
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  weight?: number | null;
  height?: number | null;
  activity_level?: string | null;
  fitness_goal?: string | null;
};

export const isProfileIncomplete = (profile: ProfileRow | null) =>
  !profile ||
  !profile.first_name ||
  !profile.last_name ||
  !profile.date_of_birth ||
  !profile.gender ||
  !profile.weight ||
  !profile.height ||
  !profile.activity_level ||
  !profile.fitness_goal;

async function fetchProfileCompletion(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, date_of_birth, gender, weight, height, activity_level, fitness_goal')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] fetchProfileCompletion', error.message);
    return true;
  }
  return isProfileIncomplete(data as ProfileRow | null);
}

export type SignUpIdentity = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  checkingOnboarding: boolean;
  needsOnboarding: boolean;
  refreshProfileCompletion: () => Promise<void>;
  syncProfileCompletionFromRow: (profile: ProfileRow | null) => void;
  signUp: (
    email: string,
    password: string,
    identity?: SignUpIdentity,
  ) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const refreshProfileCompletion = useCallback(async () => {
    if (!user) {
      setNeedsOnboarding(false);
      return;
    }
    const missing = await fetchProfileCompletion(user.id);
    setNeedsOnboarding(missing);
  }, [user]);

  const syncProfileCompletionFromRow = useCallback((profile: ProfileRow | null) => {
    setNeedsOnboarding(isProfileIncomplete(profile));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCheckingOnboarding(false);
      setNeedsOnboarding(false);
      return;
    }

    let active = true;
    (async () => {
      setCheckingOnboarding(true);
      const missing = await fetchProfileCompletion(user.id);
      if (!active) return;
      setNeedsOnboarding(missing);
      setCheckingOnboarding(false);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const signUp = async (email: string, password: string, identity?: SignUpIdentity) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: identity
          ? {
              first_name: identity.firstName.trim(),
              last_name: identity.lastName.trim(),
              date_of_birth: identity.dateOfBirth,
            }
          : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        checkingOnboarding,
        needsOnboarding,
        refreshProfileCompletion,
        syncProfileCompletionFromRow,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
