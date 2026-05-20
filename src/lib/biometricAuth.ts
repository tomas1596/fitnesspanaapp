/**
 * Passkeys / WebAuthn en el dispositivo (sin Passkeys de Supabase en servidor).
 * Tras un login email+contraseña, el usuario registra un authenticator de plataforma.
 * La contraseña se guarda cifrada localmente; WebAuthn actúa como cerrojo antes de
 * llamar a supabase.auth.signInWithPassword y crear una sesión nueva.
 */

const STORAGE_KEY = 'pana_biometric_credential_v1';
const VAULT_KEY_STORAGE = 'pana_biometric_vault_key_v1';
export const BIOMETRIC_PROMPTED_KEY = 'pana_biometrics_prompted';
export const BIOMETRIC_ENABLED_KEY = 'pana_biometrics_enabled';

export type StoredBiometricCredential = {
  credentialId: string;
  email: string;
  /** Contraseña cifrada (AES-GCM): `{iv}.{ciphertext}` en base64url */
  passwordCipher: string;
  registeredAt: string;
};

export type BiometricUnlockResult = {
  email: string;
  password: string;
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

/** El usuario ya respondió (o descartó) la invitación de activar biometría en este dispositivo. */
export function hasBiometricPromptBeenAnswered(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_PROMPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markBiometricPromptAnswered(): void {
  try {
    localStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
  } catch {
    /* ignore */
  }
}

/** Preferir inicio con Face ID / huella en la pantalla de login. */
export function isBiometricFlowEnabled(): boolean {
  try {
    if (localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true') return true;
    return hasStoredBiometricCredential();
  } catch {
    return false;
  }
}

export function setBiometricFlowEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    } else {
      localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    }
  } catch {
    /* ignore */
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

function isUserCancelled(err: unknown): boolean {
  if (!(err instanceof DOMException)) return false;
  return err.name === 'NotAllowedError' || err.name === 'AbortError';
}

function formatUnknownError(err: unknown): string {
  if (err instanceof BiometricAuthError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Error desconocido';
}

async function getOrCreateVaultKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(VAULT_KEY_STORAGE);
  if (existing) {
    const raw = base64urlToBuffer(existing);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(VAULT_KEY_STORAGE, bufferToBase64url(exported));
  return key;
}

async function encryptPassword(plaintext: string): Promise<string> {
  const key = await getOrCreateVaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${bufferToBase64url(iv.buffer)}.${bufferToBase64url(ciphertext)}`;
}

async function decryptPassword(cipher: string): Promise<string> {
  const parts = cipher.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BiometricAuthError(
      'La bóveda biométrica está incompleta. Desactivá y volvé a activar la biometría en Perfil.',
      'not_registered',
    );
  }
  try {
    const key = await getOrCreateVaultKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64urlToBuffer(parts[0])) },
      key,
      base64urlToBuffer(parts[1]),
    );
    return new TextDecoder().decode(plain);
  } catch (err) {
    console.error('[biometric] decrypt vault failed', err);
    throw new BiometricAuthError(
      'No se pudo leer la bóveda local. Desactivá y volvé a activar la biometría en Perfil.',
      'not_registered',
    );
  }
}

function parseStoredCredential(raw: string): StoredBiometricCredential | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.credentialId !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.passwordCipher !== 'string' ||
      parsed.passwordCipher.length > 0
    ) {
      return {
        credentialId: parsed.credentialId,
        email: parsed.email.trim().toLowerCase(),
        passwordCipher: parsed.passwordCipher,
        registeredAt:
          typeof parsed.registeredAt === 'string' ? parsed.registeredAt : new Date().toISOString(),
      };
    }
    // Credencial legada (solo refresh token): ya no sirve tras signOut global
    if (typeof parsed.refreshToken === 'string') {
      return null;
    }
    return null;
  } catch {
    return null;
  }
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
    return parseStoredCredential(raw);
  } catch {
    return null;
  }
}

export function hasStoredBiometricCredential(): boolean {
  return getStoredBiometricCredential() !== null;
}

/** Solo al desactivar biometría desde Perfil: borra credencial WebAuthn local y bandera enabled. */
export function clearBiometricCredential(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    setBiometricFlowEnabled(false);
  } catch {
    /* ignore */
  }
}

function saveStoredCredential(credential: StoredBiometricCredential): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential));
  setBiometricFlowEnabled(true);
  markBiometricPromptAnswered();
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
 * Registra passkey de plataforma y guarda email + contraseña cifrados en el dispositivo.
 */
export async function registerBiometricCredential(email: string, password: string): Promise<void> {
  const supported = await checkPasskeySupport();
  if (!supported) {
    throw new BiometricAuthError('Tu dispositivo no admite inicio biométrico.', 'unsupported');
  }

  const emailClean = email.trim().toLowerCase();
  if (!emailClean || !password) {
    throw new BiometricAuthError(
      'Necesitamos tu contraseña actual para vincular la biometría en este dispositivo.',
      'session',
    );
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
    console.error('[biometric] WebAuthn create failed', err);
    if (isUserCancelled(err)) {
      throw new BiometricAuthError('Registro biométrico cancelado.', 'cancelled');
    }
    throw new BiometricAuthError(
      `No se pudo registrar la biometría: ${formatUnknownError(err)}`,
      'unknown',
    );
  }

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new BiometricAuthError('Respuesta biométrica inválida.', 'unknown');
  }

  const passwordCipher = await encryptPassword(password);

  saveStoredCredential({
    credentialId: bufferToBase64url(credential.rawId),
    email: emailClean,
    passwordCipher,
    registeredAt: new Date().toISOString(),
  });
}

/**
 * Verifica biometría (assertion) y devuelve credenciales para signInWithPassword.
 */
export async function authenticateWithBiometric(): Promise<BiometricUnlockResult> {
  const supported = await checkPasskeySupport();
  if (!supported) {
    throw new BiometricAuthError('Tu dispositivo no admite inicio biométrico.', 'unsupported');
  }

  const stored = getStoredBiometricCredential();
  if (!stored) {
    throw new BiometricAuthError(
      'No hay biometría configurada en este dispositivo. Activála desde Perfil o iniciá con email y contraseña.',
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
    console.error('[biometric] WebAuthn get failed', err);
    if (isUserCancelled(err)) {
      throw new BiometricAuthError('Inicio biométrico cancelado.', 'cancelled');
    }
    throw new BiometricAuthError(
      `No se pudo verificar tu biometría: ${formatUnknownError(err)}`,
      'unknown',
    );
  }

  if (!assertion || !(assertion instanceof PublicKeyCredential)) {
    throw new BiometricAuthError('No se reconoció tu credencial biométrica.', 'unknown');
  }

  const matchedId = bufferToBase64url(assertion.rawId);
  if (matchedId !== stored.credentialId) {
    throw new BiometricAuthError('Credencial biométrica no reconocida en este dispositivo.', 'unknown');
  }

  const password = await decryptPassword(stored.passwordCipher);
  return { email: stored.email, password };
}
