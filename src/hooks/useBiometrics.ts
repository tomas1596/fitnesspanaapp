import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  authenticateWithBiometric,
  BiometricAuthError,
  checkPasskeySupport,
  clearBiometricCredential,
  getBiometricLabel,
  getStoredBiometricCredential,
  hasStoredBiometricCredential,
  registerBiometricCredential,
} from '@/lib/biometricAuth';

export function useBiometrics() {
  const [supported, setSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [checking, setChecking] = useState(true);

  const refreshCredentialState = useCallback(() => {
    setHasCredential(hasStoredBiometricCredential());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await checkPasskeySupport();
      if (cancelled) return;
      setSupported(ok);
      setHasCredential(hasStoredBiometricCredential());
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerFromCurrentSession = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.refresh_token) {
      throw new BiometricAuthError('No hay sesión activa para vincular la biometría.', 'session');
    }

    const email = session.user.email;
    if (!email) {
      throw new BiometricAuthError('Tu cuenta no tiene email asociado.', 'session');
    }

    await registerBiometricCredential(email, session.refresh_token);
    refreshCredentialState();
  }, [refreshCredentialState]);

  const signInWithBiometric = useCallback(async () => {
    const stored = await authenticateWithBiometric();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refreshToken,
    });

    if (error || !data.session) {
      clearBiometricCredential();
      refreshCredentialState();
      throw new BiometricAuthError(
        'Tu acceso biométrico expiró. Iniciá sesión con email y contraseña para reactivarlo.',
        'session',
      );
    }

    return { email: stored.email };
  }, [refreshCredentialState]);

  const revokeCredential = useCallback(() => {
    clearBiometricCredential();
    refreshCredentialState();
  }, [refreshCredentialState]);

  const storedEmail = getStoredBiometricCredential()?.email ?? null;

  return {
    supported,
    hasCredential,
    checking,
    biometricLabel: getBiometricLabel(),
    storedEmail,
    registerFromCurrentSession,
    signInWithBiometric,
    revokeCredential,
    refreshCredentialState,
  };
}
