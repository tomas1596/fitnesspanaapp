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
  isBiometricFlowEnabled,
  registerBiometricCredential,
} from '@/lib/biometricAuth';

export function useBiometrics() {
  const [supported, setSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [flowEnabled, setFlowEnabled] = useState(false);
  const [checking, setChecking] = useState(true);

  const refreshCredentialState = useCallback(() => {
    setHasCredential(hasStoredBiometricCredential());
    setFlowEnabled(isBiometricFlowEnabled());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await checkPasskeySupport();
      if (cancelled) return;
      setSupported(ok);
      setHasCredential(hasStoredBiometricCredential());
      setFlowEnabled(isBiometricFlowEnabled());
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const registerWithPassword = useCallback(
    async (email: string, password: string) => {
      await registerBiometricCredential(email, password);
      refreshCredentialState();
    },
    [refreshCredentialState],
  );

  const signInWithBiometric = useCallback(async () => {
    const unlock = await authenticateWithBiometric();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: unlock.email,
      password: unlock.password,
    });

    if (error) {
      console.error('[biometric] supabase.auth.signInWithPassword', error);
      throw new BiometricAuthError(error.message, 'session');
    }

    if (!data.session) {
      console.error('[biometric] signInWithPassword returned no session', data);
      throw new BiometricAuthError('Supabase no devolvió una sesión activa.', 'session');
    }

    refreshCredentialState();
    return { email: unlock.email };
  }, [refreshCredentialState]);

  const revokeCredential = useCallback(() => {
    clearBiometricCredential();
    refreshCredentialState();
  }, [refreshCredentialState]);

  const storedEmail = getStoredBiometricCredential()?.email ?? null;

  return {
    supported,
    hasCredential,
    flowEnabled,
    checking,
    biometricLabel: getBiometricLabel(),
    storedEmail,
    registerWithPassword,
    signInWithBiometric,
    revokeCredential,
    refreshCredentialState,
  };
}
