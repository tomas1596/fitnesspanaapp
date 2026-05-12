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
  is_admin?: boolean | null;
};

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] fetchIsAdmin', error.message);
    return false;
  }
  return (data as { is_admin?: boolean } | null)?.is_admin === true;
}

export type SignUpIdentity = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
      setIsAdmin(false);
      return;
    }

    let active = true;
    (async () => {
      const admin = await fetchIsAdmin(user.id);
      if (active) setIsAdmin(admin);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const signUp = async (email: string, password: string, identity?: SignUpIdentity) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: identity
          ? {
              first_name: identity.firstName.trim(),
              last_name: identity.lastName.trim(),
              date_of_birth: identity.dateOfBirth,
              gender: identity.gender,
            }
          : undefined,
      },
    });
    if (error) return { error: error as Error };

    if (data.user && identity) {
      const fn = identity.firstName.trim();
      const ln = identity.lastName.trim();
      const displayName = [fn, ln].filter(Boolean).join(' ');
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          user_id: data.user.id,
          first_name: fn,
          last_name: ln,
          date_of_birth: identity.dateOfBirth,
          gender: identity.gender,
          display_name: displayName || null,
        },
        { onConflict: 'user_id' },
      );
      if (profileError) return { error: new Error(profileError.message) };
    }

    return { error: null };
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
        isAdmin,
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
