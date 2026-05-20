/**
 * Passkeys / WebAuthn en el dispositivo (sin backend Supabase Passkeys).
 * Tras un login email+contraseña, el usuario puede registrar un authenticator
 * de plataforma (Face ID / Touch ID / huella). En logins futuros, la biometría
 * desbloquea el refresh token guardado localmente para restaurar la sesión.
 */

const STORAGE_KEY = 'pana_biometric_credential_v1';

export type StoredBiometricCredential = {
  credentialId: string;
  email: string;
  refreshToken: string;
  registeredAt: string;
};

export class BiometricAuthError extends Error {
  constructor(
    message: string,
    readonly code: 'unsupported' | 'cancelled' | 'not_registered' | 'session' | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'BiometricAuthError';
  }
}

function getRpId(): string {
  return window.location.hostname;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** ¿El navegador expone WebAuthn y hay authenticator de plataforma con biometría? */
export async function checkPasskeySupport(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  if (typeof PublicKeyCredential === 'undefined') return false;
  if (typeof navigator.credentials?.create !== 'function') return false;
  if (typeof navigator.credentials?.get !== 'function') return false;

  try {
    const uvpa = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof uvpa === 'function') {
      return await uvpa.call(PublicKeyCredential);
    }
    return true;
  } catch {
    return false;
  }
}

export function getStoredBiometricCredential(): StoredBiometricCredential | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBiometricCredential;
    if (
      !parsed?.credentialId ||
      !parsed?.email ||
      !parsed?.refreshToken ||
      typeof parsed.credentialId !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasStoredBiometricCredential(): boolean {
  return getStoredBiometricCredential() !== null;
}

export function clearBiometricCredential(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function saveStoredCredential(credential: StoredBiometricCredential): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
}

function isUserCancelled(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return err.name === 'NotAllowedError' || err.name === 'AbortError';
}

/** Etiqueta amigable según plataforma (Face ID vs huella). */
export function getBiometricLabel(): string {
  if (typeof navigator === 'undefined') return 'Face ID / Huella';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Face ID / Touch ID';
  if (/Android/i.test(ua)) return 'Huella';
  return 'Face ID / Huella';
}

/**
 * Registra un passkey de plataforma y persiste el refresh token de Supabase
 * asociado al credentialId (solo usable tras verificación biométrica).
 */
export async function registerBiometricCredential(
  email: string,
  refreshToken: string,
): Promise<void> {
  const supported = await checkPasskeySupport();
  if (!supported) {
    throw new BiometricAuthError('Tu dispositivo no admite inicio biométrico.', 'unsupported');
  }

  const emailClean = email.trim().toLowerCase();
  if (!emailClean || !refreshToken.trim()) {
    throw new BiometricAuthError('No hay sesión activa para vincular la biometría.', 'session');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Pana Fitness', id: getRpId() },
        user: {
          id: userId,
          name: emailClean,
          displayName: emailClean,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    });
  } catch (err) {
    if (isUserCancelled(err)) {
      throw new BiometricAuthError('Registro biométrico cancelado.', 'cancelled');
    }
    throw new BiometricAuthError('No se pudo registrar la biometría en este dispositivo.', 'unknown');
  }

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new BiometricAuthError('Respuesta biométrica inválida.', 'unknown');
  }

  saveStoredCredential({
    credentialId: bufferToBase64url(credential.rawId),
    email: emailClean,
    refreshToken: refreshToken.trim(),
    registeredAt: new Date().toISOString(),
  });
}

/**
 * Verifica biometría y devuelve credenciales almacenadas para restaurar sesión.
 */
export async function authenticateWithBiometric(): Promise<StoredBiometricCredential> {
  const supported = await checkPasskeySupport();
  if (!supported) {
    throw new BiometricAuthError('Tu dispositivo no admite inicio biométrico.', 'unsupported');
  }

  const stored = getStoredBiometricCredential();
  if (!stored) {
    throw new BiometricAuthError(
      'Todavía no activaste Face ID / huella. Iniciá sesión con email y contraseña primero.',
      'not_registered',
    );
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  let assertion: Credential | null;
  try {
    assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: getRpId(),
        allowCredentials: [
          {
            id: base64urlToBuffer(stored.credentialId),
            type: 'public-key',
            transports: ['internal', 'hybrid'],
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
  } catch (err) {
    if (isUserCancelled(err)) {
      throw new BiometricAuthError('Inicio biométrico cancelado.', 'cancelled');
    }
    throw new BiometricAuthError('No se pudo verificar tu biometría.', 'unknown');
  }

  if (!assertion || !(assertion instanceof PublicKeyCredential)) {
    throw new BiometricAuthError('No se reconoció tu credencial biométrica.', 'unknown');
  }

  const matchedId = bufferToBase64url(assertion.rawId);
  if (matchedId !== stored.credentialId) {
    throw new BiometricAuthError('Credencial biométrica no reconocida.', 'unknown');
  }

  return stored;
}
