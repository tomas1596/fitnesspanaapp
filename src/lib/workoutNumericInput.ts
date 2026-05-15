/** Solo dígitos y «:» para campos de tiempo (mm:ss, h:mm:ss, etc.). */
export function sanitizeTimeDigitColonInput(raw: string): string {
  return raw.replace(/[^\d:]/g, '');
}

/** Solo dígitos para rondas, vueltas y repeticiones enteras en estos campos. */
export function sanitizeUnsignedIntegerInput(raw: string): string {
  return raw.replace(/\D/g, '');
}
