/** Mensajes exactos de Supabase Auth → español (clave en minúsculas para lookup). */
const EXACT_MAP: Record<string, string> = {
  'invalid login credentials':
    'Credenciales incorrectas. Verifica tu email y contraseña.',
  'user already registered': 'Este email ya está registrado.',
  'password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'email not confirmed': 'Confirmá tu email antes de iniciar sesión.',
  'signup is disabled': 'El registro no está disponible en este momento.',
  'user not found': 'No encontramos una cuenta con ese email.',
  'invalid email or password': 'Credenciales incorrectas. Verifica tu email y contraseña.',
  'email rate limit exceeded': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  'for security purposes, you can only request this once every 60 seconds':
    'Por seguridad, solo podés solicitar un enlace cada 60 segundos.',
  'unable to validate email address: invalid format': 'El formato del email no es válido.',
  'new password should be different from the old password':
    'La nueva contraseña debe ser distinta a la anterior.',
  'password is too weak': 'La contraseña es demasiado débil. Elegí una más segura.',
};

/** Coincidencias parciales cuando Supabase varía el texto. */
const PARTIAL_RULES: { test: (msg: string) => boolean; message: string }[] = [
  {
    test: (m) => m.includes('invalid login credentials') || m.includes('invalid email or password'),
    message: 'Credenciales incorrectas. Verifica tu email y contraseña.',
  },
  {
    test: (m) => m.includes('already registered') || m.includes('already been registered'),
    message: 'Este email ya está registrado.',
  },
  {
    test: (m) =>
      m.includes('password should be at least') || m.includes('password must be at least'),
    message: 'La contraseña debe tener al menos 6 caracteres.',
  },
  {
    test: (m) => m.includes('email not confirmed'),
    message: 'Confirmá tu email antes de iniciar sesión.',
  },
  {
    test: (m) => m.includes('rate limit') || m.includes('once every 60 seconds'),
    message: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  },
  {
    test: (m) => m.includes('invalid format') && m.includes('email'),
    message: 'El formato del email no es válido.',
  },
];

/**
 * Traduce mensajes de error de Supabase Auth al español.
 * Si no hay mapeo, devuelve el mensaje original.
 */
export function translateSupabaseAuthError(raw: string | undefined | null): string {
  const message = (raw ?? '').trim();
  if (!message) return 'Ocurrió un error. Intentá de nuevo.';

  const lower = message.toLowerCase();
  const exact = EXACT_MAP[lower];
  if (exact) return exact;

  for (const rule of PARTIAL_RULES) {
    if (rule.test(lower)) return rule.message;
  }

  return message;
}
