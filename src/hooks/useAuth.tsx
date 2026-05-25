import { useState, useEffect, useLayoutEffect, useCallback, createContext, useContext } from 'react';
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
  /** true hasta conocer is_admin del usuario actual (evita redirigir admins por un frame). */
  isAdminLoading: boolean;
  isAdmin: boolean;
  /** Sesión de recuperación tras el enlace del email (PASSWORD_RECOVERY). */
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  /** Vuelve a leer `profiles.is_admin` (p. ej. tras cambiar rol desde el panel admin). */
  refreshIsAdmin: () => Promise<void>;
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
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  useLayoutEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }
    setIsAdmin(false);
    setIsAdminLoading(true);
  }, [user]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
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

  const refreshIsAdmin = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    setIsAdminLoading(true);
    const admin = await fetchIsAdmin(user.id);
    setIsAdmin(admin);
    setIsAdminLoading(false);
  }, [user]);

  useEffect(() => {
    void refreshIsAdmin();
  }, [refreshIsAdmin]);

  const signUp = async (email: string, password: string, identity?: SignUpIdentity) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/verificado`,
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

    // El perfil se crea automáticamente via trigger en Supabase (handle_new_user).
    // No hacemos insert manual aquí: con email confirmation activo no hay sesión
    // todavía y RLS bloquearía el upsert.
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
        isAdminLoading,
        isAdmin,
        isPasswordRecovery,
        clearPasswordRecovery,
        refreshIsAdmin,
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
