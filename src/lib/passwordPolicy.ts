/**
 * Política unificada de contraseñas para registro y cambio de contraseña.
 * Mínimo 8 caracteres, una mayúscula y un carácter especial (puntuación / símbolos).
 */

export type PasswordPolicyCheck = {
  minLength: boolean;
  hasUppercase: boolean;
  hasSpecial: boolean;
};

/** Caracteres especiales típicos incl. los citados en producto (@, #, $, …). */
const SPECIAL_OR_PUNCT_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`´°€£¥§¡¿]/;

export function evaluatePasswordPolicy(password: string): PasswordPolicyCheck {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasSpecial: SPECIAL_OR_PUNCT_RE.test(password),
  };
}

export function passwordMeetsPolicy(password: string): boolean {
  const c = evaluatePasswordPolicy(password);
  return c.minLength && c.hasUppercase && c.hasSpecial;
}
